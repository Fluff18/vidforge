from __future__ import annotations

from typing import Annotated, Any
from typing_extensions import TypedDict


class AgentState(TypedDict):
    # Input
    session_id: str
    brief: str
    use_case: str  # "product_ad" | "short_form" | "simulation" | "walkthrough"

    # Clarify node
    clarifying_questions: list[str]
    clarifying_answers: list[str]          # populated by user via /api/clarify

    # Research node
    research_context: dict[str, Any]       # MiroMind output

    # Knowledge retrieval
    knowledge_context: list[dict[str, Any]]  # past winning prompts from Butterbase

    # Prompt forge node
    video_prompts: list[str]               # 3 distinct prompts

    # Video gen node
    video_jobs: list[dict[str, str]]       # [{job_id, prompt, status, video_url}]

    # Score node
    scored_variants: list[dict[str, Any]]  # [{video_url, brain_scores, dimensions}]

    # Status tracking
    status: str
    error: str | None
