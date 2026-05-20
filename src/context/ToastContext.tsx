import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export type ToastOptions = {
  position?: 'top' | 'bottom';
  durationMs?: number;
};

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  position: 'top' | 'bottom';
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdSeq = 0;

const DEFAULT_DURATION_MS = 3200;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {
        /* no-op outside provider */
      },
    };
  }
  return ctx;
}

function toastClassName(variant: ToastVariant, position: 'top' | 'bottom'): string {
  const compact =
    position === 'top' ? 'rounded-xl px-3.5 py-2 text-[12px] font-medium' : 'rounded-2xl px-4 py-3 text-[13px] font-semibold';
  const base = `pointer-events-auto leading-snug shadow-lg backdrop-blur-sm ${compact}`;
  switch (variant) {
    case 'success':
      return `${base} border border-emerald-200/80 bg-emerald-50/95 text-emerald-950`;
    case 'error':
      return `${base} border border-red-200/80 bg-red-50/95 text-red-950`;
    case 'warning':
      return `${base} border border-amber-200/80 bg-amber-50/95 text-amber-950`;
    case 'info':
    default:
      return `${base} border border-sky-200/80 bg-sky-50/95 text-sky-950`;
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  const remove = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success', options?: ToastOptions) => {
      const id = ++toastIdSeq;
      const position = options?.position ?? 'bottom';
      const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
      setToasts((prev) => [...prev, { id, message, variant, position }]);
      const handle = window.setTimeout(() => remove(id), durationMs);
      timers.current.set(id, handle);
    },
    [remove]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const topToasts = toasts.filter((t) => t.position === 'top');
  const bottomToasts = toasts.filter((t) => t.position === 'bottom');

  return (
    <ToastContext.Provider value={value}>
      {children}
      {topToasts.length > 0 ? (
        <div
          className="pointer-events-none fixed left-0 right-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col items-center gap-2 px-4"
          aria-live="polite"
        >
          {topToasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`toast-slide-in-top max-w-sm text-center ${toastClassName(t.variant, 'top')}`}
            >
              {t.message}
            </div>
          ))}
        </div>
      ) : null}
      {bottomToasts.length > 0 ? (
        <div
          className="pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-3 right-3 z-[100] flex flex-col items-stretch gap-2 sm:left-auto sm:right-4 sm:max-w-sm"
          aria-live="polite"
        >
          {bottomToasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`toast-slide-in ${toastClassName(t.variant, 'bottom')}`}
            >
              {t.message}
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
