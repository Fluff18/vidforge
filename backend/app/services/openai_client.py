"""Thin OpenAI chat completion client."""
from __future__ import annotations

import httpx
from app.config import settings


class OpenAIClient:
    def __init__(self) -> None:
        self._key = settings.openai_api_key
        self._model = settings.openai_model

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

    async def chat(self, system: str, user: str, temperature: float = 0.8) -> str:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": 2048,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]


openai_client = OpenAIClient()
