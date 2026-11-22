"""Lazy ASR provider registry. Import only the selected engine's dependencies."""

from importlib import import_module
from .asr_interface import ASRInterface

ASR_ENGINES = {
    "faster_whisper": "faster_whisper_asr",
    "whisper_cpp": "whisper_cpp_asr",
    "whisper": "openai_whisper_asr",
    "fun_asr": "fun_asr",
    "azure_asr": "azure_asr",
    "groq_whisper_asr": "groq_whisper_asr",
    "sherpa_onnx_asr": "sherpa_onnx_asr",
}


class ASRFactory:
    @staticmethod
    def get_asr_system(system_name: str, **kwargs) -> ASRInterface:
        if system_name not in ASR_ENGINES:
            raise ValueError(
                f"Unknown ASR system: {system_name}. Available: {', '.join(ASR_ENGINES)}"
            )
        options = dict(kwargs)
        if system_name == "azure_asr" and "api_key" in options:
            options["subscription_key"] = options.pop("api_key")
        try:
            module = import_module(f"{__package__}.{ASR_ENGINES[system_name]}")
            engine = module.VoiceRecognition
            if not isinstance(engine, type) or not issubclass(engine, ASRInterface):
                raise ValueError(f"{system_name} must implement ASRInterface")
            return engine(**options)
        except ModuleNotFoundError as exc:
            raise ValueError(
                f"ASR engine {system_name} is missing a dependency: {exc.name}"
            ) from exc
