# React + TypeScript frontend

Source restored from the exact upstream commit that produced the installed build: 3d57a9a0125a0ca13e5d096f7092e4e494ed389e.

- `npm install --ignore-scripts`
- `npm run dev`: Vite development server at http://localhost:3000; start Python backend on 12393 first.
- `npm run typecheck:web`: TypeScript validation.
- `npm run build`: validate types and generate dist/web.

Restart Python after building. It serves dist/web when present, with the old root build as a fallback. Edit src/renderer/src, not generated assets. UI components are in components; WebSocket and playback logic are in context and hooks; Live2D SDK is in src/renderer/WebSDK. libs contains browser runtime assets.

Scene/media, broadcast and action adapters are currently served by Python and also proxied in development. Subtitle playback integration lives in the typed use-audio-task hook; timing helper remains a backend-served adapter. Existing interface.css remains active. This migration does not constitute a UI redesign.

frontend remains a Git submodule. Source modifications must be committed inside it before the parent repository can reference them in a shared checkout.
