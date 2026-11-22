"""Adapt local media operations to the shared conversation tool result format."""

import asyncio
import json
from .bookshelf import bookshelf
from .playback import control_stage

TOOL_NAMES = frozenset({"local_stage", "local_bookshelf"})


async def execute_media_tool(name, arguments):
    if name == "local_stage":
        try:
            result, command = await asyncio.to_thread(
                control_stage, **(arguments or {})
            )
            return (
                False,
                json.dumps(result, ensure_ascii=False),
                {"stage_action": command},
                [],
            )
        except (OSError, TypeError, ValueError) as exc:
            return True, str(exc), {}, []
    if name == "local_bookshelf":
        try:
            result = await asyncio.to_thread(bookshelf, **(arguments or {}))
            metadata = {}
            if (arguments or {}).get("action") == "read" and result.get("passages"):
                metadata["stage_action"] = {
                    "action": "read",
                    "kind": "books",
                    "path": result["book"],
                    "start": result["start"],
                    "external": True,
                }
            return False, json.dumps(result, ensure_ascii=False), metadata, []
        except Exception as exc:
            return True, str(exc), {}, []
    raise ValueError(f"Unknown media tool: {name}")
