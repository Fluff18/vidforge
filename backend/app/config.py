from __future__ import annotations

from __future__ import annotations

import os
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(_BACKEND_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Anthropic (default LLM provider)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Seedance
    seedance_api_key: str = ""
    seedance_base_url: str = "https://api.seedance.ai/v1"
    mock_video_gen: bool = False

    # Photon
    photon_api_key: str = ""
    photon_base_url: str = "https://api.photon.ai/v1"

    # TRIBE v2 sidecar
    tribe_sidecar_url: str = "http://localhost:8001"

    # Butterbase
    butterbase_url: str = "https://api.butterbase.ai/mcp"
    butterbase_api_key: str = ""

    # App
    frontend_url: str = "http://localhost:3000"


settings = Settings()
