import { ASPECT_H, ASPECT_W, BRAND_GRADIENT, BRAND_GRADIENT_OVERLAY } from './constants';

/** Layered orange mesh + glass orbs — static for html2canvas export. */
export function AppStoreSlideBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{ background: BRAND_GRADIENT }}
      />
      <div
        className="absolute inset-0"
        style={{ background: BRAND_GRADIENT_OVERLAY }}
      />

      {/* Soft flow bands */}
      <span
        className="absolute -left-[20%] top-[18%] h-[520px] w-[720px] rotate-[-18deg] rounded-[100%] opacity-70"
        style={{
          background: 'linear-gradient(105deg, rgba(255,255,255,0.22) 0%, transparent 72%)',
        }}
      />
      <span
        className="absolute -right-[15%] top-[42%] h-[480px] w-[640px] rotate-[12deg] rounded-[100%] opacity-60"
        style={{
          background: 'linear-gradient(250deg, rgba(254,215,170,0.35) 0%, transparent 68%)',
        }}
      />

      {/* Glass bubbles */}
      <span
        className="absolute left-[8%] top-[22%] h-[140px] w-[140px] rounded-full border border-white/30 bg-white/14 shadow-[0_8px_40px_rgba(255,255,255,0.15)]"
        style={{ backdropFilter: 'blur(12px)' }}
      />
      <span
        className="absolute right-[10%] top-[14%] h-[96px] w-[96px] rounded-full border border-white/25 bg-white/10"
        style={{ backdropFilter: 'blur(10px)' }}
      />
      <span
        className="absolute bottom-[18%] left-[6%] h-[180px] w-[180px] rounded-full border border-white/20 bg-white/8"
        style={{ backdropFilter: 'blur(14px)' }}
      />
      <span
        className="absolute bottom-[12%] right-[8%] h-[120px] w-[120px] rounded-full border border-amber-100/30 bg-amber-50/12"
        style={{ backdropFilter: 'blur(8px)' }}
      />

      {/* Floating circles */}
      <span className="absolute left-[18%] top-[38%] h-5 w-5 rounded-full bg-white/35 shadow-sm" />
      <span className="absolute right-[22%] top-[32%] h-3 w-3 rounded-full bg-white/40" />
      <span className="absolute left-[28%] bottom-[28%] h-4 w-4 rounded-full bg-amber-100/50" />
      <span className="absolute right-[30%] bottom-[34%] h-6 w-6 rounded-full border border-white/40 bg-white/15" />
      <span className="absolute left-[42%] top-[12%] h-2.5 w-2.5 rounded-full bg-white/50" />

      {/* Large ambient glow behind phone zone */}
      <span
        className="absolute left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-[50%] bg-white/18 blur-3xl"
        style={{ top: ASPECT_H * 0.28 }}
      />

      {/* Vignette for depth */}
      <span
        className="absolute inset-0"
        style={{
          width: ASPECT_W,
          height: ASPECT_H,
          background:
            'radial-gradient(ellipse 85% 75% at 50% 45%, transparent 35%, rgba(154,52,18,0.12) 100%)',
        }}
      />
    </div>
  );
}
