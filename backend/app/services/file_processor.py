"""Process uploaded reference assets (images, documents) into text summaries
consumable by the LangGraph nodes."""
from __future__ import annotations

import base64
import io
import os
from typing import Any

from app.services.anthropic_client import anthropic_client as llm


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PDF_EXTS = {".pdf"}
DOCX_EXTS = {".docx"}
TEXT_EXTS = {".txt", ".md", ".markdown"}

MAX_DOC_CHARS = 8000  # trim extracted text before feeding LLMs


IMAGE_VISION_PROMPT = (
    "Describe this reference image in 3-5 sentences for a video prompt engineer. "
    "Focus on: subject, composition, color palette, lighting, mood, and visual style. "
    "Do not speculate beyond what is visible."
)


def classify(filename: str) -> str:
    ext = os.path.splitext(filename.lower())[1]
    if ext in IMAGE_EXTS:
        return "image"
    if ext in PDF_EXTS:
        return "pdf"
    if ext in DOCX_EXTS:
        return "docx"
    if ext in TEXT_EXTS:
        return "text"
    return "unknown"


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    chunks: list[str] = []
    for page in reader.pages:
        try:
            chunks.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(chunks).strip()


def _extract_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text).strip()


def _extract_text(data: bytes) -> str:
    return data.decode("utf-8", errors="replace").strip()


async def process_file(filename: str, content_type: str | None, data: bytes) -> dict[str, Any]:
    """Return a structured record describing the file's contribution to the brief."""
    kind = classify(filename)
    record: dict[str, Any] = {
        "filename": filename,
        "kind": kind,
        "size_bytes": len(data),
        "content_type": content_type,
    }

    if kind == "image":
        b64 = base64.b64encode(data).decode("ascii")
        mime = content_type or "image/jpeg"
        try:
            record["summary"] = await llm.describe_image(
                prompt=IMAGE_VISION_PROMPT,
                image_b64=b64,
                mime=mime,
            )
        except Exception as e:
            record["summary"] = ""
            record["error"] = f"vision_failed: {e}"
        return record

    if kind in ("pdf", "docx", "text"):
        try:
            if kind == "pdf":
                text = _extract_pdf(data)
            elif kind == "docx":
                text = _extract_docx(data)
            else:
                text = _extract_text(data)
        except Exception as e:
            record["summary"] = ""
            record["error"] = f"extract_failed: {e}"
            return record

        record["summary"] = text[:MAX_DOC_CHARS]
        record["truncated"] = len(text) > MAX_DOC_CHARS
        return record

    record["summary"] = ""
    record["error"] = "unsupported_file_type"
    return record


def format_for_prompt(uploaded_files: list[dict[str, Any]]) -> str:
    """Render uploaded file summaries as a compact section for LLM prompts."""
    if not uploaded_files:
        return ""

    lines: list[str] = []
    for f in uploaded_files:
        if not f.get("summary"):
            continue
        header = f"- [{f.get('kind', 'file')}] {f.get('filename', 'reference')}"
        lines.append(f"{header}\n  {f['summary']}")
    if not lines:
        return ""
    return "\n\nUser-provided reference assets:\n" + "\n".join(lines)
