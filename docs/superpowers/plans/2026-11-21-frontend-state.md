# Frontend state consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate cross-screen React state into three typed Zustand stores while making WebSocketHandler a protocol adapter.

**Architecture:** Zustand stores own connection, session and runtime data. Existing Context hooks become compatibility adapters during the migration, while device-oriented Providers remain. WebSocketHandler updates store actions and retains only explicit external side effects such as audio queueing, VAD control and toasts.

**Tech Stack:** React 18, TypeScript, Zustand 5, RxJS, Vite.

**Spec:** `docs/superpowers/specs/2026-11-21-frontend-state-design.md`

## Global Constraints

- Preserve the WebSocket wire protocol and current visible UI behavior.
- Preserve localStorage keys `wsUrl`, `baseUrl` and `modelInfo`.
- Do not migrate VAD, camera, screen-capture, mode, audio queue or streaming chat-message state in this change.
- Work only in the `frontend` submodule; preserve its existing uncommitted changes.

## Review Focus

- A reconnect must use the latest persisted WebSocket URL and expose the matching state.
- A backend model URL without an HTTP prefix must still be resolved against the current base URL.
- `waiting` must retain its current timeout and must not override `thinking-speaking`.
- Unknown or malformed WebSocket events must not corrupt any store.
- Existing components using legacy Context hooks must remain functional during the migration.

---

### Task 1: Establish store and test foundation

**Files:**
- Create: `frontend/src/renderer/src/stores/connection-store.ts`
- Create: `frontend/src/renderer/src/stores/session-store.ts`
- Create: `frontend/src/renderer/src/stores/runtime-store.ts`
- Create: `frontend/src/renderer/src/stores/__tests__/state-stores.test.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `useConnectionStore`, `useSessionStore`, `useRuntimeStore` with selector-safe state and actions.

- [ ] **Step 1: Add the smallest existing-project test runner and write failing store tests**

Test direct store actions for endpoint changes, session model/config updates, and runtime state transitions including the `waiting` timeout guard.

- [ ] **Step 2: Run the store test to verify it fails because the stores do not exist**

Run: `npm --prefix frontend test -- state-stores`
Expected: FAIL because the test command or store modules are absent.

- [ ] **Step 3: Implement the three typed stores**

Keep persistence in explicit store actions using the existing localStorage semantics; expose actions rather than mutable state setters where an invariant exists.

- [ ] **Step 4: Run the store test and TypeScript check**

Run: `npm --prefix frontend test -- state-stores && npm --prefix frontend run typecheck`
Expected: PASS.

### Task 2: Preserve legacy hooks while switching their source of truth

**Files:**
- Modify: `frontend/src/renderer/src/context/websocket-context.tsx`
- Modify: `frontend/src/renderer/src/context/ai-state-context.tsx`
- Modify: `frontend/src/renderer/src/context/character-config-context.tsx`
- Modify: `frontend/src/renderer/src/context/live2d-config-context.tsx`
- Modify: `frontend/src/renderer/src/context/subtitle-context.tsx`
- Test: `frontend/src/renderer/src/stores/__tests__/state-stores.test.ts`

**Interfaces:**
- Consumes: stores from Task 1.
- Produces: existing `useWebSocket`, `useAiState`, `useConfig`, `useLive2DConfig` and `useSubtitle` APIs backed by stores.

- [ ] **Step 1: Write failing compatibility tests**

Assert that legacy hook-facing adapter functions expose the same values after store actions, including model URL normalization and character configuration updates.

- [ ] **Step 2: Run the targeted tests and verify failure**

Run: `npm --prefix frontend test -- state-stores`
Expected: FAIL because legacy adapters still own isolated React state.

- [ ] **Step 3: Replace migrated Context ownership with store-backed compatibility adapters**

Keep Provider exports temporarily as no-op wrappers where needed; do not change component call sites outside the listed files.

- [ ] **Step 4: Run the targeted tests and typecheck**

Run: `npm --prefix frontend test -- state-stores && npm --prefix frontend run typecheck`
Expected: PASS.

### Task 3: Turn WebSocketHandler into a protocol adapter and flatten App providers

**Files:**
- Create: `frontend/src/renderer/src/services/websocket-protocol.ts`
- Create: `frontend/src/renderer/src/services/__tests__/websocket-protocol.test.ts`
- Modify: `frontend/src/renderer/src/services/websocket-handler.tsx`
- Modify: `frontend/src/renderer/src/services/websocket-service.tsx`
- Modify: `frontend/src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: store actions from Task 1 and compatibility hooks from Task 2.
- Produces: `applyWebSocketMessage(message)` for store-only message effects; WebSocketHandler retains external side effects.

- [ ] **Step 1: Write failing protocol-adapter tests**

Cover `set-model-and-conf`, `control`, `full-text`, connection state events and an unknown message; assert only their intended store transitions.

- [ ] **Step 2: Run the protocol test and verify failure**

Run: `npm --prefix frontend test -- websocket-protocol`
Expected: FAIL because the pure protocol adapter does not exist.

- [ ] **Step 3: Implement the pure protocol adapter and reduce WebSocketHandler to subscriptions plus explicit side effects**

Move shared event type declarations out of Context imports. Keep audio queue, VAD start/stop, toast notifications and chat-message updates in the handler.

- [ ] **Step 4: Introduce AppProviders and remove migrated providers from App.tsx**

Keep Provider order for the retained device/state providers and leave rendered layout unchanged.

- [ ] **Step 5: Run the full frontend verification**

Run: `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build`
Expected: PASS.

## Self-review

- Spec coverage: Tasks 1–3 cover store ownership, legacy compatibility, protocol adaptation, Provider flattening and verification.
- Type consistency: all new public state is accessed through named Zustand hooks/actions; legacy hooks retain their existing names.
- Review focus: each listed failure mode is covered by Task 1 or Task 3 tests.
- Proportion: the plan defines boundaries and test contracts without prescribing component internals.
