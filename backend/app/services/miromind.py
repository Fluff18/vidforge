"""MiroMind - verification-centric research client."""
from __future__ import annotations

from typing import Any
import httpx
from app.config import settings


class MiroMindService:
    def __init__(self) -> None:
        self._base = settings.miromind_base_url
        self._key = settings.miromind_api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

    async def research(self, query: str) -> dict[str, Any]:
        """Submit a research query. Returns verified facts, key visual elements, sources."""
        payload = {
            "query": query,
            "mode": "deep",
            "output_format": "structured",
            "max_sources": 8,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self._base}/research",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        # Normalise to a flat dict the prompt_forge node can consume
        return {
            "summary": data.get("summary", ""),
            "key_facts": data.get("key_facts", []),
            "visual_elements": data.get("visual_elements", []),
            "audience_insights": data.get("audience_insights", {}),
            "sources": [s.get("url", "") for s in data.get("sources", [])[:5]],
        }


miromind = MiroMindService()
