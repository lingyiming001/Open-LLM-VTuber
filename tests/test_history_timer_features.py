from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.open_llm_vtuber import chat_history_manager, task_history, timers


def test_clear_is_scoped_and_keeps_replacement(tmp_path, monkeypatch):
    monkeypatch.setattr(chat_history_manager, "HISTORY_ROOT", str(tmp_path))
    older = chat_history_manager.create_new_history("mao")
    fresh = chat_history_manager.create_new_history("mao")
    other = chat_history_manager.create_new_history("other")
    assert len(chat_history_manager.get_history_list("mao")) == 2
    assert chat_history_manager.clear_chat_histories("mao", fresh) == (1, 0)
    assert not (Path(tmp_path) / "mao" / f"{older}.json").exists()
    assert (Path(tmp_path) / "mao" / f"{fresh}.json").exists()
    assert (Path(tmp_path) / "other" / f"{other}.json").exists()


def test_timer_survives_requests_and_can_be_acknowledged(tmp_path, monkeypatch):
    monkeypatch.setattr(task_history, "DB_PATH", tmp_path / "tasks.sqlite3")
    clock = SimpleNamespace(time=lambda: 100.0)
    monkeypatch.setattr(timers, "time", clock)
    app = FastAPI()
    app.include_router(timers.init_timer_routes())
    with TestClient(app, base_url="http://localhost", client=("127.0.0.1", 50000)) as client:
        created = client.post("/api/timers", json={"title": "检查进度", "seconds": 60})
        assert created.status_code == 200
        timer = created.json()
        assert timer["due"] == 160
        assert client.get("/api/timers").json()[0]["status"] == "pending"
        clock.time = lambda: 161.0
        assert client.get("/api/timers").json()[0]["status"] == "due"
        assert client.post(f"/api/timers/{timer['id']}/dismiss").status_code == 200
        assert client.get("/api/timers").json()[0]["status"] == "dismissed"
        assert client.post("/api/timers", json={"title": "无效", "seconds": 0}).status_code == 422


def test_scheduled_job_runs_and_persists_result(tmp_path, monkeypatch):
    import asyncio
    from contextlib import closing
    from src.open_llm_vtuber import scheduled_tasks

    monkeypatch.setattr(task_history, "DB_PATH", tmp_path / "tasks.sqlite3")
    monkeypatch.setattr(scheduled_tasks, "LIVE", False)
    clock = SimpleNamespace(time=lambda: 100.0)
    monkeypatch.setattr(scheduled_tasks, "time", clock)
    job = scheduled_tasks.create_schedule(scheduled_tasks.ScheduleInput(
        title="复盘", prompt="生成复盘提纲", seconds=3, repeat=True,
    ))

    class Model:
        async def chat_completion(self, messages, system):
            assert messages[0]["content"] == "生成复盘提纲"
            yield "复盘提纲"

    context = SimpleNamespace(agent_engine=SimpleNamespace(_llm=Model()))
    clock.time = lambda: 104.0
    asyncio.run(scheduled_tasks.run_due_job(context))
    with closing(task_history.connection()) as db:
        row = db.execute("SELECT * FROM scheduled_jobs WHERE id=?", (job["id"],)).fetchone()
        assert (row["status"], row["result"], row["due"]) == ("pending", "复盘提纲", 86503)
