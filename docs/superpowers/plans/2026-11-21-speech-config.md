# Speech configuration implementation plan

Goal: Generate configuration before model initialization and unify speech factories without changing enabled providers.
Architecture: Standard-library bootstrap; lazy registry-based factories; existing Pydantic schemas and engine_options().
Spec: docs/superpowers/specs/2026-11-21-speech-config-design.md
Execution: Inline in this session, as requested by the user. Preserve existing uncommitted work; no commits requested.

- [x] Test bootstrap in temporary directories: generated annotated YAML, no overwrite, import without SDKs, CLI generation exits without initializing server.
- [x] Implement config_bootstrap.py and early run_server.py argument handling; explicit --init-config and --config-language, normal missing configuration exits.
- [x] Test factory mapping, defaults, lazy import and missing dependencies; replace ASR and TTS branch factories with registries and constructor option adapters.
- [x] Test selected ASR options and missing blocks; unify engine_options and service initialization; preserve custom TTS engines.
- [x] Document manual configuration and template options; validate current configuration and templates; run all tests, Ruff and compile checks.

Review focus: no overwrite including concurrent creation; runpy launch path; Azure api_key alias; optional null constructor values; custom TTS compatibility.

Verification: 44 tests passed; Ruff, compileall and git diff --check passed. Current conf.yaml validated with sherpa_onnx_asr and piper_tts. Runtime restarted successfully (PID 8281); /api/control returned HTTP 200. Independent review found no actionable correctness defects; its 11 speech configuration tests passed.
