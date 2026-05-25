import type { CSSProperties } from 'react';
import { Bell, Heart, Sparkles } from 'lucide-react';
import type { AppStoreSlideTheme } from './slides';

function PawIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden
    >
      <ellipse cx="6" cy="8" rx="2.2" ry="2.6" />
      <ellipse cx="10" cy="5.5" rx="2" ry="2.4" />
      <ellipse cx="14" cy="5.5" rx="2" ry="2.4" />
      <ellipse cx="18" cy="8" rx="2.2" ry="2.6" />
      <path d="M8 11c0 3.5 2 7 4 7s4-3.5 4-7c0-2.5-1.8-4-4-4s-4 1.5-4 4z" />
    </svg>
  );
}

function MedicalCross({ className }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-xl border border-white/35 bg-white/20 font-bold text-white shadow-lg ${className ?? ''}`}
      aria-hidden
    >
      <span className="text-[22px] leading-none">+</span>
    </span>
  );
}

type DecoProps = {
  theme: AppStoreSlideTheme;
};

/** Per-slide cute accents — corners only, avoids headline / phone overlap. */
export function AppStoreSlideDecorations({ theme }: DecoProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      {theme === 'today' ? (
        <>
          <PawIcon
            className="absolute left-[6%] top-[32%] h-11 w-11 text-white/50 drop-shadow-md"
            style={{ transform: 'rotate(-18deg)' }}
          />
          <PawIcon
            className="absolute right-[7%] top-[38%] h-9 w-9 text-white/40"
            style={{ transform: 'rotate(22deg)' }}
          />
          <Heart
            className="absolute left-[10%] top-[48%] h-8 w-8 fill-rose-200/70 text-rose-100/90 drop-shadow"
            strokeWidth={1.5}
          />
          <Heart
            className="absolute right-[9%] top-[52%] h-6 w-6 fill-white/30 text-white/60"
            strokeWidth={1.5}
          />
        </>
      ) : null}

      {theme === 'weight' ? (
        <>
          <MedicalCross className="absolute right-[7%] top-[32%] h-11 w-11" />
          <Sparkles className="absolute left-[8%] top-[36%] h-9 w-9 text-amber-100/80 drop-shadow" strokeWidth={1.8} />
          <Sparkles className="absolute right-[11%] top-[48%] h-7 w-7 text-white/55" strokeWidth={1.6} />
          <span className="absolute left-[12%] top-[54%] text-3xl opacity-50 drop-shadow">📈</span>
        </>
      ) : null}

      {theme === 'shared-care' ? (
        <>
          <span
            className="absolute left-[7%] top-[34%] flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-3xl shadow-lg"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            🐱
          </span>
          <span
            className="absolute right-[7%] top-[40%] flex h-12 w-12 items-center justify-center rounded-2xl border border-white/25 bg-white/12 text-2xl shadow-md"
            style={{ backdropFilter: 'blur(6px)' }}
          >
            🐈
          </span>
          <span className="absolute right-[11%] top-[52%] text-2xl opacity-55">🐾</span>
        </>
      ) : null}

      {theme === 'reminders' ? (
        <>
          <span
            className="absolute left-[7%] top-[33%] flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/18 shadow-[0_8px_32px_rgba(255,255,255,0.2)]"
            style={{ backdropFilter: 'blur(10px)' }}
          >
            <Bell className="h-7 w-7 text-amber-50 drop-shadow" strokeWidth={2.2} />
          </span>
          <span className="absolute right-[9%] top-[46%] h-3 w-3 rounded-full bg-amber-100/70 ring-4 ring-amber-100/25" />
          <Bell className="absolute right-[7%] top-[38%] h-8 w-8 text-white/45" strokeWidth={2} />
        </>
      ) : null}

      {theme === 'assistant' ? (
        <>
          <span
            className="absolute left-[6%] top-[30%] h-24 w-24 rounded-full bg-violet-200/25 blur-2xl"
            aria-hidden
          />
          <span
            className="absolute right-[6%] top-[36%] h-20 w-20 rounded-full bg-fuchsia-200/20 blur-2xl"
            aria-hidden
          />
          <Sparkles
            className="absolute left-[8%] top-[34%] h-10 w-10 text-violet-100/90 drop-shadow-lg"
            strokeWidth={1.8}
          />
          <Sparkles className="absolute right-[8%] top-[42%] h-8 w-8 text-white/70" strokeWidth={1.6} />
          <span
            className="absolute right-[10%] top-[32%] rounded-full border border-white/30 bg-gradient-to-br from-violet-400/40 to-fuchsia-300/30 px-3 py-1 text-[15px] font-bold tracking-wide text-white shadow-lg"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            AI
          </span>
        </>
      ) : null}

      {/* Shared sparkles — subtle on all slides */}
      <Sparkles className="absolute left-[4%] top-[18%] h-5 w-5 text-white/35" strokeWidth={2} />
      <Sparkles className="absolute right-[5%] top-[22%] h-4 w-4 text-amber-50/40" strokeWidth={2} />
    </div>
  );
}
