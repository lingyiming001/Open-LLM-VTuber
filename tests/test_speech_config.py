import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]


def test_generation_and_no_overwrite():
    from src.open_llm_vtuber.config_bootstrap import generate_config

    with TemporaryDirectory() as directory:
        path = Path(directory) / "conf.yaml"
        assert generate_config(path, language="zh")
        original = path.read_bytes()
        assert b"#" in original
        assert "asr_config" in yaml.safe_load(original)["character_config"]
        assert not generate_config(path, language="en")
        assert path.read_bytes() == original


def test_bootstrap_imports_no_model_sdk():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; import src.open_llm_vtuber.config_bootstrap; "
            'assert not any(m in sys.modules for m in ["torch", "onnxruntime", "sherpa_onnx", "src.open_llm_vtuber.server"])',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def test_init_cli_exits_without_server():
    with TemporaryDirectory() as directory:
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "run_server.py"),
                "--init-config",
                "--config-language",
                "zh",
            ],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, result.stderr
        assert (Path(directory) / "conf.yaml").exists()
        assert "Initializing" not in result.stdout + result.stderr


def test_default_start_generates_and_exits():
    with TemporaryDirectory() as directory:
        result = subprocess.run(
            [sys.executable, str(ROOT / "run_server.py")],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, result.stderr
        assert (Path(directory) / "conf.yaml").exists()
        assert "Initializing" not in result.stdout + result.stderr


def test_asr_selected_block_required():
    from src.open_llm_vtuber.config_manager.asr import ASRConfig

    with pytest.raises(ValueError, match="azure_asr"):
        ASRConfig(asr_model="azure_asr")


def test_asr_options_and_azure_mapping():
    from src.open_llm_vtuber.config_manager.asr import ASRConfig
    from src.open_llm_vtuber.asr.asr_factory import ASRFactory

    config = ASRConfig(
        asr_model="azure_asr", azure_asr={"api_key": "test", "region": "eastus"}
    )
    from src.open_llm_vtuber.asr.asr_interface import ASRInterface

    class Fake(ASRInterface):
        def __init__(self, subscription_key, region, languages):
            self.key = subscription_key

        def transcribe_np(self, audio):
            return ""

    with patch(
        "src.open_llm_vtuber.asr.asr_factory.import_module",
        return_value=SimpleNamespace(VoiceRecognition=Fake),
    ):
        engine = ASRFactory.get_asr_system("azure_asr", **config.engine_options())
    assert engine.key == "test"


def test_tts_factory_preserves_constructor_defaults():
    from src.open_llm_vtuber.tts.tts_factory import TTSFactory
    from src.open_llm_vtuber.tts.tts_interface import TTSInterface

    class Fake(TTSInterface):
        def __init__(self, voice="default"):
            self.voice = voice

        def generate_audio(self, text, file_name_no_ext=None):
            return ""

    with patch(
        "src.open_llm_vtuber.tts.tts_factory.import_module",
        return_value=SimpleNamespace(TTSEngine=Fake),
    ):
        engine = TTSFactory.get_tts_engine("edge_tts")
    assert engine.voice == "default"


def test_asr_dependency_error_names_engine():
    from src.open_llm_vtuber.asr.asr_factory import ASRFactory

    with patch(
        "src.open_llm_vtuber.asr.asr_factory.import_module",
        side_effect=ModuleNotFoundError(name="faster_whisper"),
    ):
        with pytest.raises(ValueError, match="faster_whisper"):
            ASRFactory.get_asr_system("faster_whisper")


def test_init_cli_preserves_existing_file():
    with TemporaryDirectory() as directory:
        path = Path(directory) / "conf.yaml"
        path.write_text("# customized\n")
        result = subprocess.run(
            [sys.executable, str(ROOT / "run_server.py"), "--init-config"],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, result.stderr
        assert path.read_text() == "# customized\n"


def test_tts_unknown_engine_and_missing_dependency():
    from src.open_llm_vtuber.tts.tts_factory import TTSFactory

    with pytest.raises(ValueError, match="Invalid TTS"):
        TTSFactory.get_tts_engine("../invalid")
    with patch(
        "src.open_llm_vtuber.tts.tts_factory.import_module",
        side_effect=ModuleNotFoundError(name="voice_sdk"),
    ):
        with pytest.raises(ValueError, match="edge_tts.*voice_sdk"):
            TTSFactory.get_tts_engine("edge_tts")


def test_templates_match_all_builtin_constructor_options():
    """Check every documented engine's constructor contract without loading SDKs."""
    import ast
    from src.open_llm_vtuber.config_manager.asr import ASRConfig
    from src.open_llm_vtuber.config_manager.tts import TTSConfig
    from src.open_llm_vtuber.asr.asr_factory import ASR_ENGINES
    from src.open_llm_vtuber.tts.tts_factory import TTS_ENGINES

    for template in ["conf.default.yaml", "conf.ZH.default.yaml"]:
        config = yaml.safe_load((ROOT / "config_templates" / template).read_text())[
            "character_config"
        ]
        for kind, schema, registry in [
            ("asr", ASRConfig, ASR_ENGINES),
            ("tts", TTSConfig, TTS_ENGINES),
        ]:
            validated = schema.model_validate(config[kind + "_config"])
            for name, module in registry.items():
                options = getattr(validated, name, None)
                if options is None:
                    continue
                keys = set(
                    options.model_dump() if hasattr(options, "model_dump") else options
                )
                if name == "azure_asr":
                    keys.remove("api_key")
                    keys.add("subscription_key")
                filename = module if kind == "asr" else name
                tree = ast.parse(
                    (
                        ROOT / "src/open_llm_vtuber" / kind / (filename + ".py")
                    ).read_text()
                )
                constructor = next(
                    n
                    for n in ast.walk(tree)
                    if isinstance(n, ast.FunctionDef) and n.name == "__init__"
                )
                parameters = {arg.arg for arg in constructor.args.args} - {"self"}
                if not constructor.args.kwarg:
                    assert keys <= parameters, (name, keys - parameters)
