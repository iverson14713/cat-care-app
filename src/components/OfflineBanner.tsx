type OfflineBannerProps = {
  message: string;
  syncError?: string | null;
  retryLabel?: string;
  onRetry?: () => void;
  pendingHint?: string;
};

export function OfflineBanner({
  message,
  syncError,
  retryLabel,
  onRetry,
  pendingHint,
}: OfflineBannerProps) {
  const showRetry = Boolean(syncError && onRetry && retryLabel);

  return (
    <div
      role="status"
      className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-950 shadow-sm"
    >
      <p className="font-semibold">{message}</p>
      {pendingHint ? <p className="mt-1 text-[11px] opacity-90">{pendingHint}</p> : null}
      {showRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white"
        >
          {retryLabel}
        </button>
      ) : syncError ? (
        <p className="mt-1 text-[11px] font-medium text-red-800">{syncError}</p>
      ) : null}
    </div>
  );
}
