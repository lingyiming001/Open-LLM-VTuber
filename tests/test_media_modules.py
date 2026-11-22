"""Verify public URLs, assets and tool payloads survive module extraction."""

import asyncio
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.open_llm_vtuber.media.routes import init_book_routes, init_media_routes
from src.open_llm_vtuber.media.tools import execute_media_tool


def test_reader_asset_import_and_playback_routes(tmp_path, monkeypatch):
    monkeypatch.delenv("VTUBER_BOOKS_DIR", raising=False)
    monkeypatch.setattr("src.open_llm_vtuber.broadcast.LIVE", False)
    (tmp_path / "videos").mkdir()
    (tmp_path / "videos" / "demo.mp4").write_bytes(b"video data")
    app = FastAPI()
    app.include_router(init_book_routes(SimpleNamespace()))
    app.include_router(init_media_routes(SimpleNamespace(), tmp_path))
    with TestClient(app) as client:
        assert client.get("/reader").status_code == 200
        response = client.post(
            "/api/reader/import",
            files={"file": ("book.txt", "第一章 开始\n原文。".encode(), "text/plain")},
        )
        assert response.status_code == 200
        assert response.json()["chapters"][0]["title"] == "第一章 开始"
        assert client.get("/api/media/library").json()["videos"] == [
            {"title": "demo", "path": "demo.mp4"}
        ]
        assert client.get("/api/media/file/videos/demo.mp4").content == b"video data"
        assert client.get("/api/media/file/videos/missing.mp4").status_code == 404


def test_lyrics_route_uses_extracted_decoder_and_keeps_cache(tmp_path, monkeypatch):
    monkeypatch.setattr("src.open_llm_vtuber.broadcast.LIVE", False)
    (tmp_path / "music").mkdir()
    (tmp_path / "music" / "song.wav").write_bytes(b"placeholder")

    class Engine:
        calls = 0

        async def async_transcribe_np(self, samples):
            self.calls += 1
            return "歌词"

    engine = Engine()
    app = FastAPI()
    app.include_router(init_media_routes(SimpleNamespace(asr_engine=engine), tmp_path))
    with (
        patch(
            "src.open_llm_vtuber.media.transcription.shutil.which",
            return_value="/fake/ffmpeg",
        ),
        patch(
            "src.open_llm_vtuber.media.transcription.decode_audio",
            return_value=b"\0\0" * 16000,
        ),
        TestClient(app) as client,
    ):
        first = client.get("/api/media/lyrics/song.wav")
        assert first.status_code == 200
        assert first.json() == [{"start": 0, "end": 1, "text": "歌词"}]
        assert client.get("/api/media/lyrics/song.wav").json() == first.json()
        assert engine.calls == 1


def test_extracted_tools_keep_stage_and_reading_metadata():
    result = asyncio.run(
        execute_media_tool("local_stage", {"action": "next", "kind": "videos"})
    )
    assert result[0] is False
    assert result[2]["stage_action"] == {
        "action": "next",
        "kind": "videos",
        "path": None,
    }
    with patch(
        "src.open_llm_vtuber.media.tools.bookshelf",
        return_value={"book": "book.txt", "start": 2, "passages": ["原文"]},
    ):
        result = asyncio.run(
            execute_media_tool(
                "local_bookshelf", {"action": "read", "book": "book.txt", "start": 2}
            )
        )
    assert result[2]["stage_action"] == {
        "action": "read",
        "kind": "books",
        "path": "book.txt",
        "start": 2,
        "external": True,
    }


def test_legacy_imports_remain_available():
    from src.open_llm_vtuber.book_reader import init_book_routes as legacy_reader
    from src.open_llm_vtuber.media_library import init_media_routes as legacy_media

    assert legacy_reader is init_book_routes
    assert legacy_media is init_media_routes
