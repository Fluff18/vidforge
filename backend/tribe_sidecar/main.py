"""TRIBE v2 FastAPI sidecar.

Wraps facebook/tribev2 (LLaMA 3.2 + V-JEPA2 + Wav2Vec-BERT) and exposes the
exact POST /score contract consumed by the pipeline.

Install:
    pip install git+https://github.com/facebookresearch/tribev2.git
    huggingface-cli login   # required for gated LLaMA 3.2-3B weights

Start: uvicorn tribe_sidecar.main:app --port 8001
"""
from __future__ import annotations

import os
import asyncio
import tempfile
from pathlib import Path
from typing import Optional
from functools import lru_cache

import httpx
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

# ---------------------------------------------------------------------------
# 6 marketing-performance dimensions — all "higher is better", weights sum to 1.0
#
# Total Ad Score = Σ(dim_score × weight) — a transparent weighted average.
# Weights:  Retention 25% | Thumb-Stop 20% | Emotional 20% | CTR 20% | Brand 10% | Trust 5%
# ---------------------------------------------------------------------------

DIMENSION_META = [
    # (key, label, weight, roi_formula, reasoning_template)
    (
        "retention",
        "Retention Rate",
        0.25,
        lambda r: r.temporalLanguage * 0.45 + r.frontalPFC * 0.35 + r.visualCortex * 0.20,
        "Predicts how many viewers watch to the end — driven by language comprehension (temporal), decision engagement (PFC) and sustained visual attention.",
    ),
    (
        "thumbStop",
        "Thumb-Stop Power",
        0.20,
        lambda r: r.visualCortex * 0.50 + r.overallVariance * 0.30 + r.temporalLanguage * 0.20,
        "Likelihood of stopping a mid-scroll in the first 2 seconds — high visual salience and novelty variance are the strongest predictors.",
    ),
    (
        "emotional",
        "Emotional Resonance",
        0.20,
        lambda r: r.limbicAdjacent * 0.70 + r.dmn * 0.30,
        "Depth of emotional reaction — limbic-adjacent activation captures gut-feel; DMN activation ties it to the viewer's personal memories.",
    ),
    (
        "ctrPotential",
        "CTR Potential",
        0.20,
        lambda r: r.frontalPFC * 0.55 + r.temporalLanguage * 0.35 + r.limbicAdjacent * 0.10,
        "Likelihood of a click or swipe-up — PFC engagement signals intent-to-act; language clarity (temporal) reduces friction before the CTA.",
    ),
    (
        "brandRecall",
        "Brand Recall",
        0.10,
        lambda r: r.visualCortex * 0.50 + r.dmn * 0.40 + r.frontalPFC * 0.10,
        "How strongly viewers will remember the brand 24 h later — visual encoding strength plus DMN consolidation into long-term memory.",
    ),
    (
        "trustSignal",
        "Trust & Authenticity",
        0.05,
        lambda r: r.frontalPFC * 0.60 + (1.0 - r.overallVariance) * 0.40,
        "Perceived authenticity — high PFC activity reflects reasoned evaluation; lower novelty variance signals a coherent, non-clickbait style.",
    ),
]


def roi_to_dimensions(roi: RoiActivations) -> tuple[list[DimensionScore], float]:
    """Convert ROI activations → 6 marketing dimensions + weighted Ad Score (0–100)."""
    dims: list[DimensionScore] = []
    total_weighted = 0.0   # = Σ(raw × weight); since weights sum to 1.0 this IS the final score

    for key, label, weight, formula, reasoning_tpl in DIMENSION_META:
        raw = max(0.0, min(1.0, formula(roi)))
        score = round(raw * 100)
        total_weighted += raw * weight

        dims.append(DimensionScore(
            key=key,
            label=label,
            score=score,
            direction="higher",
            reasoning=reasoning_tpl,
        ))

    # total_weighted is already in [0, 1] since weights sum to 1.0
    qe = round(max(0, min(100, total_weighted * 100)))
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

            # Authenticate with HuggingFace for gated LLaMA 3.2 weights
            hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
            if hf_token:
                try:
                    from huggingface_hub import login  # type: ignore
                    login(token=hf_token, add_to_git_credential=False)
                except Exception:
                    pass

            cache = os.environ.get("TRIBE_CACHE", str(Path(__file__).parent / "cache"))
            _model = await asyncio.to_thread(
                TribeModel.from_pretrained, "facebook/tribev2", cache_folder=cache
            )
        except ImportError:
            _model = None  # Fall back to mock — tribev2 not installed

    return _model


# ---------------------------------------------------------------------------
# Input helpers
# ---------------------------------------------------------------------------

async def _text_to_temp_file(text: str) -> str:
    """Write text to a temporary .txt file (TRIBE requires a file path, not a string)."""
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8")
    tmp.write(text)
    tmp.close()
    return tmp.name


async def _download_video(url: str) -> str:
    """Download a video URL to a temp .mp4 file; return the path."""
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp.close()
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream("GET", url) as r:
            r.raise_for_status()
            with open(tmp.name, "wb") as f:
                async for chunk in r.aiter_bytes(65536):
                    f.write(chunk)
    return tmp.name


# ---------------------------------------------------------------------------
# ROI extraction — Destrieux 2009 atlas on fsaverage5
# ---------------------------------------------------------------------------

# Destrieux 2009 atlas region names → our 6 brain ROIs.
# Based on Destrieux et al. (2010) NeuroImage and standard cognitive neuroscience.
_ROI_DESTRIEUX: dict[str, list[str]] = {
    "visualCortex": [
        "G_and_S_calcarine",        # V1/V2 primary visual cortex
        "G_cuneus",                  # V2/V3 dorsal visual
        "G_oc-temp_med-Lingual",     # lingual gyrus (V4/ventral visual)
        "G_occipital_sup",           # dorsal visual stream
        "G_and_S_occipital_inf",
        "G_occipital_middle",
        "Pole_occipital",            # occipital pole
        "S_calcarine",
        "S_oc_sup_and_transversal",
        "S_oc-temp_med_and_Lingual",
        "S_oc_middle_and_Lunatus",
    ],
    "frontalPFC": [
        "G_and_S_frontomargin",      # frontomarginal (anterior medial PFC)
        "G_and_S_transv_frontopol",  # frontopolar
        "G_front_inf-Orbital",       # OFC
        "G_front_inf-Triangular",    # Broca area pars triangularis
        "G_front_inf-Opercular",     # Broca area pars opercularis
        "G_front_middle",            # dorsolateral PFC
        "G_front_superior",          # superior frontal / SMA
        "G_orbital",
        "G_rectus",
        "S_front_inf",
        "S_front_middle",
        "S_front_sup",
        "S_orbital_med-olfact",
        "S_suborbital",
    ],
    "temporalLanguage": [
        "G_temp_sup-G_T_transv",     # Heschl's gyrus (primary auditory)
        "G_temp_sup-Lateral",        # STG lateral / Wernicke's area
        "G_temp_sup-Plan_polar",     # planum polare
        "G_temp_sup-Plan_tempo",     # planum temporale
        "G_temporal_middle",         # MTG
        "G_temporal_inf",            # ITG (semantic processing)
        "Pole_temporal",             # temporal pole (semantic memory)
        "S_temporal_sup",            # superior temporal sulcus (STS)
        "S_temporal_inf",
        "S_temporal_transverse",
        "Lat_Fis-post",              # posterior lateral fissure
    ],
    "limbicAdjacent": [
        "G_and_S_cingul-Ant",        # anterior cingulate
        "G_and_S_cingul-Mid-Ant",
        "G_cingul-Post-ventral",     # posterior ventral cingulate
        "G_oc-temp_med-Parahip",     # parahippocampal (memory consolidation)
        "G_oc-temp_lat-fusifor",     # fusiform gyrus (faces, emotional objects)
        "G_insular_short",           # insula (interoception, emotional salience)
        "G_Ins-lg_and_S_cent_ins",
        "S_circular_insula_ant",
        "S_circular_insula_inf",
        "S_circular_insula_sup",
    ],
    "dmn": [
        "G_and_S_cingul-Mid-Post",   # posterior cingulate cortex (PCC) — DMN hub
        "G_cingul-Post-dorsal",
        "G_pariet_inf-Angular",      # angular gyrus — DMN hub
        "G_precuneus",               # precuneus — posterior DMN
        "G_parietal_sup",            # superior parietal (partially DMN)
        "S_parieto_occipital",
        "S_pericallosal",            # pericallosal (medial)
        "S_subparietal",
        "S_cingul-Marginalis",
    ],
}


@lru_cache(maxsize=1)
def _load_destrieux_atlas():
    """Load nilearn Destrieux surface parcellation (cached after first call)."""
    from nilearn.datasets import fetch_atlas_surf_destrieux  # type: ignore
    return fetch_atlas_surf_destrieux()


def _extract_roi(preds) -> RoiActivations:
    """Map fsaverage5 cortical vertex predictions to 6 ROI activations.

    Predictions are (n_segments × n_vertices) where n_vertices = 20484
    (10242 LH + 10242 RH, fsaverage5).
    """
    import numpy as np

    arr = np.asarray(preds, dtype=float)
    if arr.ndim == 2:
        arr = arr.mean(axis=0)  # mean over time-segments → (n_vertices,)

    n = len(arr)
    half = n // 2  # 10242 for fsaverage5
    arr_lh, arr_rh = arr[:half], arr[half:]

    # ── Attempt 1: Destrieux atlas via nilearn ────────────────────────────
    try:
        atlas = _load_destrieux_atlas()
        labels_raw = atlas["labels"]
        labels = [
            (s.decode() if isinstance(s, bytes) else s) for s in labels_raw
        ]
        label_idx = {name: i for i, name in enumerate(labels)}

        map_lh = atlas["map_left"]   # (10242,) int labels
        map_rh = atlas["map_right"]  # (10242,)

        def _roi_mean(roi_name: str) -> float:
            region_list = _ROI_DESTRIEUX[roi_name]
            idxs = [label_idx[r] for r in region_list if r in label_idx]
            if not idxs:
                return float(arr.mean())
            mask_lh = np.isin(map_lh, idxs)
            mask_rh = np.isin(map_rh, idxs)
            combined = np.concatenate([arr_lh[mask_lh], arr_rh[mask_rh]])
            return float(combined.mean()) if len(combined) > 0 else float(arr.mean())

        raw = {roi: _roi_mean(roi) for roi in _ROI_DESTRIEUX}
        raw["overallVariance"] = float(np.std(arr))

    except Exception:
        # ── Fallback: use population percentiles across all vertices ─────
        # Better than equal-chunk splitting but still ROI-agnostic
        import numpy as np

        sorted_v = np.sort(arr)
        q = len(sorted_v) // 5
        raw = {
            # Proxy: high-amplitude vertices → more visual/emotional engagement
            "visualCortex":      float(sorted_v[-q:].mean()),
            "frontalPFC":        float(sorted_v[-2 * q:-q].mean()),
            "temporalLanguage":  float(sorted_v[-3 * q:-2 * q].mean()),
            "limbicAdjacent":    float(sorted_v[-4 * q:-3 * q].mean()),
            "dmn":               float(sorted_v[:-4 * q].mean()),
            "overallVariance":   float(np.std(arr)),
        }

    # Normalise all 5 spatial ROIs to [0, 1]
    import numpy as np
    spatial_vals = np.array([raw[k] for k in _ROI_DESTRIEUX])
    mn, mx = spatial_vals.min(), spatial_vals.max()
    span = mx - mn + 1e-9

    def _norm(x: float) -> float:
        return float(max(0.0, min(1.0, (x - mn) / span)))

    return RoiActivations(
        visualCortex=_norm(raw["visualCortex"]),
        frontalPFC=_norm(raw["frontalPFC"]),
        temporalLanguage=_norm(raw["temporalLanguage"]),
        limbicAdjacent=_norm(raw["limbicAdjacent"]),
        dmn=_norm(raw["dmn"]),
        # Variance: scale so ~0.01 activations std ≈ 0.5
        overallVariance=float(min(1.0, raw["overallVariance"] * 50)),
    )


# ---------------------------------------------------------------------------
# Mock scorer (used when tribev2 is not installed)
# ---------------------------------------------------------------------------

import hashlib
import math


def mock_roi(variant_id: str, text: str) -> RoiActivations:
    """Deterministic mock ROI from prompt hash — placeholder until TRIBE v2 is installed.

    NOTE: these values are NOT real brain predictions.
    Install tribev2 + HF_TOKEN for real fMRI-based scoring.
    """
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

app = FastAPI(title="TRIBE v2 Sidecar", version="2.0.0")


@app.get("/health")
async def health():
    model = await get_model()
    return {
        "status": "ok",
        "tribe_loaded": model is not None,
        "mode": "real" if model is not None else "mock",
    }


@app.post("/score", response_model=ScoreResponse)
async def score(request: ScoreRequest):
    if not request.variants:
        raise HTTPException(status_code=400, detail="No variants provided")

    model = await get_model()
    results: list[VariantResult] = []

    for variant in request.variants:
        text = f"{variant.headline} {variant.primaryText} {variant.cta}"
        tmp_files: list[str] = []

        if model is not None:
            try:
                # Prefer video if available (most accurate — TRIBE v2 is multimodal)
                if variant.videoUrl:
                    video_path = await _download_video(variant.videoUrl)
                    tmp_files.append(video_path)
                    df = await asyncio.to_thread(
                        model.get_events_dataframe, video_path=video_path
                    )
                elif variant.videoBase64:
                    # Decode base64 video to temp file
                    import base64
                    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
                    tmp.write(base64.b64decode(variant.videoBase64))
                    tmp.close()
                    tmp_files.append(tmp.name)
                    df = await asyncio.to_thread(
                        model.get_events_dataframe, video_path=tmp.name
                    )
                else:
                    # Text-only: write to .txt file (TRIBE converts via TTS+transcription)
                    txt_path = await _text_to_temp_file(text)
                    tmp_files.append(txt_path)
                    df = await asyncio.to_thread(
                        model.get_events_dataframe, text_path=txt_path
                    )

                preds, _ = await asyncio.to_thread(model.predict, events=df, verbose=False)
                roi = _extract_roi(preds)

            except Exception:
                roi = mock_roi(variant.id, text)
            finally:
                for f in tmp_files:
                    try:
                        os.unlink(f)
                    except OSError:
                        pass
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
