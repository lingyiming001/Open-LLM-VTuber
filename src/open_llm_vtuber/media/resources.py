"""Import and browse local books, images, music and videos."""

import os
import tempfile
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from ..broadcast import allowed
from .catalog import MEDIA_TYPES


def init_resource_routes(root=Path("media")):
    root = Path(root).resolve()
    router = APIRouter()
    # Keep the existing playback catalog stable; resources also include books/images.
    resource_types = {
        **MEDIA_TYPES,
        "images": {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"},
        "books": {".pdf", ".epub", ".txt"},
    }

    def resource_folder(kind):
        if kind not in resource_types:
            raise HTTPException(404, "未知资源类型")
        folder = (
            Path(os.environ.get("VTUBER_BOOKS_DIR", str(root / "books")))
            .expanduser()
            .resolve()
            if kind == "books"
            else root / kind
        )
        folder.mkdir(parents=True, exist_ok=True)
        if kind != "books" and not folder.resolve().is_relative_to(root):
            raise HTTPException(400, "资源目录不可用")
        return folder

    @router.get("/resources")
    def resources():
        result = []
        for kind, extensions in resource_types.items():
            folder = resource_folder(kind)
            for path in sorted(folder.rglob("*")):
                name = path.relative_to(folder).as_posix()
                if (
                    path.is_file()
                    and path.suffix.lower() in extensions
                    and path.resolve().is_relative_to(folder.resolve())
                    and allowed(kind, name)
                ):
                    result.append(
                        {
                            "kind": kind,
                            "path": name,
                            "title": path.name,
                            "size": path.stat().st_size,
                        }
                    )
        return result

    @router.post("/resources/{kind}")
    async def import_resource(kind: str, filename: str, request: Request):
        from ..broadcast import LIVE

        if LIVE:
            raise HTTPException(403, "请在非直播模式下导入资源")
        folder = resource_folder(kind)
        if (
            not filename
            or filename in {".", ".."}
            or "/" in filename
            or "\\" in filename
            or any(ord(c) < 32 for c in filename)
            or len(filename.encode("utf-8")) > 220
            or Path(filename).suffix.lower() not in resource_types[kind]
        ):
            raise HTTPException(400, "文件名或格式不支持")
        limit = (30 if kind == "books" else 500) * 1024 * 1024
        temp = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=folder, suffix=".upload", delete=False
            ) as out:
                temp = Path(out.name)
                size = 0
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > limit:
                        raise HTTPException(
                            413, f"文件不能超过 {limit // 1024 // 1024} MB"
                        )
                    out.write(chunk)
            if not size:
                raise HTTPException(400, "不能导入空文件")
            target = folder / filename
            index = 1
            while True:
                try:
                    os.link(temp, target)
                    break
                except FileExistsError:
                    target = (
                        folder
                        / f"{Path(filename).stem} ({index}){Path(filename).suffix}"
                    )
                    index += 1
            return {
                "kind": kind,
                "path": target.name,
                "title": target.name,
                "size": size,
            }
        finally:
            if temp:
                temp.unlink(missing_ok=True)

    @router.get("/resources/file/{kind}/{filename:path}")
    def resource_file(kind: str, filename: str):
        folder = resource_folder(kind)
        path = (folder / filename).resolve()
        if (
            not path.is_relative_to(folder.resolve())
            or not path.is_file()
            or path.suffix.lower() not in resource_types[kind]
            or not allowed(kind, filename)
        ):
            raise HTTPException(404, "资源不存在")
        return FileResponse(path)

    return router
