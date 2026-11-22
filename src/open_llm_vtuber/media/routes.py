"""HTTP composition for media features; public URL paths stay stable."""

from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import FileResponse
from .catalog import MediaLibrary, list_media
from .reader import init_book_routes
from .resources import init_resource_routes
from .transcription import init_lyrics_routes


def init_media_routes(context, root=Path("media")) -> APIRouter:
    library_files = MediaLibrary(root)
    router = APIRouter(prefix="/api/media")
    router.include_router(init_resource_routes(library_files.root))
    router.include_router(init_lyrics_routes(context, library_files.resolve))

    @router.get("/library")
    def library():
        return list_media(library_files.root)

    @router.get("/file/{kind}/{filename:path}")
    def media_file(kind: str, filename: str):
        return FileResponse(library_files.resolve(kind, filename))

    return router


__all__ = ["init_book_routes", "init_media_routes"]
