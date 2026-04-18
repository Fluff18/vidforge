"""Node 4 — Video Gen: return MrBeast YouTube demo videos immediately."""
from __future__ import annotations

from app.graph.state import AgentState

_FALLBACK_VIDEOS = [
    {"video_url": "https://www.youtube.com/watch?v=0e3GPea1Tyg", "title": "$456,000 Squid Game In Real Life!"},
    {"video_url": "https://www.youtube.com/watch?v=iogcY_4xGjo", "title": "$1 vs $1,000,000 Hotel Room!"},
    {"video_url": "https://www.youtube.com/watch?v=v9WSjE3tIkg", "title": "World's Most Viewed TikToks!"},
]


async def video_gen_node(state: AgentState) -> dict:
    return _make_fallback(state["video_prompts"])


def _make_fallback(prompts: list[str]) -> dict:
    video_jobs = [
        {
            "job_id": f"fallback_{i}",
            "prompt": prompts[i] if i < len(prompts) else _FALLBACK_VIDEOS[i]["title"],
            "status": "succeeded",
            "video_url": _FALLBACK_VIDEOS[i]["video_url"],
        }
        for i in range(3)
    ]
    return {
        "video_jobs": video_jobs,
        "status": "videos_ready",
        "fallback_mode": True,
    }



def _make_fallback(prompts: list[str]) -> dict:
    """Return 3 MrBeast YouTube videos as fallback job results."""
    video_jobs = [
        {
            "job_id": f"fallback_{i}",
            "prompt": prompts[i] if i < len(prompts) else _FALLBACK_VIDEOS[i]["title"],
            "status": "succeeded",
            "video_url": _FALLBACK_VIDEOS[i]["video_url"],
        }
        for i in range(3)
    ]
    return {
        "video_jobs": video_jobs,
        "status": "videos_ready",
        "fallback_mode": True,
    }

