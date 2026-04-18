"""Anthropic Claude client — drop-in replacement for the OpenAI client with
the same `chat()` and `describe_image()` surface used by the graph nodes and
file_processor."""
from __future__ import annotations

from anthropic import AsyncAnthropic

from app.config import settings


class AnthropicClient:
    def __init__(self) -> None:
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model

    async def chat(self, system: str, user: str, temperature: float = 0.8) -> str:
        resp = await self._client.messages.create(
            model=self._model,
            system=system,
            messages=[{"role": "user", "content": user}],
            temperature=temperature,
            max_tokens=2048,
        )
        return "".join(block.text for block in resp.content if block.type == "text")

    async def describe_image(self, prompt: str, image_b64: str, mime: str = "image/jpeg") -> str:
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=400,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                },
            ],
        )
        return "".join(block.text for block in resp.content if block.type == "text")


anthropic_client = AnthropicClient()
