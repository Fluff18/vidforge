"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brain, ArrowRight, Sparkles, Upload, X, ImageIcon, Film, ArrowLeft, Mic, MicOff, Volume2 } from "lucide-react";
import type { UseCase } from "../types";
import Link from "next/link";

const USE_CASES: { value: UseCase; label: string; description: string }[] = [
  { value: "product_ad",  label: "Product Ad",          description: "Turn a product into a polished video ad" },
  { value: "short_form",  label: "Short-Form Content",  description: "Vertical video for TikTok, Reels, Shorts" },
  { value: "simulation",  label: "AI Simulation",       description: "Synthetic training data for physical AI" },
  { value: "walkthrough", label: "Walkthrough",         description: "Property, onboarding, or explainer tours" },
];

const PLACEHOLDER_POOL: Record<UseCase, string[]> = {
  product_ad:  ["Tech-savvy professionals and remote workers aged 25–40","Premium quality, ergonomic design, and long-term health benefits","Sleek and modern with clean whites and warm accent lighting","Instagram, LinkedIn, and YouTube pre-roll","Focus on the health benefits and productivity boost"],
  short_form:  ["Gen Z and millennials scrolling TikTok and Instagram Reels","Trendy, fast-paced with viral hooks in the first 2 seconds","Bold colors, punchy text overlays, upbeat background music","TikTok and Instagram Reels","Keep it under 15 seconds with a strong call-to-action"],
  simulation:  ["Robotics engineers and AI researchers","High physical realism with accurate collision and motion dynamics","Industrial environment with neutral tones and clear sight-lines","Internal training datasets and research demos","Show edge-case scenarios that real cameras rarely capture"],
  walkthrough: ["Prospective buyers and onboarding new team members","Clear, step-by-step guidance with friendly narration","Bright and approachable with clean screen recordings","Website, email onboarding sequences, and YouTube","Highlight the 3 most important features or rooms first"],
};

function matchAnswers(questions: string[], brief: string, useCase: UseCase): string[] {
  const pool = PLACEHOLDER_POOL[useCase] ?? PLACEHOLDER_POOL.product_ad;
  return questions.map((q, i) => {
    const ql = q.toLowerCase();
    if (ql.includes("audience") || ql.includes("who") || ql.includes("target")) return pool[0];
    if (ql.includes("message") || ql.includes("selling") || ql.includes("unique") || ql.includes("key")) return pool[1];
    if (ql.includes("visual") || ql.includes("style") || ql.includes("tone") || ql.includes("look")) return pool[2];
    if (ql.includes("platform") || ql.includes("channel") || ql.includes("shown")) return pool[3];
    if (ql.includes("brand") || ql.includes("guideline") || ql.includes("constrain")) return pool[4];
    return pool[i % pool.length];
  });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

type Step = "brief" | "questions";
type DictationTarget = "brief" | `answer-${number}` | null;

interface QAState {
  session_id: string;
  questions: string[];
  answers: string[];
}

interface UploadedAsset {
  file: File;
  preview: string;
  base64: string;
}

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    0: { transcript: string };
    length: number;
  }>;
}

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("brief");
  const [brief, setBrief] = useState("");
  const [useCase, setUseCase] = useState<UseCase>("product_ad");
  const [qa, setQa] = useState<QAState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productImage, setProductImage] = useState<UploadedAsset | null>(null);
  const [refVideo, setRefVideo] = useState<UploadedAsset | null>(null);
  const [imageDragging, setImageDragging] = useState(false);
  const [dictationTarget, setDictationTarget] = useState<DictationTarget>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const dictationTargetRef = useRef<DictationTarget>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    dictationTargetRef.current = dictationTarget;
  }, [dictationTarget]);

  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const ctor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!ctor) return;

    const recognition = new ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (!transcript) return;

      setError(null);
      if (dictationTargetRef.current === "brief") {
        setBrief(transcript);
        return;
      }

      if (!dictationTargetRef.current?.startsWith("answer-")) return;
      const index = Number(dictationTargetRef.current.replace("answer-", ""));
      if (Number.isNaN(index)) return;

      setQa((currentQa) => {
        if (!currentQa) return currentQa;
        const answers = [...currentQa.answers];
        answers[index] = transcript;
        return { ...currentQa, answers };
      });
    };

    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow microphone access in your browser to talk to VidForge."
          : "Voice input failed. Try again or type your response."
      );
      setDictationTarget(null);
    };

    recognition.onend = () => {
      setDictationTarget(null);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function loadAsset(file: File): Promise<UploadedAsset> {
    const base64 = await fileToBase64(file);
    const preview = URL.createObjectURL(file);
    return { file, preview, base64 };
  }

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const asset = await loadAsset(file);
    setProductImage(asset);
  }, []);

  const handleVideoFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) return;
    const asset = await loadAsset(file);
    setRefVideo(asset);
  }, []);

  function toggleDictation(target: Exclude<DictationTarget, null>) {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge, or keep typing.");
      return;
    }

    setError(null);
    if (dictationTarget === target) {
      recognition.stop();
      setDictationTarget(null);
      return;
    }

    if (dictationTarget) recognition.stop();
    setDictationTarget(target);
    recognition.start();
  }

  function speakText(text: string) {
    if (!("speechSynthesis" in window)) {
      setError("Speech playback is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function handleBriefSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brief.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        brief: brief.trim(),
        use_case: useCase,
      };
      if (productImage) {
        body.product_image = `data:${productImage.file.type};base64,${productImage.base64}`;
      }
      if (refVideo) {
        body.reference_video_name = refVideo.file.name;
        body.reference_video_type = refVideo.file.type;
      }

      const res = await fetch(`${API}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();

      const placeholders = matchAnswers(data.questions, brief.trim(), useCase);
      setQa({ session_id: data.session_id, questions: data.questions, answers: placeholders });
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
      router.push(`/generate/${qa.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#070b18] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[320px] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <header className="relative border-b border-white/10 px-6 h-14 flex items-center gap-3 bg-[#070b18]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">VidForge</span>
        </Link>
        <span className="text-white/20 text-sm">/ Create</span>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 sm:p-7">
          {step === "brief" && (
            <form onSubmit={handleBriefSubmit} className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-4xl font-bold text-white tracking-tight">What are we creating?</h1>
                <p className="text-white/40 text-sm leading-relaxed">
                  Add your brief, drop in a product image, and optionally a reference video.
                  VidForge generates 3 variants scored by real brain data. You can type or talk.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {USE_CASES.map((uc) => (
                  <button
                    key={uc.value}
                    type="button"
                    onClick={() => setUseCase(uc.value)}
                    className={`text-left rounded-xl p-4 border transition-all ${
                      useCase === uc.value
                        ? "border-indigo-500/70 bg-indigo-950/50"
                        : "border-white/8 bg-white/3 hover:border-white/20"
                    }`}
                  >
                    <div className="font-medium text-white text-sm">{uc.label}</div>
                    <div className="text-white/40 text-xs mt-0.5">{uc.description}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-white/40 text-xs mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" /> Product image <span className="text-white/20">(optional)</span>
                  </p>
                  {productImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={productImage.preview} alt="Product" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { URL.revokeObjectURL(productImage.preview); setProductImage(null); }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`rounded-xl border-2 border-dashed aspect-video flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                        imageDragging ? "border-indigo-500 bg-indigo-950/20" : "border-white/10 hover:border-white/25"
                      }`}
                      onClick={() => imageInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
                      onDragLeave={() => setImageDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setImageDragging(false);
                        const file = e.dataTransfer.files[0];
                        if (file) handleImageFile(file);
                      }}
                    >
                      <Upload className="w-5 h-5 text-white/25" />
                      <span className="text-white/30 text-xs">Drop or click to upload</span>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
                  />
                </div>

                <div>
                  <p className="text-white/40 text-xs mb-2 flex items-center gap-1.5">
                    <Film className="w-3 h-3" /> Reference video <span className="text-white/20">(optional)</span>
                  </p>
                  {refVideo ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black">
                      <video src={refVideo.preview} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Film className="w-6 h-6 text-white/60" />
                      </div>
                      <div className="absolute bottom-2 left-2 right-8 text-white/60 text-[10px] truncate">
                        {refVideo.file.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => { URL.revokeObjectURL(refVideo.preview); setRefVideo(null); }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="rounded-xl border-2 border-dashed aspect-video flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors border-white/10 hover:border-white/25"
                      onClick={() => videoInputRef.current?.click()}
                    >
                      <Film className="w-5 h-5 text-white/25" />
                      <span className="text-white/30 text-xs">Style reference</span>
                    </div>
                  )}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. A premium ergonomic standing desk for remote workers — focus on health and productivity"
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60 resize-none text-sm leading-relaxed"
                />
                {speechSupported ? (
                  <button
                    type="button"
                    onClick={() => toggleDictation("brief")}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
                      dictationTarget === "brief"
                        ? "border-red-500/60 bg-red-950/30 text-red-200"
                        : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25"
                    }`}
                  >
                    {dictationTarget === "brief" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {dictationTarget === "brief" ? "Stop listening" : "Talk to VidForge"}
                  </button>
                ) : (
                  <p className="text-xs text-white/30">Voice input works in supported browsers like Chrome or Edge.</p>
                )}
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={!brief.trim() || isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3.5 font-semibold text-white transition-colors"
              >
                {isSubmitting ? "Thinking..." : "Continue"}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {step === "questions" && qa && (
            <form onSubmit={handleAnswersSubmit} className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <div className="flex items-center justify-center gap-2 text-indigo-400 mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-widest">Quick questions</span>
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Help us nail the brief</h2>
                <p className="text-white/40 text-sm">Answers are pre-filled. Edit them, speak them, or have VidForge read the questions aloud.</p>
                {qa.questions.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => speakText(qa.questions.map((question, i) => `Question ${i + 1}. ${question}`).join(". "))}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75 hover:border-white/25 transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                      Read questions aloud
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {qa.questions.map((question, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-white/60 text-sm font-medium">
                        {i + 1}. {question}
                      </label>
                      <button
                        type="button"
                        onClick={() => speakText(question)}
                        className="inline-flex items-center gap-1 text-xs text-white/45 hover:text-white/80 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Read aloud
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={qa.answers[i]}
                        onChange={(e) => {
                          const next = [...qa.answers];
                          next[i] = e.target.value;
                          setQa({ ...qa, answers: next });
                        }}
                        className="flex-1 rounded-xl border border-white/10 bg-white/3 px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/60"
                      />
                      {speechSupported && (
                        <button
                          type="button"
                          onClick={() => toggleDictation(`answer-${i}`)}
                          className={`flex-none rounded-xl border px-3 py-2.5 transition-colors ${
                            dictationTarget === `answer-${i}`
                              ? "border-red-500/60 bg-red-950/30 text-red-200"
                              : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25"
                          }`}
                          title={dictationTarget === `answer-${i}` ? "Stop listening" : "Answer by voice"}
                        >
                          {dictationTarget === `answer-${i}` ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("brief")}
                  className="flex-none flex items-center gap-1.5 px-5 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-colors text-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-6 py-3 font-semibold text-white transition-colors"
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
