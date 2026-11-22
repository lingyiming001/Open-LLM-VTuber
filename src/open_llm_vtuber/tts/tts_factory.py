from importlib import import_module
from importlib.util import find_spec
import re
from .tts_interface import TTSInterface


TTS_ENGINES = {
    "pyttsx3_tts": "TTSEngine",
    "sherpa_onnx_tts": "TTSEngine",
    "siliconflow_tts": "SiliconFlowTTS",
    "edge_tts": "TTSEngine",
    "cosyvoice_tts": "TTSEngine",
    "openai_tts": "TTSEngine",
    "gpt_sovits_tts": "TTSEngine",
    "spark_tts": "TTSEngine",
    "minimax_tts": "TTSEngine",
    "elevenlabs_tts": "TTSEngine",
    "melo_tts": "TTSEngine",
    "azure_tts": "TTSEngine",
    "coqui_tts": "TTSEngine",
    "cosyvoice2_tts": "TTSEngine",
    "cartesia_tts": "TTSEngine",
    "fish_api_tts": "TTSEngine",
    "piper_tts": "TTSEngine",
    "bark_tts": "TTSEngine",
    "x_tts": "TTSEngine",
}


class TTSFactory:
    @staticmethod
    def module_name(engine_type: str) -> str:
        if not re.fullmatch(r"[a-z][a-z0-9_]*_tts", engine_type):
            raise ValueError(f"Invalid TTS engine name: {engine_type}")
        module = f"{__package__}.{engine_type}"
        if find_spec(module) is None:
            raise ValueError(f"Unknown TTS engine: {engine_type}")
        return module

    @staticmethod
    def get_tts_engine(engine_type: str, **kwargs) -> TTSInterface:
        try:
            return TTSFactory._create_builtin(engine_type, **kwargs)
        except ModuleNotFoundError as exc:
            raise ValueError(
                f"TTS engine {engine_type} is missing a dependency: {exc.name}"
            ) from exc

    @staticmethod
    def _create_builtin(engine_type: str, **kwargs) -> TTSInterface:
        module = import_module(TTSFactory.module_name(engine_type))
        class_name = TTS_ENGINES.get(engine_type, "TTSEngine")
        engine = getattr(module, class_name, None)
        if not isinstance(engine, type) or not issubclass(engine, TTSInterface):
            raise ValueError(
                f"{engine_type} must expose a {class_name} implementing TTSInterface"
            )
        return engine(**kwargs)
