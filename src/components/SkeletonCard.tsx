/** Shimmer block for loading placeholders (warm neutral, mobile-first). */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-skeleton rounded-lg bg-gradient-to-r from-stone-200/80 via-orange-100/70 to-stone-200/80 bg-[length:200%_100%] ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-fade-in rounded-3xl border border-orange-100/80 bg-white/90 p-4 shadow-sm">
      <SkeletonLine className="mb-3 h-5 w-2/5" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} className={`mb-2 h-3 ${i === rows - 1 ? 'w-3/5' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500 ${className}`}
      aria-hidden
    />
  );
}
