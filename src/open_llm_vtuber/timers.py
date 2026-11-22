"""Persist local one-shot reminders and expose them to the assistant."""

import time
from contextlib import closing
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .task_history import connection, require_local

DESCRIPTION = (
    "管理本项目的定时提醒。仅在用户明确要求时用 create 创建，"
    "seconds 是从现在起的秒数，title 是提醒内容；list 查看现有提醒。"
    "提醒到期只显示通知。用户要求到期让 AI 执行文字任务时用 schedule，传入 prompt 和 repeat（是否每天）。"
)
SCHEMA = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["create", "list", "schedule"]},
        "title": {"type": "string", "maxLength": 160},
        "prompt": {"type": "string", "maxLength": 4000},
        "repeat": {"type": "boolean"},
        "seconds": {"type": "integer", "minimum": 1, "maximum": 31536000},
    },
    "required": ["action"],
    "additionalProperties": False,
}


class TimerInput(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    seconds: int = Field(strict=True, ge=1, le=31536000)


def list_timers():
    with closing(connection()) as db:
        rows = db.execute("SELECT id, title, due, status FROM timers ORDER BY due").fetchall()
        return [dict(row) | {"status": "due" if row["status"] == "pending" and row["due"] <= time.time() else row["status"]} for row in rows]


def create_timer(payload: TimerInput):
    title = payload.title.strip()
    if not title:
        raise ValueError("请输入提醒内容")
    item = {"id": uuid4().hex, "title": title, "due": time.time() + payload.seconds, "status": "pending"}
    with closing(connection()) as db, db:
        db.execute("INSERT INTO timers VALUES (:id, :title, :due, :status)", item)
    return item


def init_timer_routes():
    from fastapi import Depends

    router = APIRouter(prefix="/api/timers", dependencies=[Depends(require_local)])

    @router.get("")
    def listing():
        return list_timers()

    @router.post("")
    def create(payload: TimerInput):
        try:
            return create_timer(payload)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    @router.post("/{timer_id}/dismiss")
    def dismiss(timer_id: str):
        with closing(connection()) as db, db:
            updated = db.execute(
                "UPDATE timers SET status = 'dismissed' WHERE id = ? AND status = 'pending'",
                (timer_id,),
            ).rowcount
        if not updated:
            raise HTTPException(404, "提醒已处理或不存在")
        return {"success": True}

    return router
