import { useCallback, useEffect, useRef, useState } from 'react';
import { ONBOARDING_ILLUSTRATIONS } from './onboarding/OnboardingIllustrations';

type Lang = 'zh' | 'en';

type SlideBody = string | string[];

type Slide = {
  title: Record<Lang, string>;
  body: Record<Lang, SlideBody>;
};

const SLIDES: Slide[] = [
  {
    title: { zh: '\u6B61\u8FCE\u4F7F\u7528 Pet Care', en: 'Welcome to Pet Care' },
    body: {
      zh: '\u7D00\u9304\u6BDB\u5B69\u6BCF\u5929\u7684\u5065\u5EB7\u8207\u7167\u8B77\u3002',
      en: "Track your pet's daily health and care in one place.",
    },
  },
  {
    title: { zh: '\u6BCF\u65E5\u7167\u8B77', en: 'Daily care' },
    body: {
      zh: ['\u5FEB\u901F\u8A18\u9304\uFF1A', '\u9935\u98DF', '\u98F2\u6C34', '\u6392\u6CC4', '\u7570\u5E38\u72C0\u6CC1'],
      en: ['Quick logs for:', 'Meals', 'Water', 'Litter & potty', 'Unusual signs'],
    },
  },
  {
    title: { zh: 'AI \u7167\u8B77\u52A9\u624B', en: 'AI care assistant' },
    body: {
      zh: ['\u81EA\u52D5\u6574\u7406\uFF1A', '\u7570\u5E38\u91CD\u9EDE', '\u9AD4\u91CD\u8B8A\u5316', '\u7378\u91AB\u6458\u8981'],
      en: ['Auto summaries of:', 'Health concerns', 'Weight trends', 'Vet visit notes'],
    },
  },
  {
    title: { zh: '\u591A\u5BF5\u7269\u8207\u5171\u540C\u7167\u8B77', en: 'Multi-pet & shared care' },
    body: {
      zh: '\u5BB6\u4EBA\u53EF\u4E00\u8D77\u540C\u6B65\u7167\u9867\u6BDB\u5B69\u3002',
      en: 'Family members can sync care for the same pet.',
    },
  },
  {
    title: { zh: '\u958B\u59CB\u4F7F\u7528', en: 'Get started' },
    body: {
      zh: '\u4E00\u8D77\u7167\u9867\u6BDB\u5B69\u5427\uFF01',
      en: "Let's care for your pet together!",
    },
  },
];

const LABELS = {
  next: { zh: '\u4E0B\u4E00\u6B65', en: 'Next' },
  start: { zh: '\u7ACB\u5373\u958B\u59CB', en: 'Get started' },
} as const;

type OnboardingProps = {
  lang: Lang;
  onComplete: () => void;
};

function renderBody(body: SlideBody) {
  if (typeof body === 'string') {
    return <p className="text-center text-[15px] leading-relaxed text-stone-600">{body}</p>;
  }
  const [lead, ...items] = body;
  return (
    <div className="text-center">
      <p className="mb-3 text-[15px] leading-relaxed text-stone-600">{lead}</p>
      <ul className="mx-auto inline-block space-y-2 text-left text-[15px] font-medium text-stone-700">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Onboarding({ lang, onComplete }: OnboardingProps) {
  const slideCount = SLIDES.length;
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isLast = index === slideCount - 1;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const scrollToIndex = useCallback(
    (next: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(slideCount - 1, next));
      el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
      setIndex(clamped);
    },
    [slideCount]
  );

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth <= 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setIndex((prev) => (prev === next ? prev : next));
  }, []);

  const onPrimaryAction = () => {
    if (isLast) onComplete();
    else scrollToIndex(index + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex animate-fade-in flex-col bg-gradient-to-b from-amber-50 via-[#fff8f0] to-orange-100/90"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'zh' ? '\u9996\u6B21\u4F7F\u7528\u5C0E\u89BD' : 'Onboarding'}
    >
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((slide, i) => (
          <section
            key={slide.title.zh}
            className="flex w-full shrink-0 snap-center snap-always flex-col items-center justify-center px-5 py-10 sm:px-8"
            aria-hidden={index !== i}
          >
            <div
              className={`w-full max-w-sm rounded-3xl border border-orange-100/90 bg-white/95 px-6 pb-8 pt-6 shadow-[0_24px_56px_-24px_rgba(234,88,12,0.4)] backdrop-blur-sm transition-all duration-500 ease-out ${
                index === i ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-90'
              }`}
            >
              {(() => {
                const Illustration = ONBOARDING_ILLUSTRATIONS[i];
                return <Illustration />;
              })()}
              <h2 className="mb-4 text-center text-2xl font-bold tracking-tight text-stone-900">
                {slide.title[lang]}
              </h2>
              {renderBody(slide.body[lang])}
            </div>
          </section>
        ))}
      </div>

      <footer className="shrink-0 border-t border-orange-100/80 bg-white/80 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-sm justify-center gap-2" aria-hidden>
          {SLIDES.map((slide, i) => (
            <button
              key={slide.title.zh}
              type="button"
              onClick={() => scrollToIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-orange-500' : 'w-2 bg-orange-200 hover:bg-orange-300'
              }`}
              aria-label={lang === 'zh' ? `\u7B2C ${i + 1} \u9801` : `Slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onPrimaryAction}
          className="mx-auto mt-5 flex w-full max-w-sm items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-400/35 transition active:scale-[0.98]"
        >
          {isLast ? LABELS.start[lang] : LABELS.next[lang]}
        </button>
      </footer>
    </div>
  );
}
