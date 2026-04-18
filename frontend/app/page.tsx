"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, ArrowRight, Sparkles } from "lucide-react";
import type { UseCase } from "./types";

const USE_CASES: { value: UseCase; label: string; description: string }[] = [
  { value: "product_ad",   label: "Product Ad",       description: "Turn a product into a polished video ad" },
  { value: "short_form",   label: "Short-Form Content", description: "Vertical video for TikTok, Reels, Shorts" },
  { value: "simulation",   label: "AI Simulation",    description: "Synthetic training data for physical AI" },
  { value: "walkthrough",  label: "Walkthrough",       description: "Property, onboarding, or explainer tours" },
];

const PLACEHOLDER_POOL: Record<UseCase, string[]> = {
  product_ad: [
    "Tech-savvy professionals and remote workers aged 25–40",
    "Premium quality, ergonomic design, and long-term health benefits",
    "Sleek and modern with clean whites and warm accent lighting",
    "Instagram, LinkedIn, and YouTube pre-roll",
    "Focus on the health benefits and productivity boost",
  ],
  short_form: [
    "Gen Z and millennials scrolling TikTok and Instagram Reels",
    "Trendy, fast-paced with viral hooks in the first 2 seconds",
    "Bold colors, punchy text overlays, upbeat background music",
    "TikTok and Instagram Reels",
    "Keep it under 15 seconds with a strong call-to-action",
  ],
  simulation: [
    "Robotics engineers and AI researchers",
    "High physical realism with accurate collision and motion dynamics",
    "Industrial environment with neutral tones and clear sight-lines",
    "Internal training datasets and research demos",
    "Show edge-case scenarios that real cameras rarely capture",
  ],
  walkthrough: [
    "Prospective buyers and onboarding new team members",
    "Clear, step-by-step guidance with friendly narration",
    "Bright and approachable with clean screen recordings",
    "Website, email onboarding sequences, and YouTube",
    "Highlight the 3 most important features or rooms first",
  ],
};

/** Pre-fill answers by fuzzy-matching question keywords against the pool. */
function generatePlaceholderAnswers(questions: string[], brief: string, useCase: UseCase): string[] {
  const pool = PLACEHOLDER_POOL[useCase] ?? PLACEHOLDER_POOL.product_ad;
  return questions.map((q, i) => {
    const ql = q.toLowerCase();
    if (ql.includes("audience") || ql.includes("who") || ql.includes("target")) return pool[0];
    if (ql.includes("message") || ql.includes("selling") || ql.includes("unique") || ql.includes("key")) return pool[1];
    if (ql.includes("visual") || ql.includes("style") || ql.includes("tone") || ql.includes("look")) return pool[2];
    if (ql.includes("platform") || ql.includes("channel") || ql.includes("shown")) return pool[3];
    if (ql.includes("brand") || ql.includes("guideline") || ql.includes("constrain") || ql.includes("specific")) return pool[4];
    // fallback: cycle through pool
    return pool[i % pool.length];
  });
}

type Step = "brief" | "questions" | "loading";

interface QAState {
  session_id: string;
  questions: string[];
  answers: string[];
}

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("brief");
  const [brief, setBrief] = useState("");
  const [useCase, setUseCase] = useState<UseCase>("product_ad");
  const [qa, setQa] = useState<QAState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  async function handleBriefSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brief.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim(), use_case: useCase }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();

      // Pre-fill smart placeholder answers so users can just hit submit
      const placeholders = generatePlaceholderAnswers(data.questions, brief.trim(), useCase);

      setQa({
        session_id: data.session_id,
        questions: data.questions,
        answers: placeholders,
      });
      setStep("questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAnswersSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qa) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: qa.session_id, answers: qa.answers }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);

      setStep("loading");
      router.push(`/generate/${qa.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 h-14 flex items-center gap-3">
        <div className="rounded-lg bg-indigo-600 p-1.5">
          <Clapperboard className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-white text-lg">VidForge</span>
        <span className="text-slate-500 text-sm ml-1">AI Video Framework</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl">

          {step === "brief" && (
            <form onSubmit={handleBriefSubmit} className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-4xl font-bold text-white">What do you want to create?</h1>
                <p className="text-slate-400">Describe your idea. VidForge researches it, generates 3 video variations, and brain-scores each one.</p>
              </div>

              {/* Use case selector */}
              <div className="grid grid-cols-2 gap-3">
                {USE_CASES.map((uc) => (
                  <button
                    key={uc.value}
                    type="button"
                    onClick={() => setUseCase(uc.value)}
                    className={`text-left rounded-xl p-4 border transition-all ${
                      useCase === uc.value
                        ? "border-indigo-500 bg-indigo-950/60"
                        : "border-slate-700 bg-slate-900 hover:border-slate-500"
                    }`}
                  >
                    <div className="font-medium text-white text-sm">{uc.label}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{uc.description}</div>
                  </button>
                ))}
              </div>

              {/* Brief input */}
              <div>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. A product ad for a premium ergonomic standing desk targeting remote workers aged 25–40"
                  rows={4}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={!brief.trim() || isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3.5 font-semibold text-white transition-colors"
              >
                {isSubmitting ? "Thinking..." : "Generate Videos"}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {step === "questions" && qa && (
            <form onSubmit={handleAnswersSubmit} className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <div className="flex items-center justify-center gap-2 text-indigo-400 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-medium uppercase tracking-wider">A few quick questions</span>
                </div>
                <h2 className="text-3xl font-bold text-white">Help us craft the perfect videos</h2>
                <p className="text-slate-400 text-sm">Answers are pre-filled — edit or just hit generate.</p>
              </div>

              <div className="space-y-5">
                {qa.questions.map((question, i) => (
                  <div key={i} className="space-y-2">
                    <label className="text-slate-300 text-sm font-medium">
                      {i + 1}. {question}
                    </label>
                    <input
                      type="text"
                      value={qa.answers[i]}
                      onChange={(e) => {
                        const next = [...qa.answers];
                        next[i] = e.target.value;
                        setQa({ ...qa, answers: next });
                      }}
                      className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:text-white"
                    />
                  </div>
                ))}
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("brief")}
                  className="flex-none px-5 py-3 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-6 py-3 font-semibold text-white transition-colors"
                >
                  {isSubmitting ? "Starting generation..." : "Generate 3 Videos"}
                  {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
