import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { goHome } from '../legalNavigate';

type LegalPageLayoutProps = {
  title: string;
  subtitle: string;
  backLabel: string;
  footerNote: string;
  children: ReactNode;
};

export function LegalPageLayout({ title, subtitle, backLabel, footerNote, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-[100dvh] animate-fade-in bg-[#faf8f5]">
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={goHome}
          className="mb-4 inline-flex items-center gap-1 rounded-full border border-stone-200/80 bg-white/90 px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition active:scale-[0.98]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </button>

        <header className="mb-5 rounded-3xl border border-orange-100/80 bg-white px-5 py-6 shadow-[0_8px_32px_-12px_rgba(234,88,12,0.12)]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-orange-500/90">Pet Care</p>
          <h1 className="mt-1 text-[1.35rem] font-bold leading-snug text-stone-900">{title}</h1>
          <p className="mt-2 text-[13px] text-stone-500">{subtitle}</p>
        </header>

        <div className="space-y-3">{children}</div>

        <footer className="mt-8 rounded-2xl border border-amber-100/90 bg-gradient-to-br from-amber-50/95 to-orange-50/80 px-4 py-4 text-center">
          <p className="text-[12px] leading-relaxed text-stone-600">{footerNote}</p>
        </footer>
      </div>
    </div>
  );
}

type LegalSectionProps = {
  index: number;
  title: string;
  children: ReactNode;
};

export function LegalSection({ index, title, children }: LegalSectionProps) {
  return (
    <section className="rounded-2xl border border-stone-100/90 bg-white p-4 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)]">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
          {index}
        </span>
        <h2 className="text-[15px] font-bold text-stone-900">{title}</h2>
      </div>
      <div className="text-[14px] leading-relaxed text-stone-700">{children}</div>
    </section>
  );
}

export function LegalBulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
