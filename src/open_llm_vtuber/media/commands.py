"""Conservative, zero-model routing for unambiguous local media commands."""

import re
from pathlib import Path


def _title(value):
    return re.sub(r'[\s《》「」“”"\'。！!？?]', "", value).casefold()


def local_command(text, enabled, cursor):
    text = re.sub(r"^(?:请帮我|麻烦|帮我|请)\s*", "", text.strip()).rstrip("。！!")
    # Full matches avoid executing quoted commands, questions and negated requests.
    controls = {
        "暂停播放": "pause",
        "暂停视频": "pause",
        "暂停音乐": "pause",
        "继续播放": "resume",
        "继续视频": "resume",
        "继续音乐": "resume",
        "停止播放": "stop",
        "停止视频": "stop",
        "停止音乐": "stop",
    }
    switches = {
        "换一首": ("next", None),
        "换首歌": ("next", "music"),
        "换一首歌": ("next", "music"),
        "下一首": ("next", "music"),
        "上一首": ("previous", "music"),
        "换个视频": ("next", "videos"),
        "换一个视频": ("next", "videos"),
        "下一个视频": ("next", "videos"),
        "上一个视频": ("previous", "videos"),
        "换一个": ("next", None),
        "换下一个": ("next", None),
        "下一个": ("next", None),
    }
    if text in switches and "local_stage" in enabled:
        action, kind = switches[text]
        args = {"action": action}
        if kind:
            args["kind"] = kind
        return "local_stage", args
    if text in controls and "local_stage" in enabled:
        args = {"action": controls[text]}
        if "视频" in text:
            args["kind"] = "videos"
        if "音乐" in text:
            args["kind"] = "music"
        return "local_stage", args
    if (
        text in {"继续读", "继续朗读", "下一段", "接着读"}
        and cursor.get("book")
        and "local_bookshelf" in enabled
    ):
        return "local_bookshelf", {
            "action": "read",
            "book": cursor["book"],
            "start": cursor["next_start"],
        }
    match = re.fullmatch(r"(?:朗读|阅读|读一下|读一段|读)\s*(.+)", text)
    if (match or cursor.get("awaiting_book")) and "local_bookshelf" in enabled:
        from .bookshelf import catalog

        requested = _title(match[1] if match else text)
        books = catalog()
        candidates = [name for name in books if requested in {_title(name), _title(Path(name).stem)}]
        if not candidates:
            def alias(value):
                return re.sub(r"(?:诗歌?|作品|诗词)(?=全集$)", "", value)
            candidates = [name for name in books if alias(requested) == alias(_title(Path(name).stem))]
        if len(candidates) == 1:
            name = candidates[0]
            return "local_bookshelf", {
                "action": "read", "book": name,
                "start": cursor.get("next_start", 0) if cursor.get("book") == name else 0,
            }
    match = re.fullmatch(r"(?:播放|看视频|听歌)\s*(.+)", text)
    if match and "local_stage" in enabled:
        from .catalog import list_media

        requested = _title(match[1])
        candidates = [
            (kind, item["path"])
            for kind, items in list_media().items()
            for item in items
            if requested
            in {
                _title(item["path"]),
                _title(Path(item["path"]).stem),
                _title(item["title"]),
            }
        ]
        if len(candidates) == 1:
            kind, path = candidates[0]
            return "local_stage", {"action": "play", "kind": kind, "path": path}
    return None
