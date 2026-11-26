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
  RotateCcw,
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
            <a href="#launch-film" className="px-1.5 py-1 underline-offset-4 hover:text-[#9e1c12] hover:underline">
              Launch Film
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
            <a href="#engine" className="px-1.5 py-1 underline-offset-4 hover:text-[#9e1c12] hover:underline">
              AI Director
            </a>
            <span aria-hidden className="text-[#4a4744]">/</span>
            <a href={repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-1.5 py-1 underline-offset-4 hover:text-[#9e1c12] hover:underline">
              GitHub <ArrowUpRight size={13} />
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
                Prompt the built-in AI Director to build live HTML shots, scrub every frame by hand, and export crisp MP4s—with 100 free starter credits.
              </p>
              <p className="mt-1.5 text-[13px] font-medium text-[#4a4744]">
                Four browser workbenches · Google, Microsoft &amp; GitHub login
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

        {/* Below-the-Fold Band 1: Product Hunt Launch Video Theater */}
        <section id="launch-film" className="border-b border-[#191918] bg-[#eee0db] py-14 sm:py-16">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="fillim-display text-[36px] leading-[0.98] text-[#191918] sm:text-[46px]">
                  WATCH THE FILLIM LAUNCH FILM
                </h2>
                <p className="mt-2 text-[15px] font-medium text-[#4a4744]">
                  Made inside Fillim · 1920×1080 MP4, Product Hunt ready
                </p>
              </div>

              <a
                href="/api/media/fillim-launch.mp4?download=1"
                download="fillim-launch-producthunt.mp4"
                className="fillim-btn-press inline-flex items-center gap-2 self-start rounded-lg border border-[#191918] bg-[#fbf4f1] px-4 py-2.5 text-[13.5px] font-semibold text-[#191918] hover:bg-[#191918] hover:text-[#f6eae6]"
              >
                <Download size={15} />
                Download Product Hunt MP4
              </a>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border-2 border-[#191918] bg-[#161615]">
              <CalibrationStrip />
              <div className="relative aspect-video w-full bg-[#161615]">
                <video
                  src="/api/media/fillim-launch.mp4"
                  poster="/api/media/fillim-launch-poster.jpg"
                  aria-label="Fillim launch film, 24 seconds"
                  controls
                  playsInline
                  preload="none"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#3a3633] bg-[#161615] px-5 py-3 text-[13px] text-[#f6eae6]">
                <span className="fillim-mono">H.264 High Profile · 1080p 30fps · Stereo AAC (-14 LUFS)</span>
                <span className="text-[#cfc6c0]">Rendered directly through Fillim&apos;s own Chromium + FFmpeg pipeline</span>
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
                <span className="fillim-mono text-[12.5px] text-[#cfc6c0]">Synced to controls above · t={t.toFixed(2)}s</span>
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

        {/* Below-the-Fold Band 4: Early Access & Open Foundation */}
        <section className="bg-[#f6eae6] py-14 sm:py-16">
          <div className="mx-auto grid max-w-[1440px] gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="flex flex-col justify-between rounded-xl border-2 border-[#191918] bg-[#fbf4f1] p-6 sm:p-8 lg:col-span-7">
              <div>
                <h2 className="fillim-display text-[36px] leading-none text-[#191918]">
                  START CREATING WITH 100 FREE CREDITS
                </h2>
                <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#4a4744]">
                  Jump straight into the browser editor with Google, Microsoft, GitHub, or email—with AI Director chat and all four editing workbenches ready on arrival.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => (user ? onOpenWorkspace() : onLaunchAuth('sign-up'))}
                  className="fillim-btn-press rounded-lg border border-[#191918] bg-[#ca281b] px-5 py-2.5 text-[14.5px] font-semibold text-[#fffaf8] hover:bg-[#9e1c12]"
                >
                  {user ? 'Open Workspace' : 'Create Free Workspace'}
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchAuth('sign-in')}
                  className="fillim-btn-press rounded-lg border border-[#191918] bg-[#f6eae6] px-5 py-2.5 text-[14.5px] font-semibold text-[#191918] hover:bg-[#eee0db]"
                >
                  Sign in with Google, Microsoft or GitHub
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border-2 border-[#191918] bg-[#161615] p-6 text-[#f6eae6] sm:p-8 lg:col-span-5">
              <div>
                <h2 className="fillim-display text-[36px] leading-none text-[#f6eae6]">
                  OPEN ENGINE. INSPECT EVERY LINE.
                </h2>
                <p className="mt-3 text-[14.5px] leading-relaxed text-[#cfc6c0]">
                  Built on OpenFilm under MIT. Self-host Fillim Cloud Studio, extend panels with plugins, and keep every timeline readable plain HTML.
                </p>
              </div>
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center justify-between rounded-lg border border-[#f6eae6] px-4 py-2.5 text-[14px] font-semibold text-[#f6eae6] transition-colors hover:bg-[#f6eae6] hover:text-[#191918]"
              >
                <span>playlikemen/fillim</span>
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#191918] bg-[#f6eae6] py-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-4 px-4 text-[13.5px] text-[#4a4744] sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-[#191918]">
            <FillimMark size={18} />
            <span className="font-medium">Fillim Studio · Built on OpenFilm (MIT)</span>
          </div>
          <div className="flex items-center gap-5 font-medium text-[#191918]">
            <a href="#launch-film" className="underline-offset-4 hover:text-[#9e1c12] hover:underline">
              Launch Video
            </a>
            <a href={repoUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-[#9e1c12] hover:underline">
              GitHub
            </a>
            <button
              type="button"
              onClick={() => onLaunchAuth('sign-in')}
              className="underline-offset-4 hover:text-[#9e1c12] hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
