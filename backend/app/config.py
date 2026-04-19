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

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Seedance
    seedance_api_key: str = ""
    seedance_base_url: str = "https://api.seedance.ai/v1"

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
