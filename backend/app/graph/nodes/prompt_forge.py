"""Node 3 — Prompt Forge: craft 3 distinct Seedance video prompts using OpenAI."""
from __future__ import annotations

import json
from typing import Any
from app.graph.state import AgentState
from app.services.openai_client import openai_client


USE_CASE_AUDIO_GUIDE: dict[str, str] = {
    "product_ad": (
        "Include on-screen text overlays for key product claims (e.g. bold headline at 0s, benefit callout at midpoint). "
        "Add upbeat, aspirational background music. Include a confident voiceover narrating the core value proposition. "
        "End with a spoken and displayed call-to-action (e.g. 'Shop now at vidforge.ai')."
    ),
    "short_form": (
        "Open with a punchy on-screen text hook in the first 2 seconds to stop the scroll. "
        "Use trending, high-energy background music synced to cuts. "
        "No voiceover — let text overlays and captions carry the message. "
        "End with a bold CTA text card."
    ),
    "simulation": (
        "Minimal or no text overlays — keep the visual clean for training data use. "
        "Use a subtle ambient or neutral sound design (no music). "
        "Optional: sparse data-readout-style labels annotating objects or regions in the scene. "
        "No voiceover unless the brief specifically calls for it."
    ),
    "walkthrough": (
        "Include screen-reader-friendly text labels for each key step or room. "
        "Use a warm, conversational voiceover guiding the viewer through each stage. "
        "Add soft background music (low volume). "
        "Display chapter or step numbers as on-screen text throughout."
    ),
}

FORGE_SYSTEM = """You are an expert AI video prompt engineer for Seedance video generation.
You receive a creative brief, clarifying Q&A, verified research context, and use-case-specific
audio/text guidance. You also receive knowledge of top-performing past prompts (if available),
including any user edit notes from previous generations — treat those as direct creative direction.

Your task: produce exactly 3 DISTINCT video prompts, each targeting a different creative angle:
  1. Emotional/aspirational angle
  2. Feature/product-focused angle
  3. Bold/unexpected/viral angle

Each prompt must be:
- 2-4 sentences, highly descriptive, cinematic
- Specify camera movement, lighting, color palette, mood, and subject
- Include text overlay guidance (what words appear on screen, when, in what style)
- Include audio guidance: background music genre/mood, voiceover tone/content if applicable,
  and any key sound effects (product sounds, ambient audio, etc.)
- Optimized for Seedance text-to-video generation
- Tailored to the platform format and use case specified by the user

Return ONLY a JSON array of 3 prompt strings."""


async def prompt_forge_node(state: AgentState) -> dict:
    brief = state["brief"]
    use_case = state.get("use_case", "product_ad")
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

    audio_guide = USE_CASE_AUDIO_GUIDE.get(use_case, USE_CASE_AUDIO_GUIDE["product_ad"])

    # Build optional media context hints
    media_hints = ""
    product_image = state.get("product_image")
    ref_video_name = state.get("reference_video_name")
    ref_video_type = state.get("reference_video_type")
    if product_image:
        media_hints += "\n\nA product image has been provided — include specific visual descriptions of the product's appearance, colors, and form factor in each prompt."
    if ref_video_name:
        media_hints += f"\n\nA reference video has been provided ('{ref_video_name}', type: {ref_video_type}) — match its pacing, editing style, and overall aesthetic in the prompts."

    user_message = f"""Brief: {brief}
Use Case: {use_case}

Audio & Text Overlay Requirements for this use case:
{audio_guide}

Clarifying Q&A:
{qa_section}

Research Context:
{json.dumps(research, indent=2)}{knowledge_section}{media_hints}"""

    if product_image:
        raw = await openai_client.chat_with_image(
            system=FORGE_SYSTEM,
            user_text=user_message,
            image_data_uri=product_image,
        )
    else:
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
