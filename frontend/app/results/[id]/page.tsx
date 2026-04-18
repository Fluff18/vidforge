"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brain, Trophy, ChevronDown, ChevronUp, ThumbsUp } from "lucide-react";
import type { ScoredVariant, DimensionScore } from "../../types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DIMENSION_COLORS: Record<string, string> = {
  hook:            "bg-pink-500",
  clarity:         "bg-blue-500",
  cognitiveLoad:   "bg-yellow-500",
  emotionalPull:   "bg-red-500",
  memorability:    "bg-purple-500",
  trust:           "bg-green-500",
  novelty:         "bg-orange-500",
  visualAlignment: "bg-cyan-500",
  audienceFit:     "bg-indigo-500",
  clickbaitRisk:   "bg-slate-500",
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [variants, setVariants] = useState<ScoredVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [winner, setWinner] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchResults() {
      const res = await fetch(`${API}/api/status/${sessionId}`);
      if (!res.ok) { setError("Could not load results."); setLoading(false); return; }
      const data = await res.json();
      if (data.status !== "delivered") { setError("Results not ready yet."); setLoading(false); return; }
      setVariants(data.scored_variants ?? []);
      setLoading(false);
    }
    fetchResults();
  }, [sessionId]);

  const sorted = [...variants].sort((a, b) => b.quality_engagement_score - a.quality_engagement_score);
  const bestId = sorted[0]?.id;

  async function submitFeedback(variantId: string, isWinner: boolean) {
    const dimRatings = ratings[variantId] ?? {};
    const comment = comments[variantId] ?? "";
    await fetch(`${API}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        generation_id: variantId,
        dimension_ratings: dimRatings,
        is_winner: isWinner,
        comment: comment || null,
      }),
    });
    setFeedbackSent((prev) => ({ ...prev, [variantId]: true }));
    if (isWinner) setWinner(variantId);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full border-2 border-indigo-500 border-t-transparent w-10 h-10" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.push("/")} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white">Start over</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 h-14 flex items-center gap-3">
        <Brain className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold text-white">VidForge</span>
        <span className="text-slate-500 text-sm">Results</span>
        <button
          onClick={() => router.push("/")}
          className="ml-auto text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          New video
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-white">Your 3 Video Variations</h1>
          <p className="text-slate-400 text-sm">Each scored across 10 brain dimensions by TRIBE v2. Rate them to improve future generations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sorted.map((variant, rank) => (
            <VariantCard
              key={variant.id}
              variant={variant}
              rank={rank}
              isBest={variant.id === bestId}
              isWinner={winner === variant.id}
              feedbackSent={!!feedbackSent[variant.id]}
              expanded={expanded === variant.id}
              onToggle={() => setExpanded(expanded === variant.id ? null : variant.id)}
              ratings={ratings[variant.id] ?? {}}
              comment={comments[variant.id] ?? ""}
              onRate={(key, val) =>
                setRatings((prev) => ({
                  ...prev,
                  [variant.id]: { ...(prev[variant.id] ?? {}), [key]: val },
                }))
              }
              onComment={(val) =>
                setComments((prev) => ({ ...prev, [variant.id]: val }))
              }
              onSubmitFeedback={(isWinner) => submitFeedback(variant.id, isWinner)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariantCard
// ---------------------------------------------------------------------------

interface VariantCardProps {
  variant: ScoredVariant;
  rank: number;
  isBest: boolean;
  isWinner: boolean;
  feedbackSent: boolean;
  expanded: boolean;
  onToggle: () => void;
  ratings: Record<string, number>;
  comment: string;
  onRate: (key: string, val: number) => void;
  onComment: (val: string) => void;
  onSubmitFeedback: (isWinner: boolean) => void;
}

function VariantCard({
  variant, rank, isBest, isWinner, feedbackSent, expanded, onToggle, ratings, comment, onRate, onComment, onSubmitFeedback,
}: VariantCardProps) {
  const score = Math.round(variant.quality_engagement_score);

  return (
    <div className={`rounded-2xl border bg-slate-900 overflow-hidden transition-all ${
      isBest ? "border-indigo-500 ring-1 ring-indigo-500/30" : "border-slate-700"
    }`}>
      {isBest && (
        <div className="bg-indigo-600 px-4 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-white">
          <Trophy className="w-3.5 h-3.5" /> Highest Brain Score
        </div>
      )}

      {/* Video preview */}
      <div className="bg-slate-800 aspect-video flex items-center justify-center">
        {variant.video_url ? (
          <video
            src={variant.video_url}
            controls
            className="w-full h-full object-cover"
            preload="metadata"
          />
        ) : (
          <span className="text-slate-500 text-sm">Video unavailable</span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Label + score */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-white">{variant.label}</div>
            <div className="text-slate-400 text-xs mt-0.5 line-clamp-2">{variant.prompt}</div>
          </div>
          <BrainScoreBadge score={score} />
        </div>

        {/* Dimension bar chart */}
        <DimensionBars dimensions={variant.dimensions} />

        {/* Expand / collapse feedback */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-white transition-colors"
        >
          <span>{feedbackSent ? "Feedback submitted" : "Rate this video"}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && !feedbackSent && (
          <FeedbackPanel
            dimensions={variant.dimensions}
            ratings={ratings}
            comment={comment}
            onRate={onRate}
            onComment={onComment}
            onSubmit={onSubmitFeedback}
          />
        )}

        {feedbackSent && isWinner && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <ThumbsUp className="w-4 h-4" /> Saved as winner — improves future prompts
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brain Score Badge
// ---------------------------------------------------------------------------

function BrainScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center shrink-0">
      <Brain className={`w-5 h-5 ${color}`} />
      <span className={`text-lg font-bold leading-tight ${color}`}>{score}</span>
      <span className="text-slate-500 text-[10px]">/100</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension Bars
// ---------------------------------------------------------------------------

function DimensionBars({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <div className="space-y-1.5">
      {dimensions.slice(0, 5).map((dim) => (
        <div key={dim.key} className="flex items-center gap-2">
          <span className="text-slate-400 text-[10px] w-24 shrink-0 truncate">{dim.label}</span>
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${DIMENSION_COLORS[dim.key] ?? "bg-indigo-500"}`}
              style={{ width: `${dim.score}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 w-6 text-right">{dim.score}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback Panel
// ---------------------------------------------------------------------------

function FeedbackPanel({
  dimensions, ratings, comment, onRate, onComment, onSubmit,
}: {
  dimensions: DimensionScore[];
  ratings: Record<string, number>;
  comment: string;
  onRate: (key: string, val: number) => void;
  onComment: (val: string) => void;
  onSubmit: (isWinner: boolean) => void;
}) {
  return (
    <div className="space-y-4 pt-2 border-t border-slate-700">
      <p className="text-slate-400 text-xs">Rate each dimension (1–5). Your ratings improve future generations.</p>
      <div className="space-y-2">
        {dimensions.map((dim) => (
          <div key={dim.key} className="flex items-center justify-between gap-2">
            <span className="text-slate-300 text-xs w-28 shrink-0">{dim.label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => onRate(dim.key, v)}
                  className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                    ratings[dim.key] === v
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Comment field */}
      <div className="space-y-1.5">
        <label className="text-slate-400 text-xs">Edit notes for next generation (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          placeholder="e.g. Make it more energetic, use warmer colors, show the product earlier..."
          rows={3}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSubmit(false)}
          className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:border-slate-400 transition-colors"
        >
          Save ratings
        </button>
        <button
          onClick={() => onSubmit(true)}
          className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Mark as winner
        </button>
      </div>
    </div>
  );
}
