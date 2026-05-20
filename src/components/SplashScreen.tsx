import { APP_STORE_FONT_FAMILY } from './appStore/constants';

const SPLASH_ICON_SRC = '/icon-512.png';

type SplashScreenProps = {
  /** When true, plays enter animation (use on first mount). */
  active?: boolean;
  /** Small caption under the tagline (e.g. loading hint). */
  statusText?: string;
};

/**
 * Full-screen launch splash — reusable for web PWA and future Capacitor native splash alignment.
 */
export function SplashScreen({ active = true, statusText }: SplashScreenProps) {
  return (
    <div
      className="splash-screen fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-orange-50 via-white to-orange-50/90"
      style={{
        fontFamily: APP_STORE_FONT_FAMILY,
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Pet Care 載入中"
    >
      <div
        className={`splash-screen__content flex flex-col items-center px-8 text-center ${active ? 'splash-screen__content--enter' : ''}`}
      >
        <div className="splash-screen__icon-wrap mb-8 flex h-[108px] w-[108px] items-center justify-center rounded-[28px] bg-white shadow-[0_20px_50px_-12px_rgba(249,115,22,0.45)] ring-1 ring-orange-100/80">
          <img
            src={SPLASH_ICON_SRC}
            alt=""
            width={88}
            height={88}
            className="h-[88px] w-[88px] rounded-[22px] object-cover"
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <h1 className="text-[32px] font-bold tracking-tight text-stone-900" style={{ letterSpacing: '-0.02em' }}>
          Pet Care
        </h1>
        <p className="mt-2 text-[17px] font-medium text-stone-500">陪伴毛孩的每一天</p>
        {statusText ? (
          <p className="splash-screen__status mt-6 text-[13px] font-medium text-stone-400">{statusText}</p>
        ) : null}
      </div>
    </div>
  );
}
