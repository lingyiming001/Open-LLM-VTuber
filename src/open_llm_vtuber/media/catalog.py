"""Audio/video catalog and validated playback file resolution."""

from pathlib import Path
from fastapi import HTTPException
from ..broadcast import allowed

MEDIA_TYPES = {
    "music": {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".opus"},
    "videos": {".mp4", ".webm", ".mov", ".m4v", ".ogv"},
}


def list_media(root=Path("media")):
    root = root.resolve()
    result = {}
    for kind, extensions in MEDIA_TYPES.items():
        folder = root / kind
        result[kind] = [
            {"title": path.stem, "path": path.relative_to(folder).as_posix()}
            for path in sorted(folder.rglob("*"))
            if allowed(kind, path.relative_to(folder).as_posix())
            and folder.resolve().is_relative_to(root)
            and path.suffix.lower() in extensions
            and path.is_file()
            and path.resolve().is_relative_to(folder.resolve())
        ]
    return result


class MediaLibrary:
    def __init__(self, root=Path("media")):
        self.root = Path(root).resolve()

    def entries(self, kind):
        if kind not in MEDIA_TYPES:
            raise HTTPException(404, "未知媒体类型")
        folder = self.root / kind
        folder.mkdir(parents=True, exist_ok=True)
        if not folder.resolve().is_relative_to(self.root):
            raise HTTPException(404, "媒体目录不可用")
        return folder, MEDIA_TYPES[kind]

    def resolve(self, kind, filename):
        folder, extensions = self.entries(kind)
        path = (folder / filename).resolve()
        if (
            not allowed(kind, filename)
            or not path.is_relative_to(folder.resolve())
            or path.suffix.lower() not in extensions
            or not path.is_file()
        ):
            raise HTTPException(404, "媒体文件不存在")
        return path
