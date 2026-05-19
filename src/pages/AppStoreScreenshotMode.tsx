import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Download } from 'lucide-react';
import { goHome } from '../legalNavigate';
import { AppStoreScreenshotSlide } from '../components/appStore/AppStoreScreenshotSlide';
import { ASPECT_H, ASPECT_W } from '../components/appStore/constants';
import { exportScreenshotElement } from '../components/appStore/exportScreenshot';
import { ensureAppStoreFontsReady } from '../components/appStore/fonts';
import { APP_STORE_SLIDES } from '../components/appStore/slides';

const PREVIEW_SCALE = 0.22;

export function AppStoreScreenshotMode() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureAppStoreFontsReady().then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const exportOne = useCallback(async (index: number) => {
    const slide = APP_STORE_SLIDES[index];
    const el = document.getElementById(`app-store-slide-${index}`);
    if (!el) return;
    setBusy(true);
    setStatus(`正在匯出：${slide.headline}…`);
    try {
      await ensureAppStoreFontsReady();
      await exportScreenshotElement(el, slide.filename);
      setStatus(`已下載 ${slide.filename}`);
    } catch (e) {
      console.error(e);
      setStatus('匯出失敗，請重試');
    } finally {
      setBusy(false);
    }
  }, []);

  const exportAll = useCallback(async () => {
    setBusy(true);
    try {
      for (let i = 0; i < APP_STORE_SLIDES.length; i++) {
        setStatus(`正在匯出 ${i + 1} / ${APP_STORE_SLIDES.length}…`);
        await exportOne(i);
        await new Promise((r) => setTimeout(r, 400));
      }
      setStatus('全部 5 張已匯出完成');
    } finally {
      setBusy(false);
    }
  }, [exportOne]);

  return (
    <main className="min-h-[100dvh] bg-stone-100 pb-16">
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={goHome}
            className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            返回 App
          </button>
          <p className="text-sm font-bold text-stone-900">App Store Screenshot Mode</p>
          <button
            type="button"
            disabled={busy || !fontsReady}
            onClick={() => void exportAll()}
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            {fontsReady ? '匯出全部 (1290×2796)' : '載入字型中…'}
          </button>
        </div>
        {status ? (
          <p className="mx-auto mt-2 max-w-4xl text-center text-xs text-stone-500">{status}</p>
        ) : fontsReady ? (
          <p className="mx-auto mt-2 max-w-4xl text-center text-xs text-emerald-700">字型已就緒，可安全匯出</p>
        ) : (
          <p className="mx-auto mt-2 max-w-4xl text-center text-xs text-stone-500">正在載入中文字型…</p>
        )}
      </header>

      <p className="mx-auto max-w-4xl px-4 py-4 text-center text-[13px] leading-relaxed text-stone-600">
        預覽比例已縮小。匯出為 App Store 6.7&quot; 尺寸 <strong className="font-semibold text-stone-800">1290 × 2796</strong>
        ，含 iPhone mockup、橘色漸層與標題文案。
      </p>

      <section className="mx-auto flex max-w-4xl flex-col items-center gap-10 px-4">
        {APP_STORE_SLIDES.map((slide, index) => (
          <article key={slide.id} className="w-full">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-stone-800">
                {index + 1}. {slide.headline}
              </p>
              <button
                type="button"
                disabled={busy || !fontsReady}
                onClick={() => void exportOne(index)}
                className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800 disabled:opacity-50"
              >
                下載 PNG
              </button>
            </header>
            <div
              className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 shadow-lg"
              style={{
                width: ASPECT_W * PREVIEW_SCALE,
                height: ASPECT_H * PREVIEW_SCALE,
              }}
            >
              <div
                style={{
                  width: ASPECT_W,
                  height: ASPECT_H,
                  transform: `scale(${PREVIEW_SCALE})`,
                  transformOrigin: 'top left',
                }}
              >
                <AppStoreScreenshotSlide slide={slide} exportId={`app-store-preview-${index}`} />
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Full-size off-screen canvases for export (avoids scaled-preview blur) */}
      <section className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
        {APP_STORE_SLIDES.map((slide, index) => (
          <AppStoreScreenshotSlide key={`export-${slide.id}`} slide={slide} exportId={`app-store-slide-${index}`} />
        ))}
      </section>
    </main>
  );
}
