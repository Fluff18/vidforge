"""Gemini-backed chat client kept behind the existing openai_client interface."""
from __future__ import annotations

import base64
import httpx
from app.config import settings


class OpenAIClient:
    def __init__(self) -> None:
        self._key = settings.gemini_api_key
        self._model = settings.gemini_model

    def _require_api_key(self) -> str:
        key = self._key.strip()
        if not key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to backend/.env before using Gemini-backed features."
            )
        return key

    def _headers(self) -> dict[str, str]:
        return {
            "x-goog-api-key": self._require_api_key(),
            "Content-Type": "application/json",
        }

    def _endpoint(self) -> str:
        return f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent"

    @staticmethod
    def _extract_text(data: dict) -> str:
        candidates = data.get("candidates") or []
        if not candidates:
            raise RuntimeError(f"Gemini returned no candidates: {data}")

        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(part.get("text", "") for part in parts if part.get("text"))
        if not text:
            raise RuntimeError(f"Gemini returned no text content: {data}")
        return text

    async def chat(self, system: str, user: str, temperature: float = 0.8) -> str:
        payload = {
            "systemInstruction": {
                "parts": [{"text": system}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user}],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 2048,
            },
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                self._endpoint(),
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            return self._extract_text(resp.json())

    async def chat_with_image(
        self,
        system: str,
        user_text: str,
        image_data_uri: str,
        temperature: float = 0.8,
    ) -> str:
        """Send a message with an inline image (data URI) using Gemini vision."""
        if "," not in image_data_uri or ";base64" not in image_data_uri:
            raise RuntimeError("Expected image_data_uri to be a base64 data URI.")

        meta, encoded = image_data_uri.split(",", 1)
        mime_type = meta.split(":", 1)[1].split(";", 1)[0]
        image_bytes = base64.b64decode(encoded)

        payload = {
            "systemInstruction": {
                "parts": [{"text": system}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": user_text},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64.b64encode(image_bytes).decode("ascii"),
                            }
                        },
                    ],
                },
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 2048,
            },
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                self._endpoint(),
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            return self._extract_text(resp.json())


openai_client = OpenAIClient()
