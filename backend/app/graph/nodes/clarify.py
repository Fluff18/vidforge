"""Node 1 — Clarify: generate clarifying questions from the brief using OpenAI."""
from __future__ import annotations

import json
from app.graph.state import AgentState
from app.services.openai_client import openai_client
from app.services.file_processor import format_for_prompt


CLARIFY_SYSTEM = """You are a creative director helping generate AI videos.
Given a brief (and any user-provided reference assets), produce 3-5 concise clarifying
questions that will improve the final video. Focus on: target audience, visual style/tone,
key message, platform format (aspect ratio, length), and any brand constraints.
If references are provided, ask questions that build on them rather than re-asking what
they already reveal.
Return ONLY a JSON array of question strings. Example:
["Who is the target audience?", "What is the desired mood — energetic or calm?"]"""


async def clarify_node(state: AgentState) -> dict:
    brief = state["brief"]
    uploaded = state.get("uploaded_files", [])
    references = format_for_prompt(uploaded)

    questions_raw = await openai_client.chat(
        system=CLARIFY_SYSTEM,
        user=f"Brief: {brief}{references}",
    )

    try:
        questions = json.loads(questions_raw)
    except (json.JSONDecodeError, ValueError):
        # Extract JSON array if wrapped in prose
        start = questions_raw.find("[")
        end = questions_raw.rfind("]") + 1
        questions = json.loads(questions_raw[start:end]) if start != -1 else [
            "Who is the target audience?",
            "What visual style do you want — realistic, animated, or cinematic?",
            "What platform is this for (TikTok, YouTube, Instagram)?",
        ]

    return {
        "clarifying_questions": questions,
        "status": "awaiting_answers",
    }
