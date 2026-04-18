"""Node 2 — Research: extract key context from the brief using OpenAI."""
from __future__ import annotations

import json
from app.graph.state import AgentState
from app.services.openai_client import openai_client


RESEARCH_SYSTEM = """You are a research assistant helping create AI video content.
Given a creative brief and clarifying Q&A, extract structured context.
Return ONLY a JSON object with keys:
- summary: 2-3 sentence overview of what the video should achieve
- key_facts: list of 3-5 important facts about the subject
- visual_elements: list of 3-5 visual/style descriptors
- audience_insights: object with 'age_range', 'interests', 'pain_points'
Return ONLY the JSON object, no extra text."""


async def research_node(state: AgentState) -> dict:
    brief = state["brief"]
    answers = state.get("clarifying_answers", [])
    questions = state.get("clarifying_questions", [])

    qa_text = "\n".join(
        f"Q: {q}\nA: {a}" for q, a in zip(questions, answers) if a
    )
    user_msg = f"Brief: {brief}"
    if qa_text:
        user_msg += f"\n\nQ&A:\n{qa_text}"

    raw = await openai_client.chat(system=RESEARCH_SYSTEM, user=user_msg, temperature=0.3)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        context = json.loads(raw[start:end]) if start != -1 else {"summary": raw}
    except (json.JSONDecodeError, ValueError):
        context = {"summary": brief, "key_facts": [], "visual_elements": [], "audience_insights": {}}

    return {
        "research_context": context,
        "status": "researched",
    }
