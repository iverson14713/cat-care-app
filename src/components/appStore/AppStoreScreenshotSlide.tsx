import type { AppStoreSlide } from './slides';
import { APP_BRAND_FULL } from '../../brand';
import { AppStoreSlideBackground } from './AppStoreSlideBackground';
import { AppStoreSlideDecorations } from './AppStoreSlideDecorations';
import {
  APP_STORE_FONT_FAMILY,
  ASPECT_H,
  ASPECT_W,
  PHONE_MOCKUP_TOP,
  PHONE_OUTER_W,
  SLIDE_BRAND_SIZE,
  SLIDE_HEADER_TOP,
  SLIDE_HEADLINE_SHADOW,
  SLIDE_HEADLINE_SIZE,
  SLIDE_SUBTITLE_SHADOW,
  SLIDE_SUBTITLE_SIZE,
} from './constants';
import { IphoneMockup } from './IphoneMockup';

type AppStoreScreenshotSlideProps = {
  slide: AppStoreSlide;
  exportId: string;
};

export function AppStoreScreenshotSlide({ slide, exportId }: AppStoreScreenshotSlideProps) {
  const Screen = slide.Screen;
  const glowTop = PHONE_MOCKUP_TOP - 24;
  const glowW = PHONE_OUTER_W + 100;

  return (
    <article
      id={exportId}
      className="app-store-slide relative overflow-hidden"
      style={{
        width: ASPECT_W,
        height: ASPECT_H,
        fontFamily: APP_STORE_FONT_FAMILY,
      }}
    >
      <AppStoreSlideBackground />
      <AppStoreSlideDecorations theme={slide.theme} />

      <header
        className="absolute left-0 right-0 z-20 px-[48px] text-center text-white"
        style={{ top: SLIDE_HEADER_TOP }}
      >
        <p
          className="mx-auto inline-flex items-center rounded-full border border-white/30 px-6 py-2 font-semibold tracking-wide text-white/95 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          style={{
            fontSize: SLIDE_BRAND_SIZE,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)',
            backdropFilter: 'blur(12px)',
            textShadow: '0 1px 12px rgba(120,40,0,0.15)',
          }}
        >
          {APP_BRAND_FULL}
        </p>
        <h2
          className="mt-3 font-extrabold leading-[1.04] tracking-tight"
          style={{
            fontSize: SLIDE_HEADLINE_SIZE,
            letterSpacing: '-0.03em',
            textShadow: SLIDE_HEADLINE_SHADOW,
          }}
        >
          {slide.headline}
        </h2>
        <p
          className="mx-auto mt-3 max-w-[1040px] font-semibold leading-snug text-white/96"
          style={{
            fontSize: SLIDE_SUBTITLE_SIZE,
            textShadow: SLIDE_SUBTITLE_SHADOW,
          }}
        >
          {slide.subtitle}
        </p>
      </header>

      {/* Phone halo */}
      <span
        className="pointer-events-none absolute left-1/2 z-[8] -translate-x-1/2 rounded-[72px] bg-white/25 blur-3xl"
        style={{
          top: glowTop,
          width: glowW,
          height: 140,
        }}
        aria-hidden
      />

      <section
        className="absolute left-1/2 z-10 -translate-x-1/2"
        style={{
          top: PHONE_MOCKUP_TOP,
          filter: 'drop-shadow(0 28px 56px rgba(0,0,0,0.28))',
        }}
      >
        <IphoneMockup>
          <Screen />
        </IphoneMockup>
      </section>
    </article>
  );
}
