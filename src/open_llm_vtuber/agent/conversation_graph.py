"""Bounded LangGraph conversation flow, shared by all stateless providers.

Memory remains owned by AgentInterface; graph state belongs to a single turn.
Custom streaming carries text and existing MCP progress events to the TTS pipeline.
"""

import asyncio
import json
from contextlib import aclosing
from typing import Any, TypedDict
from uuid import uuid4
from loguru import logger

from langgraph.graph import END, START, StateGraph

from .stage_stream import StageStream
from ..media.commands import local_command
from .browser_control import browser_navigation_url
from ..mcpp.json_detector import StreamJSONDetector
from ..mcpp.types import ToolCallObject, ToolCallFunctionObject


class TurnState(TypedDict):
    messages: list[dict[str, Any]]
    calls: list
    rounds: int
    prompt_mode: bool
    seen_inline: set[str]
    retry: bool
    direct: bool
    emit: Any


class ConversationGraph:
    def __init__(
        self, llm, system, tools, executor, remember, *, prompt="", max_tool_rounds=8, direct_state=None
    ):
        self.direct_state = direct_state if direct_state is not None else {}
        self.llm = llm
        self.system = system
        self.tools = tools
        self.executor = executor
        self.remember = remember
        self.prompt = prompt
        self.max_tool_rounds = max_tool_rounds
        graph = StateGraph(TurnState)
        graph.add_node("preflight", self._preflight)
        graph.add_node("model", self._model)
        graph.add_node("tools", self._tools)
        graph.add_edge(START, "preflight")
        graph.add_conditional_edges("preflight", self._preflight_route)
        graph.add_conditional_edges("model", self._route)
        graph.add_conditional_edges("tools", lambda state: END if state.get("direct") else "model")
        self.graph = graph.compile()

    @staticmethod
    def _message_text(content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_parts = [
                str(part.get("text", ""))
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            ]
            return text_parts[-1] if text_parts else ""
        return ""

    def _preflight_route(self, state: TurnState):
        return "tools" if state["calls"] else "model"

    def _preflight(self, state: TurnState):
        user = next((m for m in reversed(state['messages']) if m.get('role') == 'user'), {})
        content = user.get('content')
        has_images = isinstance(content, list) and any(p.get('type') == 'image_url' for p in content if isinstance(p, dict))
        enabled = {t.get('function', {}).get('name') for t in self.tools}
        prior_users = [self._message_text(m.get('content')).strip().rstrip('。！!') for m in state['messages'] if m.get('role') == 'user'][:-1]
        selection_requests = {'阅读书籍', '朗读书籍', '读一本书', '换一本书', '换一本书籍', '换本书', '我想读书'}
        if prior_users and prior_users[-1] in selection_requests:
            self.direct_state['awaiting_book'] = True
        user_text = self._message_text(content).strip().rstrip('。！!')
        if not has_images and user_text in {'阅读书籍', '朗读书籍', '读一本书', '换一本书', '换一本书籍', '换本书', '我想读书'}:
            self.direct_state['awaiting_book'] = True
        try:
            command = None if has_images else local_command(self._message_text(content), enabled, self.direct_state)
        except (OSError, ValueError):
            command = None
        if command and self.executor:
            name, args = command
            logger.info('Local command route: {} (no LLM request)', name)
            call = ToolCallObject(id=f"call_{uuid4().hex}", function=ToolCallFunctionObject(name=name, arguments=json.dumps(args, ensure_ascii=False)))
            return {'calls': [call], 'direct': True}
        browser_enabled = any(
            tool.get("function", {}).get("name") == "local_browser"
            for tool in self.tools
        )
        if not browser_enabled:
            return {"calls": []}
        user_message = next(
            (message for message in reversed(state["messages"]) if message.get("role") == "user"),
            None,
        )
        url = browser_navigation_url(
            self._message_text(user_message.get("content")) if user_message else ""
        )
        if not url:
            return {"calls": []}
        call = ToolCallObject(
            id=f"call_{uuid4().hex}",
            function=ToolCallFunctionObject(
                name="local_browser",
                arguments=json.dumps({"action": "navigate", "url": url}),
            ),
        )
        messages = list(state["messages"])
        messages.append(
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments,
                        },
                    }
                ],
            }
        )
        return {
            "messages": messages,
            "calls": [call],
        }

    def _route(self, state):
        if state.get("retry"):
            return "model"
        if state["calls"]:
            if state["rounds"] >= self.max_tool_rounds:
                raise RuntimeError("Agent exceeded max_tool_rounds")
            return "tools"
        return END

    async def _model(self, state: TurnState):
        writer = state["emit"]
        prompt_mode = state["prompt_mode"]
        system = self.system
        if prompt_mode and self.prompt:
            system += "\n\n" + self.prompt
        detector = StreamJSONDetector() if prompt_mode else None
        stage = StageStream()
        text = ""
        calls = []
        messages = list(state["messages"])
        seen_inline = set(state["seen_inline"])
        kwargs = {"tools": self.tools} if self.tools and not prompt_mode else {}
        async with aclosing(
            self.llm.chat_completion(messages, system, **kwargs)
        ) as stream:
            async for event in stream:
                if event == "__API_NOT_SUPPORT_TOOLS__":
                    # Retry once without native tools; subsequent turns reuse provider capability.
                    return {"prompt_mode": True, "calls": [], "retry": True}
                if isinstance(event, list):
                    calls.extend(event)
                    continue
                if not isinstance(event, str):
                    continue
                event = stage.feed(event)
                text += event
                if event:
                    writer(event)
                if detector and (detected := detector.process_chunk(event)):
                    calls = self.executor.process_tool_from_prompt_json(
                        detected if isinstance(detected, list) else [detected]
                    )
                    if calls:
                        break
        tail = stage.finish()
        if tail:
            text += tail
            writer(tail)
        if self.tools and self.executor and not prompt_mode:
            stage_enabled = any(
                t.get("function", {}).get("name") == "local_stage" for t in self.tools
            )
            if stage_enabled:
                for args in stage.arguments:
                    encoded = json.dumps(args, ensure_ascii=False, sort_keys=True)
                    if encoded in seen_inline or len(seen_inline) >= 8:
                        continue
                    seen_inline.add(encoded)
                    calls.append(
                        ToolCallObject(
                            id=f"call_{uuid4().hex}",
                            function=ToolCallFunctionObject(
                                name="local_stage", arguments=encoded
                            ),
                        )
                    )
        if text:
            self.remember(text, "assistant")
        if calls and not prompt_mode:
            messages.append(
                {
                    "role": "assistant",
                    "content": text or None,
                    "tool_calls": [
                        {
                            "id": c.id,
                            "type": "function",
                            "function": {
                                "name": c.function.name,
                                "arguments": c.function.arguments,
                            },
                        }
                        for c in calls
                    ],
                }
            )
        elif calls:
            messages.append({"role": "assistant", "content": text})
        return {
            "messages": messages,
            "calls": calls,
            "seen_inline": seen_inline,
            "retry": False,
        }

    async def _tools(self, state: TurnState):
        writer = state["emit"]
        if self.executor is None:
            raise RuntimeError("Tool calls require a configured ToolExecutor")
        results = None
        mode = "Prompt" if state["prompt_mode"] else "OpenAI"
        async with aclosing(
            self.executor.execute_tools(state["calls"], caller_mode=mode)
        ) as stream:
            async for event in stream:
                if event.get("type") == "final_tool_results":
                    results = event.get("results", [])
                else:
                    writer(event)
        if not results:
            raise RuntimeError("ToolExecutor returned no tool results")
        for call, tool_result in zip(state["calls"], results):
            name = call.function.name if isinstance(call, ToolCallObject) else call.get("name")
            if name != "local_bookshelf":
                continue
            try:
                book_result = json.loads(tool_result.get("content", ""))
                if book_result.get("passages") and isinstance(book_result.get("next_start"), int):
                    self.direct_state.update(book=book_result["book"], next_start=book_result["next_start"], awaiting_book=False)
            except (TypeError, ValueError):
                pass
        if state.get("direct"):
            content = results[0].get("content", "")
            try:
                result = json.loads(content)
            except (TypeError, ValueError):
                result = {}
            if result.get("passages"):
                self.direct_state.update(book=result["book"], next_start=result["next_start"], awaiting_book=False)
                reply = "\n".join(result["passages"])
                memory = f"已读取《{result['book']}》第 {result['start']} 至 {result['next_start'] - 1} 段。"
            elif "passages" in result:
                reply = memory = "这本书已经读完了。"
            elif result.get("dispatched"):
                reply = memory = {"play": "正在尝试打开。", "pause": "已发送暂停指令。", "resume": "已发送继续播放指令。", "stop": "已发送停止指令。", "next": "已发送切换下一项的指令。", "previous": "已发送切换上一项的指令。"}.get(result['dispatched'], "已发送操作指令。")
            else:
                reply = memory = "这次操作没有完成，请检查文件或服务后重试。"
            self.remember(memory, "assistant")
            writer(reply)
            return {"rounds": state["rounds"] + 1, "calls": []}
        messages = list(state["messages"])
        if state["prompt_mode"]:
            messages.append(
                {
                    "role": "user",
                    "content": "\n".join(str(r.get("content", "")) for r in results),
                }
            )
        else:
            messages.extend(results)
        return {"messages": messages, "rounds": state["rounds"] + 1, "calls": []}

    async def stream(self, messages):
        # Explicit writer avoids contextvars propagation requirements on Python 3.10.
        queue = asyncio.Queue()
        done = object()

        async def run():
            try:
                await self.graph.ainvoke(
                    {
                        "messages": list(messages),
                        "calls": [],
                        "rounds": 0,
                        "prompt_mode": bool(
                            self.tools and not getattr(self.llm, "support_tools", False)
                        ),
                        "seen_inline": set(),
                        "retry": False,
                        "direct": False,
                        "emit": queue.put_nowait,
                    },
                    config={"recursion_limit": 2 * self.max_tool_rounds + 5},
                )
            finally:
                queue.put_nowait(done)

        task = asyncio.create_task(run())
        try:
            while True:
                event = await queue.get()
                if event is done:
                    break
                yield event
            await task
        finally:
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)
