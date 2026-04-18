"""Seedance via BytePlus ModelArk API — text-to-video generation."""
from __future__ import annotations

from typing import Any
import httpx
from app.config import settings

# BytePlus ModelArk base URL
_ARK_BASE = "https://ark.ap-southeast.bytepluses.com"
_MODEL = "dreamina-seedance-2-0-260128"


class SeedanceService:
    def __init__(self) -> None:
        self._key = settings.seedance_api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

    async def submit_job(
        self,
        prompt: str,
        aspect_ratio: str = "16:9",
        duration: int = 5,
    ) -> str:
        """Submit a video generation task. Returns task id."""
        payload = {
            "model": _MODEL,
            "content": [{"type": "text", "text": prompt}],
            "ratio": aspect_ratio,
            "duration": duration,
            "generate_audio": True,
            "watermark": False,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_ARK_BASE}/api/v3/contents/generations/tasks",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["id"]

    async def poll_job(self, task_id: str) -> dict[str, Any]:
        """Poll a task. Returns {status, video_url}.

        status: queued | running | succeeded | failed | expired
        video_url: present when status == 'succeeded'
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{_ARK_BASE}/api/v3/contents/generations/tasks/{task_id}",
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()
        content = data.get("content") or {}
        return {
            "status": data.get("status", "queued"),
            "video_url": content.get("video_url", ""),
        }


seedance = SeedanceService()
