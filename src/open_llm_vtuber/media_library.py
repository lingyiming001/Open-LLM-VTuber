"""Compatibility imports; implementation lives in the media package."""

from .media.catalog import MEDIA_TYPES, list_media
from .media.routes import init_media_routes
from .media.transcription import decode_audio

__all__ = ["MEDIA_TYPES", "list_media", "init_media_routes", "decode_audio"]
