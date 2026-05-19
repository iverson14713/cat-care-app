import type { AppStoreSlide } from './slides';
import {
  APP_STORE_FONT_FAMILY,
  ASPECT_H,
  ASPECT_W,
  BRAND_GRADIENT,
  PHONE_MOCKUP_TOP,
} from './constants';
import { IphoneMockup } from './IphoneMockup';

type AppStoreScreenshotSlideProps = {
  slide: AppStoreSlide;
  exportId: string;
};

export function AppStoreScreenshotSlide({ slide, exportId }: AppStoreScreenshotSlideProps) {
  const Screen = slide.Screen;

  return (
    <article
      id={exportId}
      className="app-store-slide relative overflow-hidden bg-orange-500"
      style={{
        width: ASPECT_W,
        height: ASPECT_H,
        fontFamily: APP_STORE_FONT_FAMILY,
        background: BRAND_GRADIENT,
      }}
    >
      <span
        className="pointer-events-none absolute -left-32 -top-24 h-[420px] w-[420px] rounded-full bg-white/20 blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-24 -right-24 h-[520px] w-[520px] rounded-full bg-amber-200/25 blur-3xl"
        aria-hidden
      />

      <header
        className="absolute left-0 right-0 z-10 px-[72px] pt-[118px] text-center text-white"
        style={{ textShadow: '0 2px 24px rgba(0,0,0,0.12)' }}
      >
        <p className="text-[26px] font-semibold tracking-wide text-white/90">Pet Care</p>
        <h2
          className="mt-3 text-[68px] font-bold leading-[1.08] tracking-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          {slide.headline}
        </h2>
        <p className="mx-auto mt-5 max-w-[1000px] text-[34px] font-medium leading-snug text-white/92">
          {slide.subtitle}
        </p>
      </header>

      <section className="absolute left-1/2 z-10 -translate-x-1/2" style={{ top: PHONE_MOCKUP_TOP }}>
        <IphoneMockup>
          <Screen />
        </IphoneMockup>
      </section>
    </article>
  );
}
