"""Persistent scheduled AI text jobs, independent of the browser and chat history."""

import asyncio
import logging
import time
from contextlib import aclosing, closing
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .broadcast import LIVE
from .task_history import connection, require_local

logger = logging.getLogger(__name__)


class ScheduleInput(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    prompt: str = Field(min_length=1, max_length=4000)
    seconds: int = Field(strict=True, ge=1, le=31536000)
    repeat: bool = False


def create_schedule(payload: ScheduleInput):
    if LIVE or not payload.title.strip() or not payload.prompt.strip():
        raise ValueError("请输入任务名称和指令，并在普通模式下创建")
    job = {
        "id": uuid4().hex, "title": payload.title.strip(), "prompt": payload.prompt.strip(),
        "due": time.time() + payload.seconds, "period": 86400 if payload.repeat else 0,
    }
    with closing(connection()) as db, db:
        db.execute(
            "INSERT INTO scheduled_jobs(id,title,prompt,due,period,status) "
            "VALUES(:id,:title,:prompt,:due,:period,'pending')", job,
        )
    return job


async def run_due_job(context):
    if LIVE:
        return
    now = time.time()
    with closing(connection()) as db, db:
        job = db.execute(
            "UPDATE scheduled_jobs SET status='running' WHERE id=("
            "SELECT id FROM scheduled_jobs WHERE status='pending' AND due<=? ORDER BY due LIMIT 1"
            ") RETURNING *", (now,),
        ).fetchone()
    if job is None:
        return
    status, output = "completed", ""
    try:
        llm = getattr(context.agent_engine, "_llm", None)
        if llm is None:
            raise RuntimeError("当前角色的模型不支持后台任务")
        async def generate():
            async with aclosing(llm.chat_completion(
                [{"role": "user", "content": job["prompt"]}],
                "执行这条用户设置的定时任务，直接返回文本成果。你无法访问外部工具或实时数据，不要编造执行结果。",
            )) as stream:
                result = ""
                async for chunk in stream:
                    if isinstance(chunk, str):
                        result += chunk[:12000 - len(result)]
                    if len(result) >= 12000:
                        break
                return result

        output = await asyncio.wait_for(generate(), timeout=120)
        if not output.strip():
            raise RuntimeError("模型没有返回内容")
    except asyncio.CancelledError:
        status, output = "failed", "后端关闭，执行中断"
        raise
    except Exception:
        logger.exception("Scheduled job failed: %s", job["id"])
        status, output = "failed", "任务执行失败，请检查模型配置及后端日志。"
    finally:
        finished = time.time()
        due = job["due"]
        period = job["period"]
        if period and status == "completed":
            due += period * (max(0, int((finished - due) // period)) + 1)
        with closing(connection()) as db, db:
            db.execute(
                "UPDATE scheduled_jobs SET due=?,status=?,result=?,last_run=? WHERE id=?",
                (due, "pending" if period and status == "completed" else status, output, finished, job["id"]),
            )


def init_schedule_routes(context, app):
    router = APIRouter(prefix="/api/scheduled-tasks", dependencies=[Depends(require_local)])
    worker = None

    async def work():
        while True:
            try:
                await run_due_job(context)
            except Exception:
                logger.exception("Scheduled job worker error")
            await asyncio.sleep(2)

    async def start():
        nonlocal worker
        if not LIVE:
            with closing(connection()) as db, db:
                db.execute("UPDATE scheduled_jobs SET status='failed',result='上次运行已中断' WHERE status='running'")
            worker = asyncio.create_task(work())

    async def stop():
        if worker:
            worker.cancel()
            await asyncio.gather(worker, return_exceptions=True)

    app.add_event_handler("startup", start)
    app.add_event_handler("shutdown", stop)

    @router.get("")
    def listing():
        with closing(connection()) as db:
            return [dict(row) for row in db.execute("SELECT * FROM scheduled_jobs ORDER BY due DESC LIMIT 100")]

    @router.post("")
    def add(payload: ScheduleInput):
        try:
            return create_schedule(payload)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    @router.post("/{job_id}/cancel")
    def cancel(job_id: str):
        with closing(connection()) as db, db:
            updated = db.execute("UPDATE scheduled_jobs SET status='cancelled' WHERE id=? AND status='pending'", (job_id,)).rowcount
        if not updated:
            raise HTTPException(409, "任务已开始或已结束")
        return {"success": True}

    return router
