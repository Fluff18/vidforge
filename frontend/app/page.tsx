import Link from "next/link";
import { Brain, ArrowRight, Zap, Database, BarChart3, Layers, ChevronDown, Github } from "lucide-react";

// ── Static data ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Upload your brief",
    body: "Drop in a product image, optional reference video, and describe what you're making. VidForge asks 5 smart follow-up questions to sharpen the brief.",
  },
  {
    n: "02",
    title: "Generate 3 variants",
    body: "Seedance 2.0 renders three cinematically distinct videos — emotional, feature-focused, and viral — each with tailored text overlays, voiceover, and audio.",
  },
  {
    n: "03",
    title: "Brain-score & learn",
    body: "TRIBE v2 scores each video across 5 neural dimensions. Rate what you like — VidForge stores your taste in a self-evolving knowledge base that improves every run.",
  },
];

const FEATURES = [
  { icon: Layers, title: "3 variants per run", body: "Emotional, feature-focused, and bold/viral — every generation covers the full creative space." },
  { icon: Brain, title: "TRIBE v2 brain scoring", body: "Real neural engagement predictions across visual cortex, prefrontal, language, and DMN regions." },
  { icon: Database, title: "Self-evolving knowledge base", body: "Ratings and edit notes persist. Every generation draws on what worked before." },
  { icon: Zap, title: "Text, speech & audio", body: "Prompts automatically include on-screen text, voiceover direction, and music guidance per use case." },
  { icon: BarChart3, title: "Prompt review & edit", body: "See and edit three prompts before video is rendered. Full creative control without re-running." },
  { icon: Layers, title: "Multi-format", body: "Product ads, short-form TikTok/Reels, physical-AI simulations, and walkthrough tours." },
];

const BRAIN_REGIONS = [
  { region: "Visual Cortex", dim: "Visual Engagement", description: "How much the scene activates early visual processing — motion, contrast, colour pop." },
  { region: "Prefrontal (PFC)", dim: "Attention & Clarity", description: "Cognitive load and focus — are the message and CTA registering clearly?" },
  { region: "Temporal (Language)", dim: "Narrative Flow", description: "Story comprehension and verbal memory — does the voiceover land?" },
  { region: "Limbic Adjacent", dim: "Emotional Resonance", description: "Affective arousal — does the video make viewers feel something?" },
  { region: "DMN", dim: "Memory Encoding", description: "Default mode network activation — will viewers remember the brand 24 hours later?" },
];

const FAQS = [
  { q: "Is the brain scoring real?", a: "Yes. VidForge uses Facebook's TRIBE v2 model with a nilearn Destrieux atlas to extract ROI activations from actual fMRI response patterns. It's not a heuristic — it's a neuroscience-backed engagement predictor." },
  { q: "What video model generates the ads?", a: "Seedance 2.0 by BytePlus (Dreamina). It produces cinema-quality text-to-video at up to 1080p with audio support." },
  { q: "How does the knowledge base improve generation?", a: "Every time you rate a video or save a winner, VidForge stores the prompt, scores, and your comments. Future generations are primed with your top three past performers as creative direction." },
  { q: "What file types can I upload?", a: "Product images: JPG, PNG, WebP, GIF. Reference videos: MP4, MOV, WebM. The product image is passed directly to GPT-4o vision for richer prompt generation." },
  { q: "Does it work for non-English content?", a: "The prompt forge supports multi-language briefs — just write your brief in the target language and VidForge will generate prompts and voiceover direction accordingly." },
];

const PRICING = [
  { name: "Free", price: "$0", per: "forever", features: ["5 generations / month", "3 variants per run", "TRIBE v2 scoring", "Local knowledge base"], cta: "Start free", highlight: false },
  { name: "Growth", price: "$49", per: "/ month", features: ["100 generations / month", "Priority Seedance queue", "Cloud knowledge base", "Prompt history & versioning", "Remove watermark"], cta: "Get Growth", highlight: true },
  { name: "Scale", price: "$199", per: "/ month", features: ["Unlimited generations", "Dedicated compute", "Team knowledge base", "API access", "Custom use-case tuning"], cta: "Contact us", highlight: false },
];

// ── Components ────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">VidForge</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-white/40 ml-4">
          <a href="#how-it-works" className="hover:text-white/80 transition-colors">How it works</a>
          <a href="#tribe" className="hover:text-white/80 transition-colors">TRIBE v2</a>
          <a href="#pricing" className="hover:text-white/80 transition-colors">Pricing</a>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a href="https://github.com/Fluff18/vidforge" target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm">
            <Github className="w-4 h-4" />
          </a>
          <Link
            href="/create"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white transition-colors"
          >
            Try it free <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-28 px-6">
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="w-[700px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] translate-y-[-30%]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-1.5 text-xs text-white/50">
            <Brain className="w-3 h-3 text-indigo-400" />
            Powered by TRIBE v2 neural scoring + Seedance 2.0
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] text-white">
            Video ads scored<br />
            <span className="text-indigo-400">by actual brain data</span>
          </h1>

          <p className="text-white/45 text-lg max-w-xl mx-auto leading-relaxed">
            Describe your product. VidForge generates 3 cinematic video variants — complete with
            text overlays, voiceover, and audio — then predicts neural engagement across 5 brain regions.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/create"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-7 py-3.5 font-semibold text-white transition-colors text-sm"
            >
              Start creating for free <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/25 px-7 py-3.5 text-white/50 hover:text-white text-sm transition-colors"
            >
              See how it works <ChevronDown className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Social proof strip ───────────────────────────────────── */}
      <section className="border-y border-white/5 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-white/20 text-xs">
          <span>Trusted by teams at</span>
          <div className="flex items-center gap-8 grayscale opacity-30">
            {["Acme Labs", "Neon Studio", "Phantom AI", "Wavefront", "Sigma Works"].map((name) => (
              <span key={name} className="font-semibold tracking-wide text-sm text-white">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-indigo-400 text-xs font-medium uppercase tracking-widest">How it works</p>
            <h2 className="text-4xl font-bold tracking-tight">From brief to brain-scored video<br />in under 10 minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/8 bg-white/2 p-7 space-y-4">
                <span className="text-4xl font-bold text-indigo-600/30">{s.n}</span>
                <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature bento ────────────────────────────────────────── */}
      <section className="py-8 pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-indigo-400 text-xs font-medium uppercase tracking-widest">Features</p>
            <h2 className="text-4xl font-bold tracking-tight">Everything you need to make<br />ads that actually perform</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-2xl border border-white/8 bg-white/2 p-6 space-y-3 hover:border-indigo-500/30 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/15 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white text-sm">{f.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRIBE v2 explainer ────────────────────────────────────── */}
      <section id="tribe" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
            <div className="space-y-6">
              <div>
                <p className="text-indigo-400 text-xs font-medium uppercase tracking-widest mb-3">TRIBE v2</p>
                <h2 className="text-4xl font-bold tracking-tight leading-tight">
                  Real neuroscience,<br />not guesswork
                </h2>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">
                TRIBE v2 is Facebook&apos;s brain-response model trained on thousands of fMRI recordings.
                VidForge runs each video through it and maps activation to five anatomical regions using
                the Destrieux 2009 atlas — giving you a principled breakdown of how the ad performs neurally.
              </p>
              <Link href="/create" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                See it in action <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2">
              {BRAIN_REGIONS.map((r) => (
                <div key={r.region} className="rounded-xl border border-white/6 bg-white/2 px-5 py-4 flex gap-4 items-start">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-white text-sm font-medium">{r.dim}</span>
                      <span className="text-white/25 text-xs">via {r.region}</span>
                    </div>
                    <p className="text-white/40 text-xs leading-relaxed">{r.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Self-evolving KB ─────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-64 h-64">
                <div className="absolute inset-0 rounded-full border border-white/8" />
                {[
                  { label: "Generate", top: "4%", left: "50%", tw: "-translate-x-1/2" },
                  { label: "Brain-score", top: "50%", left: "90%", tw: "-translate-y-1/2 -translate-x-1/2" },
                  { label: "Rate & Save", top: "88%", left: "60%", tw: "-translate-x-1/2" },
                  { label: "Learn", top: "88%", left: "38%", tw: "-translate-x-1/2" },
                  { label: "Improve", top: "50%", left: "8%", tw: "-translate-y-1/2" },
                ].map((n) => (
                  <div
                    key={n.label}
                    className={`absolute transform ${n.tw} bg-[#0a0a0f] border border-indigo-500/30 text-indigo-300 text-[11px] font-medium rounded-full px-3 py-1.5`}
                    style={{ top: n.top, left: n.left }}
                  >
                    {n.label}
                  </div>
                ))}
                <div className="absolute inset-[28%] rounded-full border border-indigo-600/30 bg-indigo-600/5 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-indigo-500/50" />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <p className="text-indigo-400 text-xs font-medium uppercase tracking-widest">Self-evolving</p>
              <h2 className="text-4xl font-bold tracking-tight leading-tight">
                Gets smarter<br />every generation
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                Every video you rate — or mark as a winner — adds a data point to your private knowledge base.
                The next time you run VidForge, it retrieves your top performers and uses them as creative direction,
                so the model learns your brand&apos;s taste over time without any manual configuration.
              </p>
              <ul className="space-y-2 text-sm text-white/50">
                {["Stores prompt, brain scores, and your edit notes", "Top-3 best performers feed into every new generation", "Survives across sessions — your brand memory, persistent"].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-indigo-400 text-xs font-medium uppercase tracking-widest">Pricing</p>
            <h2 className="text-4xl font-bold tracking-tight">Start free. Scale when ready.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-7 flex flex-col gap-6 ${
                  tier.highlight
                    ? "border-indigo-500/60 bg-indigo-950/30"
                    : "border-white/8 bg-white/2"
                }`}
              >
                <div>
                  <div className="text-white/50 text-sm mb-1">{tier.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{tier.price}</span>
                    <span className="text-white/30 text-sm">{tier.per}</span>
                  </div>
                </div>
                <ul className="space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/50">
                      <span className="text-indigo-400 mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/create"
                  className={`rounded-xl px-5 py-2.5 text-sm font-medium text-center transition-colors ${
                    tier.highlight
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                      : "border border-white/10 hover:border-white/25 text-white/60 hover:text-white"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-indigo-400 text-xs font-medium uppercase tracking-widest">FAQ</p>
            <h2 className="text-4xl font-bold tracking-tight">Common questions</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-white/8 bg-white/2 px-7 py-6 space-y-3">
                <h3 className="font-semibold text-white text-sm">{faq.q}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-white/25 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-600/80 flex items-center justify-center">
              <Brain className="w-3 h-3 text-white" />
            </div>
            <span className="text-white/50 font-medium">VidForge</span>
            <span>— AI video ads, scored by actual brain data</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/Fluff18/vidforge" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors flex items-center gap-1.5"><Github className="w-3.5 h-3.5" /> GitHub</a>
            <Link href="/create" className="hover:text-white/60 transition-colors">Create</Link>
            <span>© 2026 VidForge</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
