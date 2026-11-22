# Browser Control Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explicit browser-opening requests execute reliably and move their controls into Extensions.

**Architecture:** A pure resolver recognizes Baidu and explicit HTTP(S) URLs. The conversation graph turns that result into the existing `local_browser` navigation tool call before the first model turn. The frontend reuses the existing panel in the extensions drawer.

**Tech Stack:** Python, pytest, React, TypeScript, Chakra UI.

**Spec:** `docs/superpowers/specs/2026-11-21-browser-control-design.md`

## Global Constraints

- Preserve ControlService authorization and enablement checks.
- Do not infer domains other than Baidu or use non-HTTP(S) URLs.

## Review Focus

- Requests without a browser-opening imperative must not navigate.
- Unsafe URL schemes must not navigate.
- Browser tooling absent from a configuration must not produce a call.
- The control panel must no longer appear in Settings.
- The Extensions drawer must retain its existing install and MCP controls.

### Task 1: Reliable browser-navigation preflight

**Files:**
- Create: `src/open_llm_vtuber/agent/browser_control.py`
- Modify: `src/open_llm_vtuber/agent/conversation_graph.py`
- Test: `tests/test_browser_control.py`, `tests/test_conversation_graph.py`

- [ ] Write failing resolver and graph tests.
- [ ] Run the focused tests and observe failure before implementation.
- [ ] Implement URL resolution and preflight tool call construction.
- [ ] Run focused tests and the control/graph regression tests.

### Task 2: Move Computer use into Extensions

**Files:**
- Modify: `frontend/src/renderer/src/components/sidebar/extension-drawer.tsx`
- Modify: `frontend/src/renderer/src/components/sidebar/setting/setting-ui.tsx`

- [ ] Reuse `ComputerUse` in Extensions and remove its Settings tab.
- [ ] Run frontend typecheck and production build.
