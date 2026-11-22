"""Local tool task history and cancellation for the desktop workbench."""

import asyncio
import json
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from .broadcast import LIVE

DB_PATH = Path(".tool_tasks") / ("live.sqlite3" if LIVE else "private.sqlite3")
active = {}


def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("""CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, tool TEXT NOT NULL, status TEXT NOT NULL,
        started REAL NOT NULL, finished REAL, retry_input TEXT
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS timers (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, due REAL NOT NULL, status TEXT NOT NULL
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, prompt TEXT NOT NULL, due REAL NOT NULL,
        period INTEGER NOT NULL, status TEXT NOT NULL, result TEXT, last_run REAL
    )""")
    return db


def retry_input(tool, arguments):
    if LIVE or not isinstance(arguments, dict):
        return None
    action = arguments.get("action")
    if (tool == "local_bookshelf" and action in ("list", "search", "read")) or (
        tool == "local_stage" and action == "list"
    ):
        encoded = json.dumps(arguments, ensure_ascii=False)
        if len(encoded) <= 4096:
            return encoded
    return None


async def run_tracked(tool, arguments, operation):
    task_id = uuid4().hex
    with closing(connection()) as db, db:
        db.execute(
            "INSERT INTO tasks VALUES (?, ?, 'running', ?, NULL, ?)",
            (task_id, tool, time.time(), retry_input(tool, arguments)),
        )
    child = asyncio.create_task(operation())
    active[task_id] = child
    status = "failed"
    try:
        result = await asyncio.shield(child)
        status = "failed" if result[0] else "completed"
        return result
    except asyncio.CancelledError:
        status = "cancelled"
        if child.cancelled():
            return True, "工具任务已取消", {}, []
        child.cancel()
        await asyncio.gather(child, return_exceptions=True)
        raise
    finally:
        active.pop(task_id, None)
        with closing(connection()) as db, db:
            db.execute("UPDATE tasks SET status=?, finished=? WHERE id=?", (status, time.time(), task_id))


def require_local(request: Request):
    local = {"127.0.0.1", "::1", "localhost"}
    origin = request.headers.get("origin")
    if request.client is None or request.client.host not in local or request.url.hostname not in local:
        raise HTTPException(403, "仅限本机访问")
    if origin and urlparse(origin).hostname not in local:
        raise HTTPException(403, "仅限本机访问")



def init_task_routes():
    router = APIRouter(prefix="/api/tool-tasks")

    @router.get("")
    async def history(request: Request):
        require_local(request)
        with closing(connection()) as db:
            rows = db.execute("SELECT * FROM tasks ORDER BY started DESC LIMIT 100").fetchall()
        result = []
        for row in rows:
            item = dict(row)
            can_retry = bool(item.pop("retry_input"))
            if item["status"] == "running" and item["id"] not in active:
                item["status"] = "interrupted"
            item["can_retry"] = can_retry and item["status"] in {"failed", "interrupted"} and not LIVE
            result.append(item)
        return result

    @router.post("/{task_id}/cancel")
    async def cancel(task_id: str, request: Request):
        require_local(request)
        task = active.get(task_id)
        if task is None or not task.cancel():
            raise HTTPException(409, "任务已结束")
        return {"accepted": True}

    @router.post("/{task_id}/retry")
    async def retry(task_id: str, request: Request):
        require_local(request)
        with closing(connection()) as db:
            row = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        if LIVE or row is None or not row["retry_input"] or row["status"] not in {"failed", "running"} or task_id in active:
            raise HTTPException(409, "此任务无法重试")
        from .media.tools import execute_media_tool

        tool, arguments = row["tool"], json.loads(row["retry_input"])
        if not retry_input(tool, arguments):
            raise HTTPException(409, "此任务无法重试")
        failed, content, _, _ = await run_tracked(tool, arguments, lambda: execute_media_tool(tool, arguments))
        return {"success": not failed, "result": content[:12000]}

    return router
