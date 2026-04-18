"""Node 3 — Prompt Forge: craft 3 distinct Seedance video prompts using OpenAI."""
from __future__ import annotations

import json
from app.graph.state import AgentState
from app.services.openai_client import openai_client


FORGE_SYSTEM = """You are an expert AI video prompt engineer for Seedance video generation.
You receive a creative brief, clarifying Q&A, and verified research context.
You also receive knowledge of top-performing past prompts (if available), including any
user edit notes from previous generations. Treat those notes as direct creative direction
\u2014 incorporate their feedback into this generation.

Your task: produce exactly 3 DISTINCT video prompts, each targeting a different creative angle:
  1. Emotional/aspirational angle
  2. Feature/product-focused angle
  3. Bold/unexpected/viral angle

Each prompt must be:
- 2-4 sentences, highly descriptive, cinematic
- Specify camera movement, lighting, color palette, mood, and subject
- Optimized for Seedance text-to-video generation
- Tailored to the platform format specified by the user

Return ONLY a JSON array of 3 prompt strings."""


async def prompt_forge_node(state: AgentState) -> dict:
    brief = state["brief"]
    questions = state.get("clarifying_questions", [])
    answers = state.get("clarifying_answers", [])
    research = state.get("research_context", {})
    knowledge = state.get("knowledge_context", [])

    qa_section = "\n".join(f"Q: {q}\nA: {a}" for q, a in zip(questions, answers) if a)

    knowledge_section = ""
    if knowledge:
        top = knowledge[:3]
        lines = []
        for k in top:
            line = f"- [{k.get('use_case_tag', '')}] Score {k.get('avg_score', 0):.0f}/100: {k.get('prompt', '')}"
            if k.get("comment"):
                line += f"\n  User edit note: \"{k['comment']}\""
            lines.append(line)
        knowledge_section = "\n\nTop-performing past prompts with user feedback:\n" + "\n".join(lines)

    user_message = f"""Brief: {brief}

Clarifying Q&A:
{qa_section}

Research Context:
{json.dumps(research, indent=2)}{knowledge_section}"""

    raw = await openai_client.chat(
        system=FORGE_SYSTEM,
        user=user_message,
    )

    try:
        prompts = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        start = raw.find("[")
        end = raw.rfind("]") + 1
        prompts = json.loads(raw[start:end]) if start != -1 else [raw, raw, raw]

    # Ensure exactly 3
    while len(prompts) < 3:
        prompts.append(prompts[-1] if prompts else brief)
    prompts = prompts[:3]

    return {
        "video_prompts": prompts,
        "status": "prompts_ready",
    }
