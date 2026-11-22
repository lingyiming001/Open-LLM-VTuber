# 前端状态归并与 WebSocket 协议适配

## 目标

在不改变现有界面、WebSocket 协议和 Electron 行为的前提下，减少 `App.tsx` 的 Provider 嵌套，并让 WebSocket 消息处理只做协议适配与副作用调度。

## 方案选择

采用渐进式三 Store 方案：

1. `connection-store` 管理 WebSocket 地址、基础 URL 和连接状态；
2. `session-store` 管理角色配置、Live2D 模型、会话/历史和群聊身份；
3. `runtime-store` 管理 AI 状态、字幕、后端合成完成标记和浏览器视图。

保留 VAD、摄像头、屏幕采集、模式切换及音频任务队列等直接拥有浏览器/Electron 生命周期或设备副作用的 Provider/服务。聊天消息暂不迁移，避免本次改变流式消息合并行为。

全量 Zustand 迁移会同时触及设备权限和流式渲染，风险过高；只拆消息 handler 则无法减少跨域状态与 Provider 嵌套。因此选择上述方案。

## 改动

1. 在 `src/renderer/src/stores/` 新建三个带类型 action 的 Zustand store，并将原有 Context hook 保留为兼容壳，供未迁移组件继续使用。
2. `App.tsx` 移除已迁移状态的 Provider；其余 Provider 用 `AppProviders` 组件集中声明，保持顺序可读。
3. 把 `WebSocketHandler` 的 switch 分为无副作用的 store 更新与音频队列、toast、VAD 等明确副作用；它不再保存连接、角色、AI 状态或字幕的 React state。
4. `WebSocketService` 的共享类型移至中立的 `types/` 模块，避免 service 依赖 Context。
5. 补充 store 的状态转换测试，以及 WebSocket 消息到 store action 的协议适配测试。

## 边界

- 不修改后端消息字段、不增加网络请求、不变更 UI 文案。
- 不改变 localStorage 的键：`wsUrl`、`baseUrl`、`modelInfo`。
- 不迁移聊天消息、音频队列、VAD/摄像头/屏幕采集与 Electron 模式状态。
- 不在本次删除旧 Context 文件；兼容 hook 在组件迁移完成前继续可用。

## 验证

测试以下行为：连接地址持久化与重连、`set-model-and-conf` 同步角色和模型、连接/AI/字幕状态转换，以及未知 WebSocket 消息不会改变 store。运行前端单元测试、`npm run typecheck` 和 `npm run build`。
