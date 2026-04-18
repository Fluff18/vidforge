from __future__ import annotations

import uuid
import json
import os
import asyncio
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.graph.builder import clarify_graph, research_graph, video_graph
from app.graph.state import AgentState
from app.services.butterbase import butterbase


# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------
_sessions: dict[str, AgentState] = {}


# ---------------------------------------------------------------------------
# Local knowledge store  (data/knowledge.json — always reliable)
# ---------------------------------------------------------------------------
_KB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "knowledge.json")


def _load_kb() -> list[dict]:
    try:
        os.makedirs(os.path.dirname(_KB_PATH), exist_ok=True)
        with open(_KB_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_kb(entries: list[dict]) -> None:
    os.makedirs(os.path.dirname(_KB_PATH), exist_ok=True)
    with open(_KB_PATH, "w") as f:
        json.dump(entries, f, indent=2)


def kb_add(entry: dict) -> None:
    """Append an entry to the local knowledge base."""
    entries = _load_kb()
    entries.append(entry)
    _save_kb(entries)


def kb_query(use_case_tag: str, limit: int = 5) -> list[dict]:
    """Return top entries for a use_case sorted by avg_score desc."""
    entries = _load_kb()
    filtered = [e for e in entries if e.get("use_case_tag") == use_case_tag]
    filtered.sort(key=lambda e: e.get("avg_score", 0), reverse=True)
    return filtered[:limit]


def kb_all() -> list[dict]:
    return _load_kb()


def kb_update(idx: int, patch: dict) -> dict:
    entries = _load_kb()
    if idx < 0 or idx >= len(entries):
        raise IndexError("out of range")
    entries[idx].update(patch)
    _save_kb(entries)
    return entries[idx]


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(os.path.dirname(_KB_PATH), exist_ok=True)
    yield


app = FastAPI(title="VidForge API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StartRequest(BaseModel):
    brief: str
    use_case: str = "product_ad"  # product_ad | short_form | simulation | walkthrough
    photon_user_id: str | None = None
    product_image: str | None = None        # data URI from front-end upload
    reference_video_name: str | None = None # filename used as style hint
    reference_video_type: str | None = None # mime type hint


class StartResponse(BaseModel):
    session_id: str
    questions: list[str]


class AnswerRequest(BaseModel):
    session_id: str
    answers: list[str]


class FeedbackRequest(BaseModel):
    session_id: str
    generation_id: str
    dimension_ratings: dict[str, int]
    is_winner: bool
    comment: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/start", response_model=StartResponse)
async def start(req: StartRequest):
    """Step 1: Submit brief → get clarifying questions."""
    session_id = str(uuid.uuid4())

    initial_state: AgentState = {
        "session_id": session_id,
        "brief": req.brief,
        "use_case": req.use_case,
        "clarifying_questions": [],
        "clarifying_answers": [],
        "research_context": {},
        "knowledge_context": [],
        "video_prompts": [],
        "video_jobs": [],
        "scored_variants": [],
        "fallback_mode": False,
        "status": "clarifying",
        "error": None,
        "product_image": req.product_image,
        "reference_video_name": req.reference_video_name,
        "reference_video_type": req.reference_video_type,
    }

    # Run clarify node (30s hard timeout so UI never hangs indefinitely)
    try:
        result = await asyncio.wait_for(clarify_graph.ainvoke(initial_state), timeout=30)
    except asyncio.TimeoutError:
        initial_state["clarifying_questions"] = [
            "Who is the target audience?",
            "What visual style do you prefer — realistic, cinematic, or animated?",
            "Which platform is this for (TikTok, YouTube, Instagram)?",
        ]
        initial_state["status"] = "awaiting_answers"
        result = initial_state
    _sessions[session_id] = result

    # Persist session in Butterbase (best effort)
    try:
        await butterbase.create_session(
            session_id=session_id,
            brief=req.brief,
            use_case=req.use_case,
            photon_user_id=req.photon_user_id,
        )
    except Exception:
        pass

    return StartResponse(
        session_id=session_id,
        questions=result.get("clarifying_questions", []),
    )


@app.post("/api/generate")
async def generate(req: AnswerRequest, background_tasks: BackgroundTasks):
    """Step 2: Submit answers → run research + prompt_forge, then pause for prompt review."""
    state = _sessions.get(req.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    state["clarifying_answers"] = req.answers
    state["status"] = "generating"

    # Merge local KB knowledge (always available) + Butterbase (best-effort)
    local_knowledge = kb_query(use_case_tag=state.get("use_case", "product_ad"), limit=3)
    try:
        remote_knowledge = await butterbase.query_knowledge(
            use_case_tag=state.get("use_case", "product_ad"), limit=3
        )
    except Exception:
        remote_knowledge = []
    # Deduplicate by prompt text, prefer higher avg_score
    seen: set[str] = set()
    merged: list[dict] = []
    for entry in sorted(local_knowledge + remote_knowledge, key=lambda e: e.get("avg_score", 0), reverse=True):
        key = entry.get("prompt", "")[:80]
        if key not in seen:
            seen.add(key)
            merged.append(entry)
    state["knowledge_context"] = merged[:5]

    try:
        await butterbase.save_answers(req.session_id, req.answers)
    except Exception:
        pass

    background_tasks.add_task(_run_research, req.session_id, dict(state))
    return {"session_id": req.session_id, "status": "generating"}


async def _run_research(session_id: str, state: AgentState) -> None:
    """Phase 1: research + prompt_forge → pause at prompts_ready for user review."""
    try:
        async for chunk in research_graph.astream(state, stream_mode="values"):
            if session_id in _sessions:
                _sessions[session_id].update(chunk)
    except Exception as e:
        if session_id in _sessions:
            _sessions[session_id]["status"] = "error"
            _sessions[session_id]["error"] = str(e)


async def _run_video(session_id: str, state: AgentState) -> None:
    """Phase 2: video_gen + score + deliver."""
    try:
        async for chunk in video_graph.astream(state, stream_mode="values"):
            if session_id in _sessions:
                _sessions[session_id].update(chunk)
    except Exception as e:
        if session_id in _sessions:
            _sessions[session_id]["status"] = "error"
            _sessions[session_id]["error"] = str(e)


# ---------------------------------------------------------------------------
# Prompt review endpoints
# ---------------------------------------------------------------------------

@app.get("/api/prompts/{session_id}")
async def get_prompts(session_id: str):
    """Return the 3 generated prompts and knowledge context used."""
    state = _sessions.get(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "prompts": state.get("video_prompts", []),
        "knowledge_used": state.get("knowledge_context", []),
        "status": state.get("status"),
    }


class ConfirmPromptsRequest(BaseModel):
    prompts: list[str]  # 3 (optionally edited) prompts


@app.post("/api/confirm-prompts/{session_id}")
async def confirm_prompts(session_id: str, req: ConfirmPromptsRequest, background_tasks: BackgroundTasks):
    """User confirms (and optionally edits) the 3 prompts → kick off video generation."""
    state = _sessions.get(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    if len(req.prompts) != 3:
        raise HTTPException(status_code=422, detail="Exactly 3 prompts required")

    state["video_prompts"] = req.prompts
    state["status"] = "generating_videos"
    background_tasks.add_task(_run_video, session_id, dict(state))
    return {"session_id": session_id, "status": "generating_videos"}


# ---------------------------------------------------------------------------
# Knowledge base CRUD
# ---------------------------------------------------------------------------

@app.get("/api/knowledge")
async def get_knowledge(use_case: str | None = None, limit: int = 20):
    """Return all knowledge base entries (optionally filtered by use_case)."""
    entries = kb_all()
    if use_case:
        entries = [e for e in entries if e.get("use_case_tag") == use_case]
    entries.sort(key=lambda e: e.get("avg_score", 0), reverse=True)
    return {"entries": entries[:limit], "total": len(entries)}


@app.patch("/api/knowledge/{idx}")
async def update_knowledge(idx: int, patch: dict):
    """Update a knowledge base entry by index (e.g. edit prompt or comment)."""
    try:
        updated = kb_update(idx, patch)
        return {"entry": updated}
    except IndexError:
        raise HTTPException(status_code=404, detail="Entry not found")


@app.delete("/api/knowledge/{idx}")
async def delete_knowledge(idx: int):
    """Remove a knowledge base entry."""
    entries = _load_kb()
    if idx < 0 or idx >= len(entries):
        raise HTTPException(status_code=404, detail="Entry not found")
    removed = entries.pop(idx)
    _save_kb(entries)
    return {"removed": removed}


@app.get("/api/status/{session_id}")
async def status(session_id: str):
    """Poll for generation status and results."""
    state = _sessions.get(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "status": state.get("status"),
        "scored_variants": state.get("scored_variants", []),
        "video_jobs": state.get("video_jobs", []),
        "fallback_mode": state.get("fallback_mode", False),
        "error": state.get("error"),
    }


@app.post("/api/feedback")
async def feedback(req: FeedbackRequest):
    """Save user ratings + comment → always writes to local KB, best-effort to Butterbase."""
    state = _sessions.get(req.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    variant = next(
        (v for v in state.get("scored_variants", []) if v["id"] == req.generation_id),
        None,
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Generation not found")

    avg_score = sum(req.dimension_ratings.values()) / max(len(req.dimension_ratings), 1)
    use_case_tag = state.get("use_case", "product_ad")

    # Always store in local KB
    kb_add({
        "use_case_tag": use_case_tag,
        "prompt": variant.get("prompt", ""),
        "video_url": variant.get("video_url", ""),
        "avg_score": avg_score,
        "brain_score": variant.get("quality_engagement_score", 0),
        "dimension_ratings": req.dimension_ratings,
        "comment": req.comment,
        "is_winner": req.is_winner,
        "session_id": req.session_id,
        "generation_id": req.generation_id,
    })

    # Best-effort to Butterbase
    try:
        await butterbase.save_rating(
            generation_id=req.generation_id,
            session_id=req.session_id,
            dimension_ratings=req.dimension_ratings,
            is_winner=req.is_winner,
            use_case_tag=use_case_tag,
            prompt=variant.get("prompt", ""),
            avg_score=avg_score,
            comment=req.comment,
        )
    except Exception:
        pass

    return {"status": "saved"}
