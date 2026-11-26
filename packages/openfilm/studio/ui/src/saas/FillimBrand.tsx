export type DyeChannel = '#ca281b' | '#087774' | '#193885';

export const DYE_CHANNELS: Array<{ hex: DyeChannel; name: string; code: string }> = [
  { hex: '#ca281b', name: 'Crimson', code: 'Y-STRIP' },
  { hex: '#087774', name: 'Peacock Teal', code: 'C-STRIP' },
  { hex: '#193885', name: 'Cobalt', code: 'M-STRIP' },
];

/** Top four-segment solid Technicolor calibration strip anchored edge to edge. */
export function CalibrationStrip() {
  return (
    <div aria-hidden className="grid h-2.5 w-full grid-cols-4 border-b border-[#191918]">
      <div className="bg-[#ca281b]" />
      <div className="bg-[#087774]" />
      <div className="bg-[#193885]" />
      <div className="bg-[#191918]" />
    </div>
  );
}

/**
 * Distinct Fillim geometric three-strip prism monogram.
 * Separate from OpenFilm's playhead logo per OpenFilm TRADEMARK.md.
 */
export function FillimMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Fillim"
      role="img"
      className="block shrink-0"
    >
      <rect x="1" y="1" width="22" height="22" stroke="#191918" strokeWidth="1.5" fill="#fbf4f1" />
      <rect x="3.5" y="3.5" width="4.5" height="17" fill="#ca281b" />
      <rect x="9.75" y="3.5" width="4.5" height="14" fill="#087774" />
      <rect x="16" y="3.5" width="4.5" height="17" fill="#193885" />
    </svg>
  );
}

interface StageFrameCanvasProps {
  t: number;
  headline: string;
  activeDye: DyeChannel;
  variant: 'hero' | 'strip';
  inverted?: boolean;
}

/**
 * Shared deterministic window.film.frame(t) optical composition renderer.
 * Used identically for the primary hero stage and stepped 4-frame test strip.
 */
export function StageFrameCanvas({
  t,
  headline,
  activeDye,
  variant,
  inverted = false,
}: StageFrameCanvasProps) {
  const progress = Math.max(0, Math.min(1, t / 4));
  const easeOut = 1 - Math.pow(1 - Math.min(1, t / 1.15), 3);
  const sweep = (progress - 0.35) * 44;

  const isHero = variant === 'hero';
  const bg = inverted ? '#f6eae6' : '#161615';
  const fg = inverted ? '#191918' : '#f6eae6';

  const topOrder: [string, string, string] =
    activeDye === '#087774'
      ? ['#087774', '#193885', '#ca281b']
      : activeDye === '#193885'
        ? ['#193885', '#ca281b', '#087774']
        : ['#ca281b', '#193885', '#087774'];

  const barUpperW = 34 + progress * 24;
  const barLowerW = 30 + (1 - Math.abs(progress - 0.5)) * 22;

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none"
      style={{ backgroundColor: bg }}
    >
      {/* Top-left fan of separated optical rays */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ transform: `translate3d(${sweep * 0.4}px, 0, 0)` }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: topOrder[0],
            clipPath: 'polygon(14% 0%, 24% 0%, 10% 56%, 1% 78%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: topOrder[1],
            clipPath: 'polygon(24% 0%, 30% 0%, 13% 56%, 7% 68%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: topOrder[2],
            clipPath: 'polygon(30% 0%, 50% 0%, 14% 58%, 11% 62%)',
          }}
        />
      </div>

      {/* Bottom-right symmetrical optical fan */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ transform: `translate3d(${-sweep * 0.45}px, 0, 0)` }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: topOrder[0],
            clipPath: 'polygon(41% 100%, 56% 100%, 89% 46%, 97% 28%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: topOrder[2],
            clipPath: 'polygon(56% 100%, 67% 100%, 92% 48%, 99% 25%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: topOrder[1],
            clipPath: 'polygon(67% 100%, 89% 100%, 100% 62%, 100% 34%)',
          }}
        />
      </div>

      {/* Upper Cobalt & Lower Teal Optical Gate Bars driven cleanly by t */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[28%] top-[23%] h-[11%]"
        style={{
          width: `${barUpperW}%`,
          backgroundColor: '#193885',
          clipPath: 'polygon(5% 0%, 100% 0%, 100% 100%, 0% 100%)',
          transform: `translate3d(${(progress - 0.5) * 18}px, 0, 0)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[28%] bottom-[21%] h-[11%]"
        style={{
          width: `${barLowerW}%`,
          backgroundColor: '#087774',
          clipPath: 'polygon(0% 0%, 100% 0%, 93% 100%, 0% 100%)',
          transform: `translate3d(${(0.5 - progress) * 18}px, 0, 0)`,
        }}
      />

      {/* Inverted frame block accent for optical strip step 2 matching Comp C */}
      {inverted && progress > 0.25 && progress < 0.5 && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[55%] h-[36%] w-[12%] bg-[#191918]"
        />
      )}

      {/* Corner registration crosshairs on primary gate */}
      {isHero && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <RegistrationCrosshair className="left-5 top-5 text-[#ca281b]" />
          <RegistrationCrosshair className="right-5 top-5 text-[#087774]" />
          <RegistrationCrosshair className="bottom-5 left-5 text-[#ca281b]" />
          <RegistrationCrosshair className="bottom-5 right-5 text-[#193885]" />
        </div>
      )}

      {/* Deterministic shot headline */}
      <div className="relative flex h-full w-full items-center justify-center px-4 text-center">
        <span
          className="fillim-display tracking-[0.03em]"
          style={{
            color: fg,
            fontSize: isHero ? 'clamp(34px, 4.3vw, 62px)' : '13px',
            lineHeight: 0.96,
            opacity: isHero ? 0.25 + 0.75 * easeOut : 1,
            transform: isHero ? `translate3d(0, ${(1 - easeOut) * 10}px, 0)` : undefined,
          }}
        >
          {headline || 'FILLIM STUDIO'}
        </span>
      </div>
    </div>
  );
}

function RegistrationCrosshair({ className }: { className: string }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      className={`absolute ${className}`}
    >
      <path d="M13 2V24M2 13H24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
