import asyncio
from contextlib import closing

from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.open_llm_vtuber import task_history


def test_cancelling_one_tool_preserves_other_work(tmp_path, monkeypatch):
    monkeypatch.setattr(task_history, "DB_PATH", tmp_path / "tasks.sqlite3")

    async def scenario():
        async def wait():
            await asyncio.Event().wait()

        async def finish():
            return False, "ok", {}, []

        first = asyncio.create_task(task_history.run_tracked("test", {}, wait))
        await asyncio.sleep(0)
        task_id, child = next(iter(task_history.active.items()))
        child.cancel()
        second = await task_history.run_tracked("test", {}, finish)
        assert second[0] is False
        assert (await first)[1] == "工具任务已取消"
        with closing(task_history.connection()) as db:
            assert db.execute("SELECT status FROM tasks WHERE id=?", (task_id,)).fetchone()[0] == "cancelled"

    asyncio.run(scenario())


def test_local_history_and_retry(tmp_path, monkeypatch):
    monkeypatch.setattr(task_history, "DB_PATH", tmp_path / "tasks.sqlite3")
    monkeypatch.setattr(task_history, "LIVE", False)

    async def fail():
        return True, "failed", {}, []

    asyncio.run(task_history.run_tracked("local_stage", {"action": "list"}, fail))
    asyncio.run(task_history.run_tracked("local_stage", {"action": "play"}, fail))
    app = FastAPI()
    app.include_router(task_history.init_task_routes())
    with TestClient(app, base_url="http://localhost", client=("127.0.0.1", 50000)) as client:
        response = client.get("/api/tool-tasks")
        assert response.status_code == 200
        play, listed = response.json()
        assert play["can_retry"] is False
        assert listed["can_retry"] is True
        assert "retry_input" not in listed
        assert client.get("/api/tool-tasks", headers={"Origin": "https://example.com"}).status_code == 403
        assert client.post(f"/api/tool-tasks/{play['id']}/retry").status_code == 409
        assert client.post(f"/api/tool-tasks/{listed['id']}/retry").json()["success"] is True
        assert client.get("/api/tool-tasks").json()[0]["status"] == "completed"
