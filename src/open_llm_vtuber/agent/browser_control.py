"""Deterministic routing for explicit, safe browser-navigation requests."""

import re


_OPEN = r"(?:帮我)?\s*(?:打开|访问|进入|导航到)\s*"
_URL = re.compile(_OPEN + r"(https?://[^\s<>]+)", re.IGNORECASE)
_BAIDU = re.compile(_OPEN + r"(?:百度|baidu)(?:\s*(?:首页|网站|官网))?\s*[。！？!？]?$", re.IGNORECASE)
_TRAILING_PUNCTUATION = "。！？!？,，"


def browser_navigation_url(text: str) -> str | None:
    """Return a safe URL only when the user explicitly requests navigation."""
    normalized = text.strip()
    if _BAIDU.fullmatch(normalized):
        return "https://www.baidu.com"
    match = _URL.search(normalized)
    if not match:
        return None
    return match.group(1).rstrip(_TRAILING_PUNCTUATION)
