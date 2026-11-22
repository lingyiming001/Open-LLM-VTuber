"""Bounded FFmpeg decoding and cached, timestamped ASR transcription."""

import asyncio
import shutil
import subprocess
from collections import OrderedDict
import numpy as np
from fastapi import APIRouter, HTTPException


def init_lyrics_routes(context, resolve):
    router = APIRouter()
    lock = asyncio.Lock()
    cache = OrderedDict()

    @router.get("/lyrics/{filename:path}")
    async def lyrics(filename: str):
        path = resolve("music", filename)
        engine = context.asr_engine
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg or not engine:
            raise HTTPException(503, "需要 FFmpeg 和可用的语音识别引擎")
        stat = path.stat()
        key = (path, stat.st_mtime_ns, stat.st_size, id(engine))
        async with lock:
            if key in cache:
                cache.move_to_end(key)
                return cache[key]
            try:
                pcm = await asyncio.to_thread(decode_audio, ffmpeg, path)
                result = []
                samples = np.frombuffer(pcm, dtype="<i2")
                window = 16000 * 10
                for offset in range(0, samples.size, window):
                    chunk = samples[offset : offset + window].astype(np.float32) / 32768
                    text = (await engine.async_transcribe_np(chunk)).strip()
                    if text:
                        result.append(
                            {
                                "start": offset / 16000,
                                "end": min(offset + window, samples.size) / 16000,
                                "text": text,
                            }
                        )
            except (OSError, ValueError, subprocess.SubprocessError) as exc:
                raise HTTPException(422, "无法转写音轨") from exc
            cache[key] = result
            if len(cache) > 16:
                cache.popitem(last=False)
            return result

    return router


def decode_audio(ffmpeg, path):
    return subprocess.run(
        [
            ffmpeg,
            "-nostdin",
            "-v",
            "error",
            "-i",
            str(path),
            "-vn",
            "-t",
            "600",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "s16le",
            "pipe:1",
        ],
        check=True,
        capture_output=True,
        timeout=45,
    ).stdout
