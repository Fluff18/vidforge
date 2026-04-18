"""Photon - deliver notifications to users via chat apps."""
from __future__ import annotations

import httpx
from app.config import settings

# session_id → photon_user_id mapping stored in Butterbase sessions
# This service looks up the mapping and sends the notification.


class PhotonService:
    def __init__(self) -> None:
        self._base = settings.photon_base_url
        self._key = settings.photon_api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

    async def notify(self, message: str, session_id: str) -> None:
        """Send a notification to the user associated with session_id."""
        # Retrieve photon user id from Butterbase session
        from app.services.butterbase import butterbase

        session = await butterbase.get_session(session_id)
        photon_user_id = session.get("photon_user_id") if session else None
        if not photon_user_id:
            return  # No Photon binding for this session

        payload = {
            "user_id": photon_user_id,
            "message": message,
            "type": "text",
        }
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                resp = await client.post(
                    f"{self._base}/messages",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
            except httpx.HTTPError:
                pass  # Notification failure is non-fatal


photon = PhotonService()
