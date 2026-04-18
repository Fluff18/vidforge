"""Node 6 — Deliver: store results in Butterbase and notify via Photon (best-effort)."""
from __future__ import annotations

from app.graph.state import AgentState
from app.services.butterbase import butterbase
from app.services.photon import photon


async def deliver_node(state: AgentState) -> dict:
    session_id = state["session_id"]
    scored_variants = state.get("scored_variants", [])

    # Preserve upstream error state rather than marking delivered with empty results.
    if state.get("status") == "error" or not scored_variants:
        return {
            "status": "error",
            "error": state.get("error") or "No scored variants available to deliver.",
        }

    # Store each scored variant in Butterbase (best effort)
    for variant in scored_variants:
        try:
            await butterbase.create_generation(
                session_id=session_id,
                prompt=variant["prompt"],
                video_url=variant["video_url"],
                brain_scores=variant.get("dimensions", []),
                quality_score=variant.get("quality_engagement_score", 0),
            )
        except Exception:
            pass

    # Notify via Photon (best effort)
    best = max(scored_variants, key=lambda v: v.get("quality_engagement_score", 0), default=None)
    if best:
        msg = (
            f"Your 3 videos are ready! 🎬\n"
            f"Best variant: {best['label']} (Brain Score: {best.get('quality_engagement_score', 0):.0f}/100)\n"
            f"View results: {_results_url(session_id)}"
        )
        try:
            await photon.notify(message=msg, session_id=session_id)
        except Exception:
            pass

    return {"status": "delivered"}


def _results_url(session_id: str) -> str:
    from app.config import settings
    return f"{settings.frontend_url}/results/{session_id}"


def _results_url(session_id: str) -> str:
    from app.config import settings
    return f"{settings.frontend_url}/results/{session_id}"
