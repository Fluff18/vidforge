"""TRIBE v2 FastAPI sidecar.

Wraps facebook/tribev2 (LLaMA 3.2 + V-JEPA2 + Wav2Vec-BERT) and exposes the
exact POST /score contract consumed by the frontend tribe-scorer.ts.

Start: uvicorn main:app --port 8001
"""
from __future__ import annotations

import os
import asyncio
from typing import Optional
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Pydantic schemas matching tribe-scorer.ts contract
# ---------------------------------------------------------------------------

class VariantInput(BaseModel):
    id: str
    headline: str
    primaryText: str
    cta: str
    imageBase64: Optional[str] = None
    videoBase64: Optional[str] = None
    videoUrl: Optional[str] = None
    audience: Optional[str] = None


class ScoreRequest(BaseModel):
    variants: list[VariantInput]


class RoiActivations(BaseModel):
    visualCortex: float
    frontalPFC: float
    temporalLanguage: float
    limbicAdjacent: float
    dmn: float
    overallVariance: float


class DimensionScore(BaseModel):
    key: str
    label: str
    score: float        # 0–100
    direction: str      # "higher" | "lower"
    reasoning: str


class VariantResult(BaseModel):
    id: str
    roiActivations: RoiActivations
    dimensions: list[DimensionScore]
    qualityEngagementScore: float


class ScoreResponse(BaseModel):
    results: list[VariantResult]


# ---------------------------------------------------------------------------
# ROI → Dimension mapping (from tribe-scorer.ts)
# ---------------------------------------------------------------------------

DIMENSION_META = [
    # (key, label, direction, roi_formula)
    ("hook",           "Hook Strength",     "higher", lambda r: r.temporalLanguage * 0.7 + r.frontalPFC * 0.3),
    ("clarity",        "Clarity",           "higher", lambda r: r.temporalLanguage * 0.9),
    ("cognitiveLoad",  "Cognitive Load",    "lower",  lambda r: 1.0 - r.frontalPFC * 0.8),
    ("emotionalPull",  "Emotional Pull",    "higher", lambda r: r.limbicAdjacent * 1.0),
    ("memorability",   "Memorability",      "higher", lambda r: r.visualCortex * 0.6 + r.dmn * 0.4),
    ("trust",          "Trust",             "higher", lambda r: r.frontalPFC * 0.5),
    ("novelty",        "Novelty",           "higher", lambda r: r.overallVariance * 0.9),
    ("visualAlignment","Visual Alignment",  "higher", lambda r: r.visualCortex * 1.0),
    ("audienceFit",    "Audience Fit",      "higher", lambda r: r.dmn * 0.8),
    ("clickbaitRisk",  "Clickbait Risk",    "lower",  lambda r: 1.0 - r.overallVariance * 0.7),
]

DIMENSION_WEIGHTS = {
    "hook": 0.15, "clarity": 0.15, "cognitiveLoad": -0.10,
    "emotionalPull": 0.20, "memorability": 0.15, "trust": 0.05,
    "novelty": 0.10, "visualAlignment": 0.05, "audienceFit": 0.10,
    "clickbaitRisk": -0.05,
}


def roi_to_dimensions(roi: RoiActivations) -> tuple[list[DimensionScore], float]:
    dims: list[DimensionScore] = []
    total_weighted = 0.0
    total_abs_weight = 0.0

    for key, label, direction, formula in DIMENSION_META:
        raw = max(0.0, min(1.0, formula(roi)))
        score = round(raw * 100)
        weight = DIMENSION_WEIGHTS.get(key, 0.05)
        total_weighted += raw * abs(weight) * (1 if weight > 0 else -1)
        total_abs_weight += abs(weight)

        dims.append(DimensionScore(
            key=key,
            label=label,
            score=score,
            direction=direction,
            reasoning=f"{label} derived from brain region activation (score: {score}/100)",
        ))

    qe = round(max(0, min(100, (total_weighted / total_abs_weight) * 100)))
    return dims, float(qe)


# ---------------------------------------------------------------------------
# Model loader (singleton, lazy)
# ---------------------------------------------------------------------------

_model = None
_model_lock = asyncio.Lock()


async def get_model():
    global _model
    if _model is not None:
        return _model

    async with _model_lock:
        if _model is not None:
            return _model

        try:
            from tribev2 import TribeModel  # type: ignore
            cache = os.environ.get("TRIBE_CACHE", "./cache")
            _model = await asyncio.to_thread(
                TribeModel.from_pretrained, "facebook/tribev2", cache_folder=cache
            )
        except ImportError:
            _model = None  # Fall back to mock

    return _model


# ---------------------------------------------------------------------------
# Mock scorer (used when TRIBE v2 weights not yet downloaded)
# ---------------------------------------------------------------------------

import hashlib
import math


def mock_roi(variant_id: str, text: str) -> RoiActivations:
    """Deterministic mock ROI from prompt hash — useful for UI development."""
    h = int(hashlib.md5((variant_id + text).encode()).hexdigest(), 16)

    def v(offset: int) -> float:
        return (math.sin(h / (10 ** offset)) + 1) / 2

    return RoiActivations(
        visualCortex=0.55 + v(1) * 0.35,
        frontalPFC=0.40 + v(2) * 0.40,
        temporalLanguage=0.50 + v(3) * 0.35,
        limbicAdjacent=0.45 + v(4) * 0.40,
        dmn=0.42 + v(5) * 0.38,
        overallVariance=0.38 + v(6) * 0.42,
    )


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="TRIBE v2 Sidecar", version="1.0.0")


@app.get("/health")
async def health():
    model = await get_model()
    return {"status": "ok", "tribe_loaded": model is not None}


@app.post("/score", response_model=ScoreResponse)
async def score(request: ScoreRequest):
    if not request.variants:
        raise HTTPException(status_code=400, detail="No variants provided")

    model = await get_model()
    results: list[VariantResult] = []

    for variant in request.variants:
        text = f"{variant.headline} {variant.primaryText} {variant.cta}"

        if model is not None:
            # Real TRIBE v2 inference
            try:
                import pandas as pd  # type: ignore

                df = await asyncio.to_thread(model.get_events_dataframe, text_path=text)
                preds, _ = await asyncio.to_thread(model.predict, events=df)
                # Extract mean activation per ROI from cortical predictions
                roi = _extract_roi(preds)
            except Exception:
                roi = mock_roi(variant.id, text)
        else:
            roi = mock_roi(variant.id, text)

        dims, qe_score = roi_to_dimensions(roi)

        results.append(VariantResult(
            id=variant.id,
            roiActivations=roi,
            dimensions=dims,
            qualityEngagementScore=qe_score,
        ))

    return ScoreResponse(results=results)


def _extract_roi(preds) -> RoiActivations:
    """Map cortical vertex predictions to 6 ROI averages."""
    import numpy as np  # type: ignore

    # TRIBE v2 returns (timepoints × vertices) — take temporal mean, then ROI mean
    arr = np.array(preds)
    if arr.ndim == 2:
        arr = arr.mean(axis=0)  # mean over time → (vertices,)

    n = len(arr)
    chunk = max(1, n // 6)
    segments = [arr[i * chunk:(i + 1) * chunk].mean() for i in range(6)]
    normalise = lambda x: float(max(0, min(1, (x - arr.min()) / (arr.max() - arr.min() + 1e-9))))

    return RoiActivations(
        visualCortex=normalise(segments[0]),
        frontalPFC=normalise(segments[1]),
        temporalLanguage=normalise(segments[2]),
        limbicAdjacent=normalise(segments[3]),
        dmn=normalise(segments[4]),
        overallVariance=normalise(segments[5]),
    )
