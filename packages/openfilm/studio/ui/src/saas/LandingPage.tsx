import { useEffect, useMemo, useRef, useState } from 'react';
import { Film, Layers, Palette, Play, Pause, RotateCcw, Sliders, Sparkles, Terminal, Check, ArrowUpRight, ShieldCheck, Database, Cpu } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import type { SaasUser } from './auth-client';

interface LandingPageProps {
  user: SaasUser | null;
  repoUrl: string;
  onLaunchAuth: (mode: 'sign-in' | 'sign-up') => void;
  onOpenWorkspace: () => void;
}

type TrackId = 'screening' | 'edit' | 'canvas' | 'color';

const WORKBENCH_TRACKS: Array<{
  id: TrackId;
  code: string;
  title: string;
  lane: string;
  summary: string;
  capabilities: string[];
}> = [
  {
    id: 'screening',
    code: 'V1',
    title: 'Screening',
    lane: 'Review & spatial critique',
    summary: 'Watch every frame full-bleed, mark exact moments or spans, and point directly at elements inside a shot.',
    capabilities: ['Frame-accurate SMPTE scrub', 'Region & layer pointing', 'Live bridge to coding agents'],
  },
  {
    id: 'edit',
    code: 'V2',
    title: 'Edit',
    lane: 'Multi-track timeline & inspector',
    summary: 'Trim, split, reorder, animate word-by-word typography, and export MP4, WebM, or NLE timelines.',
    capabilities: ['Non-destructive shot overrides', 'WebVTT captions & waveform mix', 'FCPXML / Premiere / Resolve XML'],
  },
  {
    id: 'canvas',
    code: 'V3',
    title: 'Canvas',
    lane: 'Storyboard & generative nodes',
    summary: 'Plan scenes, characters, prompts, and generated media side-by-side before sending ordered cuts to V1.',
    capabilities: ['Spatial node boards in Postgres', 'Character & reference pinning', 'One-click timeline assembly'],
  },
  {
    id: 'color',
    code: 'A1',
    title: 'Color',
    lane: 'Scopes, wheels & .cube LUTs',
    summary: 'Grade video and web shots with real-time waveform, parade, vectorscope, curves, and camera log LUTs.',
    capabilities: ['Live WebGL scope pipeline', '.cube LUT grading parity', 'What you preview is exported'],
  },
];

function formatTimecode(seconds: number) {
  const clamped = Math.max(0, Math.min(4, seconds));
  const totalFrames = Math.round(clamped * 30);
  const secs = Math.floor(totalFrames / 30);
  const frames = totalFrames % 30;
  return `00:00:0${secs}:${String(frames).padStart(2, '0')}`;
}

/**
 * Fillim SaaS landing page.
 * Palette: projection-booth obsidian (#06070a), NLE console slate (#0e1117),
 * archival silver ink (#f3f5f7), optical cyan (#00a3ae), film-stock amber (#e5a93b).
 */
export function LandingPage({ user, repoUrl, onLaunchAuth, onOpenWorkspace }: LandingPageProps) {
  const [activeTrack, setActiveTrack] = useState<TrackId>('edit');
  const [t, setT] = useState(1.65);
  const [playing, setPlaying] = useState(true);
  const [headlineOverride, setHeadlineOverride] = useState('Fillim Studio');
  const [accentOverride, setAccentOverride] = useState<'#00a3ae' | '#e5a93b' | '#e06c75'>('#00a3ae');
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      lastFrameRef.current = null;
      return;
    }
    let raf = 0;
    const step = (now: number) => {
      if (lastFrameRef.current != null) {
        const dt = (now - lastFrameRef.current) / 1000;
        setT((prev) => {
          const next = prev + dt;
          return next >= 4 ? 0 : next;
        });
      }
      lastFrameRef.current = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const progress = Math.min(1, Math.max(0, t / 4));
  const titleIn = Math.min(1, t / 0.85);
  const easeOut = 1 - Math.pow(1 - titleIn, 3);
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.5);

  const bars = useMemo(
    () => Array.from({ length: 24 }, (_, idx) => {
      const wave = Math.sin(t * 3.1 + idx * 0.55) * 0.45 + 0.55;
      return Math.max(14, Math.round(wave * 100));
    }),
    [t],
  );

  const selectedTrack = WORKBENCH_TRACKS.find((w) => w.id === activeTrack) ?? WORKBENCH_TRACKS[1]!;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#06070a] text-[#f3f5f7] antialiased selection:bg-[#00a3ae]/30">
      {/* Top Cinema Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#06070a]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <a href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2.5 text-[#f3f5f7]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#0e1117] text-[#00a3ae]">
              <BrandLogo size={18} />
            </span>
            <span className="text-[16px] font-semibold tracking-[-0.02em]">Fillim</span>
            <span className="rounded border border-[#00a3ae]/35 bg-[#00a3ae]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#5ce1ea]">
              CLOUD
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-[13.5px] text-[#8d96a5] md:flex">
            <a href="#stage" className="transition hover:text-[#f3f5f7]">Engine</a>
            <a href="#workbenches" className="transition hover:text-[#f3f5f7]">Workbenches</a>
            <a href="#architecture" className="transition hover:text-[#f3f5f7]">Architecture</a>
            <a href="#plans" className="transition hover:text-[#f3f5f7]">Pricing</a>
            <a href={repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition hover:text-[#f3f5f7]">
              GitHub <ArrowUpRight size={13} />
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {user ? (
              <>
                <span className="hidden font-mono text-[12px] text-[#8d96a5] sm:inline">{user.email}</span>
                <button
                  type="button"
                  onClick={onOpenWorkspace}
                  className="rounded-lg bg-[#f3f5f7] px-3.5 py-2 text-[13px] font-semibold text-[#06070a] transition hover:bg-white"
                >
                  Open workspace
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onLaunchAuth('sign-in')}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#c5ccd6] transition hover:bg-white/[0.06] hover:text-white"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchAuth('sign-up')}
                  className="rounded-lg bg-[#00a3ae] px-3.5 py-2 text-[13px] font-semibold text-[#041416] transition hover:bg-[#19b9c4]"
                >
                  Start free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero: Asymmetric Editorial Typography + Interactive Deterministic Frame Stage */}
      <section id="stage" className="relative border-b border-white/[0.08]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[440px]"
          style={{
            background: 'radial-gradient(60% 55% at 72% 18%, rgba(0, 163, 174, 0.16), transparent 72%), radial-gradient(40% 45% at 22% 28%, rgba(229, 169, 59, 0.08), transparent 70%)',
          }}
        />
        <div className="relative mx-auto grid max-w-[1240px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-20">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0e1117] px-3 py-1 font-mono text-[11.5px] text-[#9fb0c2]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e5a93b]" />
              OpenFilm Engine · Neon Postgres & Auth
            </div>

            <h1 className="mt-6 text-[40px] font-semibold leading-[1.03] tracking-[-0.038em] text-[#f3f5f7] sm:text-[54px]">
              Film at the speed of code.
            </h1>

            <p className="mt-5 max-w-[46ch] text-[16px] leading-[1.6] text-[#9aa4b2]">
              Fillim turns web pages and AI coding agents into a cloud video studio. Edit every shot by hand on a real timeline, grade with scopes, and keep your manual overrides separate from generated code.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={onOpenWorkspace}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#f3f5f7] px-5 py-2.5 text-[14px] font-semibold text-[#06070a] transition hover:bg-white"
                >
                  <Film size={16} />
                  Open your workspace
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onLaunchAuth('sign-up')}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#f3f5f7] px-5 py-2.5 text-[14px] font-semibold text-[#06070a] transition hover:bg-white"
                >
                  <Sparkles size={16} />
                  Create free workspace
                </button>
              )}
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#0e1117] px-4 py-2.5 text-[14px] font-medium text-[#dbe1ea] transition hover:border-white/30 hover:text-white"
              >
                <Terminal size={15} />
                playlikemen/fillim
              </a>
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-white/[0.08] pt-6 font-mono">
              <div>
                <dt className="text-[11px] text-[#7a8494]">Format</dt>
                <dd className="mt-1 text-[13.5px] font-medium text-[#f3f5f7]">film.html</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#7a8494]">Clock</dt>
                <dd className="mt-1 text-[13.5px] font-medium text-[#f3f5f7]">window.film.frame(t)</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#7a8494]">Cloud State</dt>
                <dd className="mt-1 text-[13.5px] font-medium text-[#5ce1ea]">Neon Postgres</dd>
              </div>
            </dl>
          </div>

          {/* Interactive window.film Stage */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#0e1117] shadow-[0_28px_80px_rgba(0,0,0,0.65)]">
              {/* Stage Chrome Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
                <div className="flex items-center gap-2 font-mono text-[11.5px] text-[#8d96a5]">
                  <span className="h-2 w-2 rounded-full" style={{ background: accentOverride }} />
                  <span>title.html#t=0,4</span>
                  <span className="text-white/20">/</span>
                  <span>1920×1080</span>
                </div>
                <div className="font-mono text-[12px] tabular-nums text-[#e5a93b]">
                  {formatTimecode(t)} <span className="text-[#697383]">/ 00:00:04:00</span>
                </div>
              </div>

              {/* Rendered deterministic frame(t) */}
              <div className="relative aspect-video w-full overflow-hidden bg-[#080a0f] p-6 sm:p-10">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                  }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl transition-colors"
                  style={{ background: accentOverride, opacity: 0.14 + pulse * 0.1 }}
                />

                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between font-mono text-[11px] text-[#8d96a5]">
                    <span>SCENE 01 · DETERMINISTIC RENDER</span>
                    <span className="rounded border border-white/10 bg-black/40 px-2 py-0.5 tabular-nums">
                      t = {t.toFixed(2)}s
                    </span>
                  </div>

                  <div
                    style={{
                      opacity: easeOut,
                      transform: `translateY(${(1 - easeOut) * 18}px) scale(${0.97 + easeOut * 0.03})`,
                    }}
                  >
                    <p className="font-mono text-[12px]" style={{ color: accentOverride }}>
                      frame({t.toFixed(2)})
                    </p>
                    <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-white sm:text-[42px]">
                      {headlineOverride || 'Fillim Studio'}
                    </h2>
                    <p className="mt-2 max-w-[38ch] text-[13.5px] text-[#9aa4b2]">
                      Same picture at every seek, preview, and headless Chromium render.
                    </p>
                  </div>

                  {/* Animated audio waveform / frame grid */}
                  <div className="flex h-10 items-end gap-1">
                    {bars.map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm transition-colors"
                        style={{
                          height: `${height}%`,
                          background: i / bars.length <= progress ? accentOverride : 'rgba(255,255,255,0.14)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Scrubber & Live Override Controls */}
              <div className="border-t border-white/[0.08] bg-[#0b0e14] px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={playing ? 'Pause preview' : 'Play preview'}
                    onClick={() => setPlaying((p) => !p)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/12 bg-[#141922] text-white transition hover:border-white/25"
                  >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    type="button"
                    aria-label="Restart preview"
                    onClick={() => { setT(0); setPlaying(true); }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/12 bg-[#141922] text-[#9aa4b2] transition hover:text-white"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={0.01}
                    value={t}
                    aria-label="Scrub frame time"
                    onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }}
                    className="h-1.5 flex-1 cursor-pointer accent-[#00a3ae]"
                  />
                </div>

                {/* Live non-destructive override editor */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[#7a8494]">overrides:</span>
                    <input
                      type="text"
                      value={headlineOverride}
                      maxLength={28}
                      onChange={(e) => setHeadlineOverride(e.target.value)}
                      aria-label="Edit shot title override"
                      className="h-7 w-40 rounded border border-white/12 bg-[#141922] px-2 font-mono text-[12px] text-white outline-none focus:border-[#00a3ae]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['#00a3ae', '#e5a93b', '#e06c75'] as const).map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        aria-label={`Set override accent ${hex}`}
                        onClick={() => setAccentOverride(hex)}
                        className={`h-5 w-5 rounded-full border transition ${accentOverride === hex ? 'scale-110 border-white' : 'border-white/20 opacity-70 hover:opacity-100'}`}
                        style={{ background: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workbenches as Interactive Multi-Track NLE Strip */}
      <section id="workbenches" className="border-b border-white/[0.08] py-16 sm:py-20">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="max-w-[58ch]">
            <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[34px]">
              Four workbenches on one shared film.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#9aa4b2]">
              Every edit you make by hand writes clean overrides into <code className="font-mono text-[13.5px] text-[#5ce1ea]">film.html</code>, while AI agents build right beside you.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-12">
            {/* Left Track Selector */}
            <div className="flex flex-col gap-2 lg:col-span-5">
              {WORKBENCH_TRACKS.map((track) => {
                const selected = track.id === activeTrack;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setActiveTrack(track.id)}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition ${
                      selected
                        ? 'border-[#00a3ae]/60 bg-[#0e1117]'
                        : 'border-white/[0.08] bg-[#0a0c11] hover:border-white/20'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-semibold ${
                      selected ? 'bg-[#00a3ae] text-[#041416]' : 'bg-white/[0.06] text-[#9aa4b2]'
                    }`}>
                      {track.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium text-white">{track.title}</div>
                      <div className="truncate text-[12.5px] text-[#8d96a5]">{track.lane}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Active Track Console */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0e1117] p-6 sm:p-8 lg:col-span-7">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-mono text-[12px] text-[#5ce1ea]">
                    {activeTrack === 'screening' ? <Film size={15} /> : activeTrack === 'edit' ? <Sliders size={15} /> : activeTrack === 'canvas' ? <Layers size={15} /> : <Palette size={15} />}
                    {selectedTrack.code} · {selectedTrack.title} Workbench
                  </span>
                  <span className="font-mono text-[11.5px] text-[#697383]">Plugin Standard</span>
                </div>
                <h3 className="mt-4 text-[24px] font-semibold tracking-[-0.02em] text-white">
                  {selectedTrack.lane}
                </h3>
                <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-[#a8b2c0]">
                  {selectedTrack.summary}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {selectedTrack.capabilities.map((cap) => (
                    <li key={cap} className="flex items-center gap-2.5 text-[14px] text-[#dbe1ea]">
                      <Check size={15} className="shrink-0 text-[#00a3ae]" />
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 flex items-center justify-between border-t border-white/[0.08] pt-5">
                <span className="font-mono text-[12px] text-[#8d96a5]">Runs inside your browser workspace</span>
                <button
                  type="button"
                  onClick={() => (user ? onOpenWorkspace() : onLaunchAuth('sign-up'))}
                  className="rounded-lg bg-white/[0.08] px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-white/[0.14]"
                >
                  {user ? 'Open in Studio' : 'Try in Studio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture: Deterministic Code + Neon Cloud Backend */}
      <section id="architecture" className="border-b border-white/[0.08] py-16 sm:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6">
            <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[34px]">
              Plain HTML shots, backed by cloud persistence.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#9aa4b2]">
              No proprietary binary timeline lock-in. Your film is an inspectable folder with <code className="font-mono text-[13px] text-[#f3f5f7]">film.html</code>, while Fillim Cloud secures multi-tenant auth, workspace ownership, and export telemetry in Neon.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3.5 rounded-xl border border-white/[0.08] bg-[#0e1117] p-4">
                <Database size={18} className="mt-0.5 shrink-0 text-[#00a3ae]" />
                <div>
                  <div className="text-[14.5px] font-medium text-white">Neon Lakebase Postgres</div>
                  <p className="mt-1 text-[13.5px] text-[#8d96a5]">Stores user profiles, isolated project ownership, credit balances, and export audit events with branchable Postgres.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 rounded-xl border border-white/[0.08] bg-[#0e1117] p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#e5a93b]" />
                <div>
                  <div className="text-[14.5px] font-medium text-white">Neon Auth + Isolated Origins</div>
                  <p className="mt-1 text-[13.5px] text-[#8d96a5]">Managed Better Auth with EdDSA JWT verification keeps user workspaces strictly isolated across editor, film preview, and plugin origins.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 rounded-xl border border-white/[0.08] bg-[#0e1117] p-4">
                <Cpu size={18} className="mt-0.5 shrink-0 text-[#9fb0c2]" />
                <div>
                  <div className="text-[14.5px] font-medium text-white">Headless Chromium + FFmpeg Renders</div>
                  <p className="mt-1 text-[13.5px] text-[#8d96a5]">Server-side Playwright and FFmpeg render deterministic frames straight to downloadable MP4, WebM, and ProRes deliverables.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#0b0e14]">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5 font-mono text-[12px] text-[#8d96a5]">
                <span>film.html</span>
                <span>SPEC v0.4</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.65] text-[#d6deeb]">
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
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="border-b border-white/[0.08] py-16 sm:py-20">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[34px]">
                Start in the cloud or self-host MIT.
              </h2>
              <p className="mt-2 text-[15px] text-[#9aa4b2]">
                Every new account starts with 100 cloud render credits and full access to all four workbenches.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0e1117] p-6">
              <div>
                <div className="font-mono text-[12px] text-[#8d96a5]">Creator</div>
                <div className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-white">$0</div>
                <p className="mt-2 text-[13.5px] text-[#9aa4b2]">Hosted workspaces backed by Neon Auth & Lakebase Postgres.</p>
                <ul className="mt-6 space-y-2.5 text-[13.5px] text-[#dbe1ea]">
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#00a3ae]" />100 starter render credits</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#00a3ae]" />Screening, Edit, Canvas & Color</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#00a3ae]" />1080p MP4 & WebM exports</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => (user ? onOpenWorkspace() : onLaunchAuth('sign-up'))}
                className="mt-8 w-full rounded-lg bg-[#f3f5f7] py-2.5 text-[13.5px] font-semibold text-[#06070a] transition hover:bg-white"
              >
                {user ? 'Go to workspace' : 'Create free account'}
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-[#00a3ae]/60 bg-[#0e1117] p-6">
              <div>
                <div className="font-mono text-[12px] text-[#5ce1ea]">Pro Studio</div>
                <div className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-white">$24<span className="text-[14px] font-normal text-[#8d96a5]">/mo</span></div>
                <p className="mt-2 text-[13.5px] text-[#9aa4b2]">For teams shipping weekly launches, product demos, and graded edits.</p>
                <ul className="mt-6 space-y-2.5 text-[13.5px] text-[#dbe1ea]">
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#00a3ae]" />2,500 monthly render credits</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#00a3ae]" />4K 60fps & ProRes exports</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#00a3ae]" />Shared workspace templates</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => (user ? onOpenWorkspace() : onLaunchAuth('sign-up'))}
                className="mt-8 w-full rounded-lg bg-[#00a3ae] py-2.5 text-[13.5px] font-semibold text-[#041416] transition hover:bg-[#19b9c4]"
              >
                {user ? 'Open Pro preview' : 'Start with Creator free'}
              </button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0e1117] p-6">
              <div>
                <div className="font-mono text-[12px] text-[#e5a93b]">Self-Hosted MIT</div>
                <div className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-white">Open</div>
                <p className="mt-2 text-[13.5px] text-[#9aa4b2]">Run Fillim on your own hardware or extend with Filmcraft modules.</p>
                <ul className="mt-6 space-y-2.5 text-[13.5px] text-[#dbe1ea]">
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#e5a93b]" />Full source at playlikemen/fillim</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#e5a93b]" />Bring your own Neon Postgres</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#e5a93b]" />Extensible plugin & skill standard</li>
                </ul>
              </div>
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 py-2.5 text-[13.5px] font-medium text-white transition hover:border-white/30"
              >
                View repository <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-4 px-5 text-[13px] text-[#7a8494] sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-2.5 text-[#c5ccd6]">
            <BrandLogo size={16} />
            <span>Fillim · Built on OpenFilm (MIT) · Powered by Neon Postgres & Neon Auth</span>
          </div>
          <div className="flex items-center gap-5">
            <a href={repoUrl} target="_blank" rel="noreferrer" className="transition hover:text-white">GitHub</a>
            <button type="button" onClick={() => onLaunchAuth('sign-in')} className="transition hover:text-white">Sign in</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
