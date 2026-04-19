"""Node 4 — Video Gen: submit 3 Seedance jobs in parallel and poll until complete."""
from __future__ import annotations

import asyncio
from app.config import settings
from app.graph.state import AgentState
from app.services.seedance import seedance


MOCK_SAMPLE_VIDEOS = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
]


async def video_gen_node(state: AgentState) -> dict:
    prompts = state["video_prompts"]

    if settings.mock_video_gen:
        return {
            "video_jobs": [
                {
                    "job_id": f"mock-{i}",
                    "prompt": p,
                    "status": "succeeded",
                    "video_url": MOCK_SAMPLE_VIDEOS[i % len(MOCK_SAMPLE_VIDEOS)],
                }
                for i, p in enumerate(prompts)
            ],
            "status": "videos_ready",
        }

    use_case = state.get("use_case", "product_ad")

    aspect_ratio = "9:16" if use_case == "short_form" else "16:9"
    duration = 6

    job_ids = await asyncio.gather(
        *[seedance.submit_job(prompt=p, aspect_ratio=aspect_ratio, duration=duration) for p in prompts]
    )

    video_jobs = [
        {"job_id": jid, "prompt": p, "status": "queued", "video_url": ""}
        for jid, p in zip(job_ids, prompts)
    ]

    MAX_POLLS = 36
    for _ in range(MAX_POLLS):
        await asyncio.sleep(5)

        still_pending = [j for j in video_jobs if j["status"] not in ("succeeded", "failed", "expired")]
        if not still_pending:
            break

        results = await asyncio.gather(
            *[seedance.poll_job(j["job_id"]) for j in still_pending],
            return_exceptions=True,
        )

        for job, result in zip(still_pending, results):
            if isinstance(result, Exception):
                continue
            job["status"] = result.get("status", "queued")
            if result.get("video_url"):
                job["video_url"] = result["video_url"]

    return {
        "video_jobs": video_jobs,
        "status": "videos_ready",
    }
