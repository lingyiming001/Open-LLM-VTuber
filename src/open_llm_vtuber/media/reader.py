"""Reader page, book import and sequential speech HTTP endpoints."""

import asyncio
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from .book_text import MAX_SIZE, extract_book


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=240)


def init_book_routes(context) -> APIRouter:
    router = APIRouter()
    speech_lock = asyncio.Lock()

    @router.get("/reader")
    async def reader():
        return FileResponse(Path(__file__).with_name("reader.html"))

    @router.post("/api/reader/import")
    async def import_book(file: UploadFile = File(...)):
        from ..broadcast import LIVE

        if LIVE:
            raise HTTPException(403, "直播模式不开放临时书籍导入")
        try:
            data = await file.read(MAX_SIZE + 1)
            if len(data) > MAX_SIZE:
                raise HTTPException(413, "书籍不能超过 30 MB")
            chunks = await asyncio.to_thread(
                extract_book,
                data,
                Path(file.filename or "").suffix.lower(),
                with_chapters=True,
            )
            return {
                "title": file.filename,
                "chapters": chunks,
                "chunks": [text for chapter in chunks for text in chapter["chunks"]],
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(400, f"无法读取书籍：{exc}") from exc
        finally:
            await file.close()

    @router.post("/api/reader/speech")
    async def speech(request: SpeechRequest):
        from ..broadcast import LIVE

        if LIVE:
            raise HTTPException(403, "直播模式请通过获准书库阅读")
        async with speech_lock:
            engine = context.tts_engine
            path = await engine.async_generate_audio(
                request.text, file_name_no_ext=f"reader_{uuid4().hex}"
            )
            if not path or not Path(path).is_file():
                raise HTTPException(502, "语音生成失败")
            try:
                audio = await asyncio.to_thread(Path(path).read_bytes)
                suffix = Path(path).suffix.lower()
            except BaseException:
                engine.remove_file(path)
                raise
            return Response(
                audio,
                media_type={
                    ".wav": "audio/wav",
                    ".mp3": "audio/mpeg",
                    ".ogg": "audio/ogg",
                }.get(suffix, "application/octet-stream"),
                background=BackgroundTask(engine.remove_file, path),
            )

    return router
