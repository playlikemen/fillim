import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Download,
  Film,
  Layers,
  MessageSquareText,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  CalibrationStrip,
  DYE_CHANNELS,
  FillimMark,
  StageFrameCanvas,
  type DyeChannel,
} from './FillimBrand';
import type { SaasUser } from './auth-client';
import './saas.css';

interface LandingPageProps {
  user: SaasUser | null;
  repoUrl: string;
  onLaunchAuth: (mode: 'sign-in' | 'sign-up') => void;
  onOpenWorkspace: () => void;
}

type TrackId = 'screening' | 'edit' | 'canvas' | 'color';

const WORKBENCH_TRACKS: Array<{
  id: TrackId;
  num: string;
  code: string;
  title: string;
  lane: string;
  summary: string;
  capabilities: string[];
}> = [
  {
    id: 'screening',
    num: '01',
    code: 'V1',
    title: 'Screening',
    lane: 'Watch every frame full-bleed',
    summary: 'Scrub to any millisecond, mark exact moments or spans, and click elements inside a shot to send crystal-clear notes to AI Director.',
    capabilities: ['Frame-accurate SMPTE scrub', 'Region & layer pointing for AI edits', 'Zero quality loss between edit and export'],
  },
  {
    id: 'edit',
    num: '02',
    code: 'V2',
    title: 'Edit',
    lane: 'Multi-track timeline & overrides',
    summary: 'Trim clips, split scenes, add kinetic captions, and fine-tune typography. Your manual cuts never get erased when AI rewrites code.',
    capabilities: ['Non-destructive shot overrides', 'WebVTT captions & synchronized audio mix', 'One-click MP4, WebM & NLE XML export'],
  },
  {
    id: 'canvas',
    num: '03',
    code: 'V3',
    title: 'Canvas',
    lane: 'Visual storyboards & shot flow',
    summary: 'Arrange scene beats, reference stills, prompts, and audio notes side by side before assembling ordered cuts straight onto your timeline.',
    capabilities: ['Spatial node boards saved in cloud workspace', 'Character & visual consistency pinning', 'Instant one-click timeline assembly'],
  },
  {
    id: 'color',
    num: '04',
    code: 'A1',
    title: 'Color',
    lane: 'Live scopes, wheels & .cube LUTs',
    summary: 'Grade web animations and camera footage together using real-time waveform, parade, vectorscope, curves, and cinema LUTs.',
    capabilities: ['Real-time WebGL scope telemetry', '.cube LUT grading across shots and HTML', 'Exact color match in downloadable renders'],
  },
];

const EDGE_CODES = [
  { sec: 0, label: '0000+00' },
  { sec: 1, label: '0001+00' },
  { sec: 2, label: '0002+00' },
  { sec: 3, label: '0003+00' },
  { sec: 4, label: '0004+00' },
];

const EXPOSURE_STRIPS = [
  { t: 0.0, label: '0.00s', inverted: false },
  { t: 1.33, label: '1.33s', inverted: true },
  { t: 2.66, label: '2.66s', inverted: true },
  { t: 4.0, label: '4.00s', inverted: true },
];

const SPROCKET_COUNT = 10;

type PlanId = 'free' | 'creator' | 'studio';

const PLANS: Array<{
  id: PlanId;
  name: string;
  price: string;
  term: string;
  credits: string;
  pitch: string;
  features: string[];
  dye: DyeChannel;
}> = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    term: 'forever',
    credits: '100 credits',
    pitch: 'Try the whole studio on a real film.',
    features: ['All four workbenches', 'AI Director chat', 'MP4 export up to 1080p'],
    dye: '#087774',
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '₹499',
    term: '30-day pass',
    credits: '1,000 credits',
    pitch: 'For a steady run of launch videos, explainers and shorts.',
    features: ['Everything in Free', '1080p MP4 and WebM export', 'Premiere, Resolve and Final Cut XML export', 'Priority renders'],
    dye: '#ca281b',
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '₹1,499',
    term: '30-day pass',
    credits: '5,000 credits',
    pitch: 'For teams and channels shipping films every week.',
    features: ['Everything in Creator', 'Larger AI Director budget', 'Priority support'],
    dye: '#193885',
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What is Fillim?',
    a: 'Fillim is a film studio in your browser. Describe a shot and the AI Director builds it, then you cut, caption, grade and export it on a real multi-track timeline.',
  },
  {
    q: 'Do I need to know how to code?',
    a: 'No. You can direct everything in plain language and edit on the timeline by hand. Every shot is readable HTML underneath, so developers can open the code whenever they want.',
  },
  {
    q: 'What is a credit?',
    a: 'Credits are spent when the AI Director works on your film and when you render exports. Every new account starts with 100 free credits; a pass tops your balance up.',
  },
  {
    q: 'Can I take my edit into Premiere, Resolve or Final Cut?',
    a: 'Yes. Besides MP4 and WebM, Fillim exports timeline interchange files (FCPXML and XML) that open in Final Cut Pro, Premiere Pro and DaVinci Resolve.',
  },
  {
    q: 'Do passes renew automatically? Can I get a refund?',
    a: 'Passes never auto-renew: you pay once through Razorpay and the pass runs for 30 days. If a payment goes wrong, open an issue at github.com/playlikemen/fillim and we will sort it out.',
  },
];

function formatTimecode(seconds: number) {
  const clamped = Math.max(0, Math.min(4, seconds));
  const totalFrames = Math.round(clamped * 30);
  const secs = Math.floor(totalFrames / 30);
  const frames = totalFrames % 30;
  return `00:00:0${secs}:${String(frames).padStart(2, '0')}`;
}

export function LandingPage({ user, repoUrl, onLaunchAuth, onOpenWorkspace }: LandingPageProps) {
  const [activeTrack, setActiveTrack] = useState<TrackId>('edit');
  const [t, setT] = useState(1.5);
  const [playing, setPlaying] = useState(true);
  const [headlineOverride, setHeadlineOverride] = useState('Fillim Studio');
  const [accentOverride, setAccentOverride] = useState<DyeChannel>('#ca281b');

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      if (last != null) {
        const dt = (now - last) / 1000;
        setT((prev) => {
          const next = prev + dt;
          return next >= 4 ? 0 : next;
        });
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const activeSecond = Math.min(4, Math.floor(t + 0.5));
  const selectedTrack = WORKBENCH_TRACKS.find((w) => w.id === activeTrack) ?? WORKBENCH_TRACKS[1]!;

  const choosePlan = (plan: PlanId) => {
    if (plan === 'free') {
      if (user) onOpenWorkspace();
      else onLaunchAuth('sign-up');
      return;
    }
    if (user) {
      window.location.href = `/projects?upgrade=${plan}`;
      return;
    }
    try {
      sessionStorage.setItem('fillim.upgrade', plan);
    } catch {
      /* private mode: the plan is picked again after sign-up */
    }
    onLaunchAuth('sign-up');
  };

  const jumpToTrack = (trackId: TrackId) => {
    setActiveTrack(trackId);
    document.getElementById('workbenches')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="fillim-saas min-h-screen overflow-x-hidden bg-[#f6eae6] text-[#191918] antialiased">
      {/* Row 1: Four-Segment Optical Calibration Strip */}
      <CalibrationStrip />

      {/* Row 2: Ruled Header */}
      <header className="sticky top-0 z-40 border-b border-[#191918] bg-[#f6eae6]">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex shrink-0 items-center gap-2.5 text-[#191918]"
          >
            <FillimMark size={24} />
            <span className="fillim-display text-[28px] leading-none tracking-[0.02em] sm:text-[32px]">
              FILLIM
            </span>
          </a>

          <nav aria-label="Studio navigation" className="hidden items-center gap-4 text-[14px] font-medium text-[#191918] md:flex">
            <a href="#how-it-works" className="px-1.5 py-1 underline-offset-4 hover:text-[#9e1c12] hover:underline">
              How it works
            </a>
            <span aria-hidden className="text-[#4a4744]">/</span>
            <button
              type="button"
              onClick={() => jumpToTrack('edit')}
              className="px-1.5 py-1 underline-offset-4 hover:text-[#9e1c12] hover:underline"
            >
              Workbenches
            </button>
            <span aria-hidden className="text-[#4a4744]">/</span>
            <a href="#launch-film" className="px-1.5 py-1 underline-offset-4 hover:text-[#9e1c12] hover:underline">
              Launch film
            </a>
            <span aria-hidden className="text-[#4a4744]">/</span>
            <a href="#pricing" className="px-1.5 py-1 underline-offset-4 hover:text-[#9e1c12] hover:underline">
              Pricing
            </a>
            <span aria-hidden className="text-[#4a4744]">/</span>
            <a href="#faq" className="px-1.5 py-1 underline-offset-4 hover:text-[#9e1c12] hover:underline">
              FAQ
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            {user ? (
              <>
                <span className="fillim-mono hidden text-[12.5px] text-[#4a4744] sm:inline">{user.email}</span>
                <button
                  type="button"
                  onClick={onOpenWorkspace}
                  className="fillim-btn-press rounded-lg border border-[#191918] bg-[#191918] px-4 py-1.5 text-[13.5px] font-semibold text-[#f6eae6] hover:bg-[#9e1c12]"
                >
                  Open Studio
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onLaunchAuth('sign-in')}
                  className="px-2 py-1.5 text-[14px] font-medium text-[#191918] underline-offset-4 hover:text-[#9e1c12] hover:underline"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchAuth('sign-up')}
                  className="fillim-btn-press rounded-lg border border-[#191918] bg-[#191918] px-4 py-1.5 text-[13.5px] font-semibold text-[#f6eae6] hover:bg-[#9e1c12]"
                >
                  Start Free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-col">
        {/* Row 3: Master Optical Gate Stage + Edge-Code Rail + Tactile Inspector */}
        <section aria-label="Interactive live shot stage" className="border-b border-[#191918]">
          <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[42px_144px_minmax(0,1fr)_304px]">
            {/* 35mm Black Sprocket Strip */}
            <div aria-hidden className="hidden flex-col justify-between bg-[#191918] px-2.5 py-3 lg:flex">
              {Array.from({ length: SPROCKET_COUNT }, (_, i) => {
                const active = Math.round((t / 4) * (SPROCKET_COUNT - 1)) === i;
                return (
                  <div
                    key={i}
                    className={`h-3.5 w-full rounded-[3px] transition-colors ${active ? 'bg-[#ca281b]' : 'bg-[#f6eae6]'}`}
                  />
                );
              })}
            </div>

            {/* Vertical Edge-Code Ledger */}
            <div className="hidden flex-col justify-between border-r border-[#191918] bg-[#f6eae6] px-4 py-5 lg:flex">
              {EDGE_CODES.map((code) => {
                const isActive = activeSecond === code.sec;
                return (
                  <button
                    key={code.label}
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setT(code.sec);
                    }}
                    className={`fillim-mono text-left text-[14px] transition-colors ${
                      isActive ? 'font-semibold text-[#9e1c12]' : 'text-[#4a4744] hover:text-[#191918]'
                    }`}
                  >
                    {code.label}
                  </button>
                );
              })}
            </div>

            {/* Center Projection-Booth Viewport */}
            <div className="bg-[#161615] p-3 sm:p-4 lg:p-5">
              <div className="aspect-[16/10] w-full overflow-hidden rounded-lg border border-[#3a3633] lg:aspect-auto lg:h-[336px]">
                <StageFrameCanvas
                  t={t}
                  headline={headlineOverride}
                  activeDye={accentOverride}
                  variant="hero"
                />
              </div>
            </div>

            {/* Right Tactile Override Inspector */}
            <aside className="flex flex-col border-t border-[#191918] bg-[#f6eae6] lg:border-l lg:border-t-0">
              <div className="border-b border-[#191918] px-4 py-3">
                <label htmlFor="landing-headline-override" className="block text-[13px] font-semibold text-[#191918]">
                  Live Title Override
                </label>
                <input
                  id="landing-headline-override"
                  type="text"
                  maxLength={28}
                  value={headlineOverride}
                  onChange={(e) => setHeadlineOverride(e.target.value)}
                  placeholder="Fillim Studio"
                  className="mt-1.5 h-9 w-full rounded-md border border-[#191918] bg-[#fbf4f1] px-3 text-[14px] font-medium text-[#191918] placeholder-[#4a4744]"
                />
              </div>

              <div className="border-b border-[#191918] px-4 py-3">
                <div className="text-[13px] font-semibold text-[#191918]">Three-Strip Palette</div>
                <div className="mt-2 flex items-center gap-3">
                  {DYE_CHANNELS.map((swatch) => {
                    const selected = accentOverride === swatch.hex;
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        aria-label={`Switch optical channel to ${swatch.name}`}
                        aria-pressed={selected}
                        onClick={() => setAccentOverride(swatch.hex)}
                        className={`h-10 w-10 rounded-md border transition-transform ${
                          selected
                            ? 'scale-[1.04] border-2 border-[#191918] shadow-[2px_2px_0_#191918]'
                            : 'border-[#191918] opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="border-b border-[#191918] px-4 py-3">
                <label htmlFor="landing-smpte-scrubber" className="block text-[13px] font-semibold text-[#191918]">
                  Deterministic Frame Scrub
                </label>
                <div className="mt-2">
                  <input
                    id="landing-smpte-scrubber"
                    type="range"
                    min={0}
                    max={4}
                    step={0.01}
                    value={t}
                    onChange={(e) => {
                      setPlaying(false);
                      setT(Number(e.target.value));
                    }}
                    className="fillim-range"
                  />
                </div>
                <div className="fillim-mono mt-2 flex items-center justify-between text-[14.5px] font-medium text-[#191918]">
                  <span>{formatTimecode(t)}</span>
                  <span className="text-[12.5px] text-[#4a4744]">t={t.toFixed(2)}s</span>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-2.5 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="fillim-btn-press flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#191918] bg-[#fbf4f1] px-4 text-[14px] font-semibold uppercase tracking-[0.06em] text-[#191918] hover:bg-[#191918] hover:text-[#f6eae6]"
                >
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                  {playing ? 'PAUSE' : 'PLAY'}
                </button>
                <button
                  type="button"
                  aria-label="Restart deterministic playback"
                  onClick={() => {
                    setT(0);
                    setPlaying(true);
                  }}
                  className="fillim-btn-press flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#191918] bg-[#fbf4f1] text-[#191918] hover:bg-[#191918] hover:text-[#f6eae6]"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* Row 4: Stepped Exposure Test-Strip Dock */}
        <section aria-label="Stepped exposure keyframes" className="border-b border-[#191918] bg-[#161615] py-2.5">
          <div className="mx-auto grid max-w-[960px] grid-cols-2 gap-3 px-4 sm:grid-cols-4 sm:px-6">
            {EXPOSURE_STRIPS.map((strip) => {
              const near = Math.abs(t - strip.t) < 0.65;
              return (
                <button
                  key={strip.label}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setT(strip.t);
                  }}
                  aria-label={`Jump to frame ${strip.label}`}
                  className={`group relative aspect-[16/9] overflow-hidden rounded-md border transition-colors ${
                    near ? 'border-2 border-[#ca281b]' : 'border-[#4a4744] hover:border-[#f6eae6]'
                  }`}
                >
                  <StageFrameCanvas
                    t={strip.t}
                    headline={headlineOverride}
                    activeDye={accentOverride}
                    variant="strip"
                    inverted={strip.inverted}
                  />
                  <span className="fillim-mono absolute bottom-1 right-1 rounded bg-[#161615] px-1.5 py-0.5 text-[12px] font-medium text-[#f6eae6]">
                    {strip.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Row 5: Lower Hero Bridge (Cleanly inside 1376x768 fold) */}
        {/* Below lg the promise and CTA lead; the playable stage follows directly under them */}
        <section className="order-first border-b border-[#191918] bg-[#f6eae6] py-6 lg:order-none lg:py-5">
          <div className="mx-auto grid max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="lg:col-span-6">
              <h1 className="fillim-display text-[40px] leading-[0.94] tracking-[0.01em] text-[#191918] sm:text-[50px] lg:text-[52px]">
                DIRECT FILMS IN CODE. CUT ON THE TIMELINE.
              </h1>
            </div>

            <div className="lg:col-span-4">
              <p className="text-[15.5px] leading-[1.45] text-[#191918]">
                Tell Fillim&apos;s AI Director what you want on screen. It builds the shots; you cut them on a real timeline and export a finished MP4.
              </p>
              <p className="mt-1.5 text-[13px] font-medium text-[#4a4744]">
                Runs in your browser · 100 free credits · No card needed
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 lg:col-span-2 lg:items-end">
              {user ? (
                <button
                  type="button"
                  onClick={onOpenWorkspace}
                  className="fillim-btn-press w-full rounded-lg border border-[#191918] bg-[#ca281b] px-5 py-2.5 text-center text-[15px] font-semibold text-[#fffaf8] hover:bg-[#9e1c12] lg:w-auto"
                >
                  Open Studio
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onLaunchAuth('sign-up')}
                  className="fillim-btn-press w-full rounded-lg border border-[#191918] bg-[#ca281b] px-5 py-2.5 text-center text-[15px] font-semibold text-[#fffaf8] hover:bg-[#9e1c12] lg:w-auto"
                >
                  Start Creating Free
                </button>
              )}
              <a
                href="#launch-film"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#191918] underline underline-offset-4 hover:text-[#9e1c12]"
              >
                Watch launch video
                <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </section>


        {/* How it works: one strip of film read left to right, three exposures */}
        <section id="how-it-works" aria-labelledby="how-heading" className="border-b border-[#191918] bg-[#161615] text-[#f6eae6]">
          <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <h2 id="how-heading" className="fillim-display text-[36px] leading-[0.98] sm:text-[46px]">
                PROMPT. CUT. EXPORT.
              </h2>
              <p className="max-w-[46ch] text-[15px] leading-relaxed text-[#cfc6c0]">
                One film moves through three passes. Nothing is a reroll: every change you make by hand stays put.
              </p>
            </div>

            <ol className="mt-9 grid border-y border-[#4a4744] lg:grid-cols-[1.15fr_1fr_0.85fr]">
              <li className="flex flex-col gap-5 border-b border-[#4a4744] py-6 lg:border-b-0 lg:border-r lg:pr-8">
                <div className="flex items-baseline gap-3">
                  <span className="fillim-mono text-[13px] text-[#ef6a5c]">00:00</span>
                  <h3 className="fillim-display text-[30px] leading-none">Prompt the AI Director</h3>
                </div>
                <div className="rounded-lg border border-[#4a4744] bg-[#1f1e1c] p-4">
                  <p className="text-[14px] leading-relaxed text-[#f6eae6]">
                    “Open on our logo, slam the tagline in word by word, then cut to the product shot at four seconds.”
                  </p>
                  <p className="fillim-mono mt-3 flex items-center gap-2 text-[12.5px] text-[#8fd3cf]">
                    <MessageSquareText size={14} /> 3 shots written · film.html saved
                  </p>
                </div>
                <p className="text-[14.5px] leading-relaxed text-[#cfc6c0]">
                  Describe the film in plain words. The AI Director writes each shot and the preview reloads as it saves.
                </p>
              </li>

              <li className="flex flex-col gap-5 border-b border-[#4a4744] py-6 lg:border-b-0 lg:border-r lg:px-8">
                <div className="flex items-baseline gap-3">
                  <span className="fillim-mono text-[13px] text-[#8fd3cf]">00:04</span>
                  <h3 className="fillim-display text-[30px] leading-none">Cut it by hand</h3>
                </div>
                <div aria-hidden className="space-y-1.5 rounded-lg border border-[#4a4744] bg-[#1f1e1c] p-4">
                  <div className="flex gap-1.5">
                    <div className="h-5 w-[34%] rounded-sm bg-[#ca281b]" />
                    <div className="h-5 w-[22%] rounded-sm bg-[#ca281b]/70" />
                    <div className="h-5 flex-1 rounded-sm bg-[#ca281b]" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-5 w-[18%]" />
                    <div className="h-5 w-[48%] rounded-sm bg-[#087774]" />
                    <div className="h-5 flex-1 rounded-sm bg-[#087774]/60" />
                  </div>
                  <div className="h-3 w-full rounded-sm bg-[#3a5bb0]" />
                  <div className="relative h-0">
                    <Scissors size={14} className="absolute -top-[46px] left-[56%] text-[#f6eae6]" />
                  </div>
                </div>
                <p className="text-[14.5px] leading-relaxed text-[#cfc6c0]">
                  Trim, split, retime, caption and grade on a multi-track timeline. Your edits survive every later AI pass.
                </p>
              </li>

              <li className="flex flex-col gap-5 py-6 lg:pl-8">
                <div className="flex items-baseline gap-3">
                  <span className="fillim-mono text-[13px] text-[#9fb4ea]">00:08</span>
                  <h3 className="fillim-display text-[30px] leading-none">Export</h3>
                </div>
                <ul className="fillim-mono space-y-1.5 text-[13px]">
                  {['launch.mp4 · 1080p', 'launch.webm', 'launch.fcpxml', 'launch.xml · Premiere / Resolve'].map((f) => (
                    <li key={f} className="flex items-center gap-2 rounded-md border border-[#4a4744] bg-[#1f1e1c] px-3 py-2">
                      <Download size={13} className="shrink-0 text-[#9fb4ea]" /> {f}
                    </li>
                  ))}
                </ul>
                <p className="text-[14.5px] leading-relaxed text-[#cfc6c0]">
                  What you scrubbed is what renders, frame for frame. Download it or finish it in your usual editor.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Below-the-Fold Band 1: Launch Video Theater */}
        <section id="launch-film" className="border-b border-[#191918] bg-[#eee0db] py-14 sm:py-16">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="fillim-display text-[36px] leading-[0.98] text-[#191918] sm:text-[46px]">
                  WATCH THE LAUNCH FILM
                </h2>
                <p className="mt-2 text-[15px] font-medium text-[#4a4744]">
                  Directed, cut and exported entirely in Fillim · 1920×1080
                </p>
              </div>

              <a
                href="/api/media/fillim-launch.mp4?download=1"
                download="fillim-launch.mp4"
                className="fillim-btn-press inline-flex items-center gap-2 self-start rounded-lg border border-[#191918] bg-[#fbf4f1] px-4 py-2.5 text-[13.5px] font-semibold text-[#191918] hover:bg-[#191918] hover:text-[#f6eae6]"
              >
                <Download size={15} />
                Download MP4
              </a>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border-2 border-[#191918] bg-[#161615]">
              <CalibrationStrip />
              <div className="relative aspect-video w-full bg-[#161615]">
                <video
                  src="/api/media/fillim-launch.mp4?v=2"
                  poster="/api/media/fillim-launch-poster.jpg?v=2"
                  aria-label="Fillim launch film, 33 seconds"
                  controls
                  playsInline
                  preload="none"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#3a3633] bg-[#161615] px-5 py-3 text-[13px] text-[#f6eae6]">
                <span className="fillim-mono">1080p · 30fps · H.264 + AAC</span>
                <span className="text-[#cfc6c0]">Rendered by Fillim&apos;s own export pipeline</span>
              </div>
            </div>
          </div>
        </section>

        {/* Below-the-Fold Band 2: Four-Track Workbench Ledger */}
        <section id="workbenches" className="border-b border-[#191918] bg-[#f6eae6] py-14 sm:py-16">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-6">
                <h2 className="fillim-display text-[36px] leading-[0.98] text-[#191918] sm:text-[46px]">
                  FOUR WORKBENCHES ON ONE SHARED FILM
                </h2>
              </div>
              <p className="text-[15.5px] leading-relaxed text-[#4a4744] lg:col-span-6">
                Every clip inside Fillim lives in inspectable <code className="fillim-mono rounded border border-[#191918]/20 bg-[#eee0db] px-1.5 py-0.5 text-[13.5px] text-[#191918]">film.html</code>. Your manual trims, text overrides, and color grades stay layered cleanly over generated code.
              </p>
            </div>

            <div className="mt-10 grid overflow-hidden rounded-xl border-2 border-[#191918] lg:grid-cols-12">
              <div className="divide-y divide-[#191918] border-b border-[#191918] lg:col-span-5 lg:border-b-0 lg:border-r-2">
                {WORKBENCH_TRACKS.map((track) => {
                  const selected = track.id === activeTrack;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => setActiveTrack(track.id)}
                      className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-colors ${
                        selected
                          ? 'bg-[#191918] text-[#f6eae6]'
                          : 'bg-[#f6eae6] text-[#191918] hover:bg-[#eee0db]'
                      }`}
                    >
                      <span
                        className={`fillim-mono flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-[13px] font-semibold ${
                          selected
                            ? 'border-[#ca281b] bg-[#ca281b] text-[#fffaf8]'
                            : 'border-[#191918] bg-[#fbf4f1] text-[#191918]'
                        }`}
                      >
                        {track.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-bold">
                          {track.num} / {track.title}
                        </div>
                        <div className={`text-[13.5px] ${selected ? 'text-[#e5d8d3]' : 'text-[#4a4744]'}`}>
                          {track.lane}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col justify-between bg-[#fbf4f1] p-6 sm:p-8 lg:col-span-7">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#191918] pb-3">
                    <span className="fillim-mono inline-flex items-center gap-2 text-[13px] font-semibold text-[#075d5b]">
                      {activeTrack === 'screening' ? (
                        <Film size={15} />
                      ) : activeTrack === 'edit' ? (
                        <Sliders size={15} />
                      ) : activeTrack === 'canvas' ? (
                        <Layers size={15} />
                      ) : (
                        <Palette size={15} />
                      )}
                      {selectedTrack.code} · {selectedTrack.title} Workbench
                    </span>
                    <span className="fillim-mono text-[12.5px] text-[#4a4744]">Included in Studio</span>
                  </div>

                  <h3 className="fillim-display mt-5 text-[30px] leading-none text-[#191918]">
                    {selectedTrack.lane}
                  </h3>
                  <p className="mt-3 max-w-[54ch] text-[15.5px] leading-relaxed text-[#4a4744]">
                    {selectedTrack.summary}
                  </p>

                  <ul className="mt-6 space-y-2.5 border-t border-[#191918]/20 pt-5">
                    {selectedTrack.capabilities.map((cap) => (
                      <li key={cap} className="flex items-center gap-2.5 text-[14.5px] font-medium text-[#191918]">
                        <Check size={15} className="shrink-0 text-[#075d5b]" />
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#191918] pt-5">
                  <span className="fillim-mono text-[13px] text-[#4a4744]">
                    Ready in your browser with zero installs
                  </span>
                  <button
                    type="button"
                    onClick={() => (user ? onOpenWorkspace() : onLaunchAuth('sign-up'))}
                    className="fillim-btn-press rounded-lg border border-[#191918] bg-[#191918] px-4 py-2 text-[13.5px] font-semibold text-[#f6eae6] hover:bg-[#9e1c12]"
                  >
                    {user ? 'Open in Studio' : 'Try This Workbench'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Below-the-Fold Band 3: Built-In AI Director + Readable Film Source */}
        <section id="engine" className="border-b border-[#191918] bg-[#eee0db] py-14 sm:py-16">
          <div className="mx-auto grid max-w-[1440px] gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="lg:col-span-6">
              <h2 className="fillim-display text-[36px] leading-[0.98] text-[#191918] sm:text-[46px]">
                AI DIRECTOR BUILT RIGHT INSIDE STUDIO
              </h2>
              <div className="mt-6 divide-y divide-[#191918] overflow-hidden rounded-xl border-2 border-[#191918] bg-[#f6eae6]">
                <div className="flex items-start gap-3.5 p-4">
                  <MessageSquareText size={18} className="mt-0.5 shrink-0 text-[#9e1c12]" />
                  <div>
                    <div className="text-[15px] font-bold text-[#191918]">Chat Live Beside Your Timeline</div>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#4a4744]">
                      Ask Fillim&apos;s AI Director to scaffold title cards, motion graphics, or pacing tweaks—every save hot-reloads in Studio immediately.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3.5 p-4">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-[#075d5b]" />
                  <div>
                    <div className="text-[15px] font-bold text-[#191918]">Deterministic Code Shots</div>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#4a4744]">
                      No roulette video rerolls. Because scenes run a pure <code className="fillim-mono text-[12.5px]">window.film.frame(t)</code> function, pausing, scrubbing, and 1080p MP4 export match frame-for-frame.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3.5 p-4">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#193885]" />
                  <div>
                    <div className="text-[15px] font-bold text-[#191918]">Private Cloud Workspaces</div>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#4a4744]">
                      Sign in once with Google, Microsoft, GitHub, or email to duplicate projects, track renders, and export MP4, WebM, or Final Cut XML.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border-2 border-[#191918] bg-[#161615] text-[#f6eae6] lg:col-span-6">
              <div className="flex items-center justify-between border-b border-[#4a4744] px-4 py-3">
                <span className="fillim-mono text-[13px] font-medium text-[#f6eae6]">film.html</span>
                <span className="fillim-mono hidden text-[12.5px] text-[#cfc6c0] sm:inline">Synced to controls above · t={t.toFixed(2)}s</span>
              </div>
              <pre className="fillim-mono flex-1 overflow-x-auto p-5 text-[13px] leading-[1.7] text-[#f6eae6]">
{`<meta name="viewport" content="width=1920, height=1080">
<section>
  <iframe
    src="title.html#t=0,4"
    overrides='[{"at":"h1","text":"${headlineOverride || 'Fillim Studio'}","style":{"color":"${accentOverride}"}}]'
  ></iframe>
</section>
<section>
  <video src="assets/footage.mp4#t=4,12" at="4"></video>
</section>
<section>
  <audio src="assets/score.mp3" volume="0.65"></audio>
</section>`}
              </pre>
            </div>
          </div>
        </section>

        {/* Pricing: three passes ruled like a camera report */}
        <section id="pricing" aria-labelledby="pricing-heading" className="border-b border-[#191918] bg-[#f6eae6] py-14 sm:py-16">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
              <h2 id="pricing-heading" className="fillim-display text-[36px] leading-[0.98] text-[#191918] sm:text-[46px] lg:col-span-6">
                START FREE. BUY A PASS WHEN YOU SHIP.
              </h2>
              <p className="text-[15.5px] leading-relaxed text-[#4a4744] lg:col-span-6">
                Passes are one-time payments in rupees through Razorpay. They last 30 days and never auto-renew, so there is nothing to cancel.
              </p>
            </div>

            <div className="mt-10 grid overflow-hidden rounded-xl border-2 border-[#191918] lg:grid-cols-3">
              {PLANS.map((plan, i) => {
                const featured = plan.id === 'creator';
                return (
                  <div
                    key={plan.id}
                    className={`flex flex-col ${i > 0 ? 'border-t-2 border-[#191918] lg:border-l-2 lg:border-t-0' : ''} ${
                      featured ? 'bg-[#191918] text-[#f6eae6]' : 'bg-[#fbf4f1] text-[#191918]'
                    }`}
                  >
                    <div aria-hidden className="h-2" style={{ backgroundColor: plan.dye }} />
                    <div className="flex flex-1 flex-col p-6 sm:p-7">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="fillim-display text-[30px] leading-none">{plan.name}</h3>
                        {featured && (
                          <span className="fillim-mono rounded border border-[#ef6a5c] px-2 py-0.5 text-[12px] text-[#ef6a5c]">Most picked</span>
                        )}
                      </div>
                      <p className={`mt-2 text-[14.5px] ${featured ? 'text-[#cfc6c0]' : 'text-[#4a4744]'}`}>{plan.pitch}</p>
                      <div className="mt-6 flex items-baseline gap-2">
                        <span className="fillim-display text-[56px] leading-none">{plan.price}</span>
                        <span className={`text-[14px] font-medium ${featured ? 'text-[#cfc6c0]' : 'text-[#4a4744]'}`}>{plan.term}</span>
                      </div>
                      <p className="fillim-mono mt-2 text-[14px] font-semibold">{plan.credits}</p>
                      <ul className={`mt-5 space-y-2.5 border-t pt-5 ${featured ? 'border-[#4a4744]' : 'border-[#191918]/20'}`}>
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-[14.5px] font-medium">
                            <Check size={15} className={`mt-[3px] shrink-0 ${featured ? 'text-[#8fd3cf]' : 'text-[#075d5b]'}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => choosePlan(plan.id)}
                        className={`fillim-btn-press mt-7 w-full rounded-lg border px-5 py-2.5 text-[15px] font-semibold ${
                          featured
                            ? 'border-[#f6eae6] bg-[#ca281b] text-[#fffaf8] hover:bg-[#9e1c12]'
                            : 'border-[#191918] bg-[#f6eae6] text-[#191918] hover:bg-[#191918] hover:text-[#f6eae6]'
                        }`}
                      >
                        {plan.id === 'free' ? (user ? 'Open Studio' : 'Start free') : `Get ${plan.name} · ${plan.price}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[13.5px] text-[#4a4744]">
              <ShieldCheck size={15} className="shrink-0 text-[#193885]" />
              Payments are handled securely by Razorpay. Fillim never sees your card details.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="border-b border-[#191918] bg-[#eee0db] py-14 sm:py-16">
          <div className="mx-auto grid max-w-[1440px] gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <h2 id="faq-heading" className="fillim-display text-[36px] leading-[0.98] text-[#191918] sm:text-[46px] lg:col-span-4">
              QUESTIONS BEFORE YOU ROLL
            </h2>
            <div className="divide-y divide-[#191918] border-y border-[#191918] lg:col-span-8">
              {FAQS.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16.5px] font-semibold text-[#191918] hover:text-[#9e1c12] [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Plus size={18} className="shrink-0 transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="max-w-[68ch] pb-5 text-[15px] leading-relaxed text-[#4a4744]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="bg-[#161615] text-[#f6eae6]">
          <CalibrationStrip />
          <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div>
              <h2 className="fillim-display text-[40px] leading-[0.96] sm:text-[56px]">YOUR NEXT FILM STARTS WITH ONE SENTENCE.</h2>
              <p className="mt-3 max-w-[56ch] text-[15.5px] leading-relaxed text-[#cfc6c0]">
                Sign in with Google, Microsoft, GitHub or email. You get 100 free credits and the full studio straight away.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (user ? onOpenWorkspace() : onLaunchAuth('sign-up'))}
              className="fillim-btn-press shrink-0 rounded-lg border border-[#f6eae6] bg-[#ca281b] px-6 py-3 text-[16px] font-semibold text-[#fffaf8] hover:bg-[#9e1c12]"
            >
              {user ? 'Open Studio' : 'Start creating free'}
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#191918] bg-[#f6eae6] py-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-4 px-4 text-[13.5px] text-[#4a4744] sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 text-[#191918]">
              <FillimMark size={18} />
              <span className="font-semibold">Fillim</span>
              <span>· Cloud film studio</span>
            </div>
            <span className="text-[12.5px]">
              Built on the open-source{' '}
              <a href="https://github.com/openfilm/openfilm" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[#9e1c12]">
                OpenFilm
              </a>{' '}
              engine (MIT)
            </span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2 font-medium text-[#191918]">
            <a href="#pricing" className="underline-offset-4 hover:text-[#9e1c12] hover:underline">
              Pricing
            </a>
            <a href="#faq" className="underline-offset-4 hover:text-[#9e1c12] hover:underline">
              FAQ
            </a>
            <a href="#launch-film" className="underline-offset-4 hover:text-[#9e1c12] hover:underline">
              Launch film
            </a>
            <a href={repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:text-[#9e1c12] hover:underline">
              GitHub <ArrowUpRight size={13} />
            </a>
            <button
              type="button"
              onClick={() => onLaunchAuth('sign-in')}
              className="underline-offset-4 hover:text-[#9e1c12] hover:underline"
            >
              Sign in
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
