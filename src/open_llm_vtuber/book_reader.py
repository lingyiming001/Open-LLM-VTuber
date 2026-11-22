"""Compatibility imports; implementation lives in the media package."""

from .media.book_text import MAX_SIZE, extract_book
from .media.reader import SpeechRequest, init_book_routes

__all__ = ["MAX_SIZE", "extract_book", "SpeechRequest", "init_book_routes"]
