"""Generate editable configuration using only the Python standard library."""

import argparse
from pathlib import Path

TEMPLATE_ROOT = Path(__file__).resolve().parents[2] / "config_templates"


def generate_config(path: str | Path = "conf.yaml", *, language: str = "zh") -> bool:
    """Create an annotated configuration, never replacing an existing file."""
    if language not in {"zh", "en"}:
        raise ValueError("Configuration language must be zh or en")
    template = TEMPLATE_ROOT / (
        "conf.ZH.default.yaml" if language == "zh" else "conf.default.yaml"
    )
    content = template.read_bytes()
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with target.open("xb") as output:
            output.write(content)
    except FileExistsError:
        return False
    return True


def argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Open-LLM-VTuber Server")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument(
        "--hf_mirror", action="store_true", help="Use Hugging Face mirror"
    )
    parser.add_argument(
        "--init-config",
        nargs="?",
        const="conf.yaml",
        metavar="PATH",
        help="Generate configuration and exit (default: conf.yaml; never overwrite)",
    )
    parser.add_argument(
        "--config-language",
        choices=("zh", "en"),
        default="zh",
        help="Language of generated configuration (default: zh)",
    )
    return parser


def prepare_config(argv=None) -> bool:
    """Return True if startup should exit after the configuration step."""
    args = argument_parser().parse_args(argv)
    target = Path(args.init_config or "conf.yaml")
    if args.init_config is None and target.exists():
        return False
    created = generate_config(target, language=args.config_language)
    if created:
        print(f"已生成配置 / Configuration created: {target.resolve()}")
        print(
            "请先编辑 character_config.asr_config 和 tts_config，填写引擎、模型路径或 API 参数，再重新启动。"
        )
        print("Edit the ASR/TTS engine options in this file, then restart the server.")
    else:
        print(
            f"配置已存在，未覆盖 / Existing configuration preserved: {target.resolve()}"
        )
    return True
