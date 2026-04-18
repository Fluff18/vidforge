"""IonRouter (Cumulus Labs) - multimodal inference client."""
from __future__ import annotations

import httpx
from app.config import settings


class IonRouterService:
    def __init__(self) -> None:
        self._base = settings.ionrouter_base_url
        self._key = settings.ionrouter_api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

    def _model(self, kind: str) -> str:
        return settings.ionrouter_vision_model if kind == "vision" else settings.ionrouter_text_model

    async def chat(self, model: str, system: str, user: str) -> str:
        payload = {
            "model": self._model(model),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.8,
            "max_tokens": 2048,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self._base}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


ionrouter = IonRouterService()
