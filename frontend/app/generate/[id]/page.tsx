"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Brain } from "lucide-react";

const STEPS = [
  { key: "researched",        label: "Researching with MiroMind..." },
  { key: "prompts_ready",     label: "Crafting 3 video prompts..." },
  { key: "generating_videos", label: "Generating videos with Seedance..." },
  { key: "videos_ready",      label: "Generating videos with Seedance..." },
  { key: "scored",            label: "Brain-scoring with TRIBE v2..." },
  { key: "delivered",         label: "Done! Loading results..." },
];

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    let attempt = 0;
    const MAX = 72; // 72 × 5s = 6 min max

    const interval = setInterval(async () => {
      attempt++;
      if (attempt > MAX) {
        clearInterval(interval);
        setError("Generation timed out. Please try again.");
        return;
      }

      try {
        const res = await fetch(`${API}/api/status/${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();

        const stepIdx = STEPS.findIndex((s) => s.key === data.status);
        if (stepIdx > currentStep) setCurrentStep(stepIdx);

        if (data.status === "error") {
          clearInterval(interval);
          setError(data.error ?? "Generation failed.");
        }

        if (data.status === "prompts_ready") {
          clearInterval(interval);
          router.push(`/prompts/${sessionId}`);
        }

        if (data.status === "delivered") {
          clearInterval(interval);
          router.push(`/results/${sessionId}`);
        }
      } catch {
        // ignore transient fetch errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId, router, API, currentStep]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#070b18] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[640px] h-[280px] rounded-full bg-indigo-600/10 blur-[100px]" />
      </div>

      <div className="relative text-center max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm px-7 py-9">
        {/* Pulsing brain icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-indigo-950/70 border border-indigo-500/40 p-6 animate-pulse">
            <Brain className="w-12 h-12 text-indigo-400" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {error ? "Something went wrong" : "Creating your videos..."}
          </h2>
          {error ? (
            <p className="text-red-400">{error}</p>
          ) : (
            <p className="text-white/65 text-sm">
              {STEPS[Math.min(currentStep, STEPS.length - 1)].label}
            </p>
          )}
        </div>

        {/* Step progress */}
        {!error && (
          <div className="space-y-3 text-left">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full flex-none transition-colors ${
                    i < currentStep
                      ? "bg-indigo-400"
                      : i === currentStep
                      ? "bg-indigo-400 animate-pulse"
                      : "bg-white/20"
                  }`}
                />
                <span
                  className={`text-sm ${
                      i <= currentStep ? "text-white/80" : "text-white/35"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <button
            onClick={() => router.push("/create")}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
