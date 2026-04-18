"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brain, Trophy, ChevronDown, ChevronUp, ThumbsUp } from "lucide-react";
import type { ScoredVariant, DimensionScore } from "../../types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DIMENSION_COLORS: Record<string, string> = {
  retention:    "bg-indigo-500",
  thumbStop:    "bg-pink-500",
  emotional:    "bg-red-400",
  ctrPotential: "bg-amber-400",
  brandRecall:  "bg-purple-500",
  trustSignal:  "bg-emerald-500",
};

// Plain human-friendly rating questions shown in the feedback panel.
// Deliberately different from the 6 TRIBE v2 dimensions shown in the score bars.
const FEEDBACK_QUESTIONS: { key: string; label: string; hint: string }[] = [
  { key: "scroll_stop",  label: "Would you stop scrolling?",    hint: "1 = keep swiping · 5 = I'd stop instantly" },
  { key: "buy_intent",   label: "Does it make you want to buy?", hint: "1 = not at all · 5 = ready to click" },
  { key: "entertainment",label: "How entertaining is it?",       hint: "1 = boring · 5 = super engaging" },
  { key: "share_worthy", label: "Would you share this?",         hint: "1 = no · 5 = sending to everyone" },
];

// Weights shown next to each dimension label (must match tribe_sidecar)
const DIMENSION_WEIGHTS: Record<string, string> = {
  retention:    "25%",
  thumbStop:    "20%",
  emotional:    "20%",
  ctrPotential: "20%",
  brandRecall:  "10%",
  trustSignal:  "5%",
};

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : "";
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [variants, setVariants] = useState<ScoredVariant[]>([]);
  const [videoJobs, setVideoJobs] = useState<Array<{ status?: string }>>([]);  const [fallbackMode, setFallbackMode] = useState(false);  const [loading, setLoading] = useState(true);
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
      setVideoJobs(data.video_jobs ?? []);
      setFallbackMode(data.fallback_mode ?? false);
      setLoading(false);
    }
    fetchResults();
  }, [sessionId]);

  const sorted = [...variants].sort((a, b) => b.quality_engagement_score - a.quality_engagement_score);
  const bestId = sorted[0]?.id;

  async function submitFeedback(variantId: string, isWinner: boolean) {
    const variant = variants.find((v) => v.id === variantId);
    const userRatings = ratings[variantId] ?? {};
    const comment = comments[variantId] ?? "";

    // Fill any un-rated questions with 3 (neutral) so the KB always gets complete data
    const filledRatings: Record<string, number> = {};
    for (const q of FEEDBACK_QUESTIONS) {
      filledRatings[q.key] = userRatings[q.key] ?? 3;
    }

    await fetch(`${API}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        generation_id: variantId,
        dimension_ratings: filledRatings,
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
        <button onClick={() => router.push("/create")} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white">Start over</button>
      </div>
    </div>
  );

  const failedCount = videoJobs.filter((j) => ["failed", "expired"].includes(String(j.status))).length;

  return (
    <div className="min-h-screen bg-[#070b18] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[300px] rounded-full bg-indigo-600/10 blur-[110px]" />
      </div>
      {/* Header */}
      <header className="relative border-b border-white/10 px-6 h-14 flex items-center gap-3 bg-[#070b18]/90 backdrop-blur-md">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white">VidForge</span>
        <span className="text-white/40 text-sm">Results</span>
        <button
          onClick={() => router.push("/create")}
          className="ml-auto text-sm text-white/60 hover:text-white border border-white/20 rounded-lg px-3 py-1.5 transition-colors"
        >
          New video
        </button>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-1.5">
          <h1 className="text-3xl font-bold text-white">Your 3 Video Variations</h1>
          <p className="text-white/55 text-sm">Scored on 6 ad-performance factors by TRIBE v2. Total score = weighted average (Retention 25%, Thumb-Stop 20%, Emotional 20%, CTR 20%, Brand 10%, Trust 5%).</p>
        </div>

        {fallbackMode && (
          <div className="max-w-3xl mx-auto rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 flex items-start gap-3 text-sm">
            <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
            <p className="text-amber-200/80 leading-relaxed">
              AI video generation is currently unavailable. The cards below use MrBeast reference videos as placeholders so you can still review scoring and creative strategy.
            </p>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-10 text-center space-y-4">
            <h2 className="text-xl font-semibold text-white">No videos were delivered for this run</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Seedance did not return playable outputs, so there is nothing to score yet.
              {failedCount > 0 ? ` ${failedCount} generation job(s) ended in failed or expired state.` : ""}
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={() => router.push(`/prompts/${sessionId}`)}
                className="px-5 py-2.5 rounded-xl border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors text-sm"
              >
                Back to prompts
              </button>
              <button
                onClick={() => router.push("/create")}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
              >
                Start new run
              </button>
            </div>
          </div>
        ) : (
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
                onRate={(key: string, val: number) =>
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
        )}
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
    <div className={`rounded-2xl border bg-white/[0.03] backdrop-blur-sm overflow-hidden transition-all ${
      isBest ? "border-indigo-500 ring-1 ring-indigo-500/30" : "border-white/10"
    }`}>
      {isBest && (
        <div className="bg-indigo-600 px-4 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-white">
          <Trophy className="w-3.5 h-3.5" /> Highest Ad Score
        </div>
      )}

      {/* Video preview */}
      <div className="bg-[#111827] aspect-video flex items-center justify-center overflow-hidden">
        {variant.video_url ? (
          variant.video_url.includes("youtube.com") || variant.video_url.includes("youtu.be") ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${extractYouTubeId(variant.video_url)}?rel=0`}
              title={variant.label}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <video
              src={variant.video_url}
              controls
              className="w-full h-full object-cover"
              preload="metadata"
            />
          )
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
            ratings={ratings}
            comment={comment}
            onRate={onRate}
            onComment={onComment}
            onSubmit={onSubmitFeedback}
          />
        )}

        {feedbackSent && (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2.5 mt-1 ${
            isWinner
              ? "bg-green-900/30 border border-green-700/40 text-green-300"
              : "bg-indigo-900/30 border border-indigo-700/40 text-indigo-300"
          }`}>
            <ThumbsUp className="w-3.5 h-3.5 shrink-0" />
            {isWinner
              ? "Saved as winner — VidForge will prioritise this style"
              : "Saved — your preferences will shape future generations"}
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
    <div className="flex flex-col items-center shrink-0" title="Ad Score: weighted average of 6 performance dimensions">
      <Brain className={`w-5 h-5 ${color}`} />
      <span className={`text-lg font-bold leading-tight ${color}`}>{score}</span>
      <span className="text-slate-500 text-[10px]">Ad Score</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension Bars
// ---------------------------------------------------------------------------

function DimensionBars({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <div className="space-y-1.5">
      {dimensions.map((dim) => (
        <div key={dim.key} className="group flex items-center gap-2" title={dim.reasoning}>
          <span className="text-slate-400 text-[10px] w-[6.5rem] shrink-0 truncate">
            {dim.label}
            <span className="text-slate-600 ml-0.5">·{DIMENSION_WEIGHTS[dim.key] ?? ""}</span>
          </span>
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
  ratings, comment, onRate, onComment, onSubmit,
}: {
  ratings: Record<string, number>;
  comment: string;
  onRate: (key: string, val: number) => void;
  onComment: (val: string) => void;
  onSubmit: (isWinner: boolean) => void;
}) {
  const LABELS = ["😐", "🙂", "😊", "😄", "🤩"];
  return (
    <div className="space-y-4 pt-2 border-t border-slate-700">
      <p className="text-slate-400 text-xs">Quick vibe check — tap to rate 1–5.</p>
      <div className="space-y-3">
        {FEEDBACK_QUESTIONS.map((q) => (
          <div key={q.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-200 text-xs font-medium">{q.label}</span>
              {ratings[q.key] && (
                <span className="text-slate-500 text-[10px]">{q.hint.split("·")[ratings[q.key] > 3 ? 1 : 0]?.trim()}</span>
              )}
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => onRate(q.key, v)}
                  className={`flex-1 py-1.5 rounded-lg text-sm transition-all ${
                    ratings[q.key] === v
                      ? "bg-indigo-600 text-white scale-105"
                      : "bg-slate-700/70 text-slate-400 hover:bg-slate-600"
                  }`}
                  title={`${v}/5`}
                >
                  {LABELS[v - 1]}
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
