"""Butterbase - zero-config backend for sessions, generations, ratings, knowledge."""
from __future__ import annotations

from typing import Any
import httpx
from app.config import settings


class ButterbaseService:
    def __init__(self) -> None:
        self._base = settings.butterbase_url
        self._key = settings.butterbase_api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

    # ── Sessions ──────────────────────────────────────────────────────────────

    async def create_session(
        self,
        session_id: str,
        brief: str,
        use_case: str,
        photon_user_id: str | None = None,
    ) -> dict[str, Any]:
        payload = {
            "id": session_id,
            "brief": brief,
            "use_case": use_case,
            "status": "clarifying",
            "photon_user_id": photon_user_id,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{self._base}/sessions", headers=self._headers(), json=payload)
            resp.raise_for_status()
            return resp.json()

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{self._base}/sessions/{session_id}", headers=self._headers())
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()

    async def update_session_status(self, session_id: str, status: str) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.patch(
                f"{self._base}/sessions/{session_id}",
                headers=self._headers(),
                json={"status": status},
            )
            resp.raise_for_status()

    async def save_answers(self, session_id: str, answers: list[str]) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.patch(
                f"{self._base}/sessions/{session_id}",
                headers=self._headers(),
                json={"clarifying_answers": answers, "status": "generating"},
            )
            resp.raise_for_status()

    # ── Generations ───────────────────────────────────────────────────────────

    async def create_generation(
        self,
        session_id: str,
        prompt: str,
        video_url: str,
        brain_scores: list[dict],
        quality_score: float,
    ) -> dict[str, Any]:
        payload = {
            "session_id": session_id,
            "prompt": prompt,
            "video_url": video_url,
            "brain_scores": brain_scores,
            "quality_score": quality_score,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{self._base}/generations", headers=self._headers(), json=payload)
            resp.raise_for_status()
            return resp.json()

    async def get_generations(self, session_id: str) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self._base}/generations",
                headers=self._headers(),
                params={"session_id": session_id},
            )
            resp.raise_for_status()
            return resp.json()

    # ── Ratings (Feedback Loop) ────────────────────────────────────────────────

    async def save_rating(
        self,
        generation_id: str,
        session_id: str,
        dimension_ratings: dict[str, int],
        is_winner: bool,
        use_case_tag: str,
        prompt: str,
        avg_score: float,
        comment: str | None = None,
    ) -> None:
        # Save raw rating
        payload = {
            "generation_id": generation_id,
            "session_id": session_id,
            "dimension_ratings": dimension_ratings,
            "is_winner": is_winner,
            "comment": comment,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{self._base}/ratings", headers=self._headers(), json=payload)
            resp.raise_for_status()

        # Update knowledge base — always store comments (they're valuable), plus winners/high-rated
        if is_winner or avg_score >= 70 or comment:
            await self._upsert_knowledge(
                use_case_tag=use_case_tag,
                prompt=prompt,
                avg_score=avg_score,
                dimension_ratings=dimension_ratings,
                comment=comment,
            )

    async def _upsert_knowledge(
        self,
        use_case_tag: str,
        prompt: str,
        avg_score: float,
        dimension_ratings: dict[str, int],
        comment: str | None = None,
    ) -> None:
        payload = {
            "use_case_tag": use_case_tag,
            "prompt": prompt,
            "avg_score": avg_score,
            "dimension_ratings": dimension_ratings,
            "comment": comment,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{self._base}/knowledge", headers=self._headers(), json=payload)
            resp.raise_for_status()

    async def query_knowledge(self, use_case_tag: str, limit: int = 3) -> list[dict[str, Any]]:
        """Retrieve top-performing prompts for a use case."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self._base}/knowledge",
                headers=self._headers(),
                params={"use_case_tag": use_case_tag, "sort": "avg_score", "limit": limit},
            )
            resp.raise_for_status()
            return resp.json()


butterbase = ButterbaseService()
