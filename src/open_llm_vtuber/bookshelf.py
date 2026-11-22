"""Compatibility imports; implementation lives in the media package."""

from .media.bookshelf import ROOT, DESCRIPTION, SCHEMA, catalog, load_book, bookshelf

__all__ = ["ROOT", "DESCRIPTION", "SCHEMA", "catalog", "load_book", "bookshelf"]
