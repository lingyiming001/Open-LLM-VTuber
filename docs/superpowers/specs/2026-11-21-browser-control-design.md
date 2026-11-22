# Browser Control Reliability and Placement Design

## Intent

When a local user explicitly asks the character to open Baidu or provides an HTTP(S) URL, the browser should navigate before the model has a chance to answer in prose. The controls belong with Extensions, not general Settings.

## Goals

- Recognize explicit `打开百度` requests and direct HTTP(S) URLs.
- Invoke the already-registered `local_browser` tool before model generation.
- Keep normal conversational browser-tool use unchanged.
- Render the existing Computer use panel inside the Extensions drawer and remove it from Settings.

## Non-goals

- Do not infer arbitrary site names, bypass the existing local/live/enablement gates, or change browser permissions.

## Approach

1. Add a small, testable request-to-URL resolver and have `ConversationGraph` enqueue a `local_browser.navigate` call when that resolver returns a URL and the tool is available.
2. Reuse `ComputerUse` in `ExtensionDrawer`; remove the Settings tab and its special drawer width.

This direct preflight is selected over prompt-only guidance because the observed `qwen-max` response skipped the registered tool entirely.
