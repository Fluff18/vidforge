"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brain, Sparkles, ChevronDown, ChevronUp, ArrowRight, RotateCcw, BookOpen } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface KnowledgeEntry {
  use_case_tag: string;
  prompt: string;
  avg_score: number;
  brain_score?: number;
  comment?: string;
  is_winner?: boolean;
}

const VARIANT_LABELS = ["Emotional / Aspirational", "Feature Focused", "Bold & Viral"];
const VARIANT_COLORS = ["border-pink-500/40", "border-blue-500/40", "border-orange-500/40"];
const VARIANT_BADGES = ["bg-pink-900/40 text-pink-300", "bg-blue-900/40 text-blue-300", "bg-orange-900/40 text-orange-300"];

export default function PromptsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [prompts, setPrompts] = useState<string[]>(["", "", ""]);
  const [original, setOriginal] = useState<string[]>(["", "", ""]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Poll until prompts_ready
      for (let i = 0; i < 60; i++) {
        const res = await fetch(`${API}/api/prompts/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.prompts?.length === 3) {
            setPrompts(data.prompts);
            setOriginal(data.prompts);
            setKnowledge(data.knowledge_used ?? []);
            setLoading(false);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      setError("Prompt generation timed out.");
      setLoading(false);
    }
    load();
  }, [sessionId]);

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/confirm-prompts/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      router.push(`/generate/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="rounded-full bg-indigo-950 border border-indigo-700 p-6 animate-pulse mx-auto w-fit">
          <Brain className="w-10 h-10 text-indigo-400" />
        </div>
        <p className="text-slate-400">Crafting your video prompts...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.push("/create")} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white">
          Start over
        </button>
      </div>
    </div>
  );

  const hasEdits = prompts.some((p, i) => p !== original[i]);

  return (
    <div className="min-h-screen flex flex-col bg-[#070b18] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[300px] rounded-full bg-indigo-600/10 blur-[110px]" />
      </div>

      <header className="relative border-b border-white/10 px-6 h-14 flex items-center gap-3 bg-[#070b18]/90 backdrop-blur-md">
        <div className="rounded-lg bg-indigo-600 p-1.5">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-white">VidForge</span>
        <span className="text-white/40 text-sm">Review Prompts</span>
        <button
          onClick={() => router.push("/create")}
          className="ml-auto text-sm text-white/60 hover:text-white border border-white/20 rounded-lg px-3 py-1.5 transition-colors"
        >
          Start over
        </button>
      </header>

      <main className="relative flex-1 max-w-4xl mx-auto w-full px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-indigo-400 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">AI-crafted prompts</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Review & edit your video prompts</h1>
          <p className="text-white/60 text-sm">
            These 3 prompts will be sent to Seedance. Edit any of them before generating.
          </p>
        </div>

        {/* Prompt cards */}
        <div className="space-y-4">
          {prompts.map((prompt, i) => (
            <div key={i} className={`rounded-2xl border bg-white/[0.03] backdrop-blur-sm overflow-hidden ${VARIANT_COLORS[i]}`}>
              <div className="px-5 py-3 flex items-center justify-between border-b border-white/10">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${VARIANT_BADGES[i]}`}>
                  {VARIANT_LABELS[i]}
                </span>
                <button
                  onClick={() => setPrompts((prev) => { const n = [...prev]; n[i] = original[i]; return n; })}
                  className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 text-xs"
                  title="Reset to original"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
              <div className="p-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompts((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                  rows={4}
                  className="w-full bg-transparent text-white/90 text-sm leading-relaxed focus:outline-none resize-none placeholder:text-white/35"
                  placeholder="Enter video prompt..."
                />
              </div>
            </div>
          ))}
        </div>

        {/* Knowledge base accordion */}
        {knowledge.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <button
              onClick={() => setShowKnowledge(!showKnowledge)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-white/80 hover:bg-white/[0.03] transition-colors"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                Knowledge base used to craft these prompts ({knowledge.length} entries)
              </span>
              {showKnowledge ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showKnowledge && (
              <div className="border-t border-white/10 divide-y divide-white/10">
                {knowledge.map((entry, i) => (
                  <div key={i} className="px-5 py-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                        {entry.use_case_tag}
                      </span>
                      <span className={`text-xs font-bold ${entry.avg_score >= 4 ? "text-green-400" : entry.avg_score >= 3 ? "text-yellow-400" : "text-slate-400"}`}>
                        ★ {entry.avg_score.toFixed(1)}/5
                      </span>
                      {entry.is_winner && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400">Winner</span>
                      )}
                      {entry.brain_score && (
                        <span className="text-xs text-indigo-400">Brain: {Math.round(entry.brain_score)}/100</span>
                      )}
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">{entry.prompt}</p>
                    {entry.comment && (
                      <p className="text-white/45 text-xs italic">Edit note: "{entry.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* CTA */}
        <div className="flex items-center gap-3 pt-2">
          {hasEdits && (
            <button
              onClick={() => setPrompts(original)}
              className="px-5 py-3 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors text-sm"
            >
              Reset all
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={submitting || prompts.some((p) => !p.trim())}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3.5 font-semibold text-white transition-colors"
          >
            {submitting ? "Starting generation..." : hasEdits ? "Generate with edited prompts" : "Generate videos →"}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </main>
    </div>
  );
}
