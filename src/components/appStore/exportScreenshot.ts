import html2canvas from 'html2canvas';
import { ASPECT_H, ASPECT_W } from './constants';
import { ensureAppStoreFontsReady } from './fonts';

/** Ensure canvas is exactly Apple-required pixels (no accidental half-pixel drift). */
function toExactCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  if (source.width === ASPECT_W && source.height === ASPECT_H) {
    return source;
  }
  const exact = document.createElement('canvas');
  exact.width = ASPECT_W;
  exact.height = ASPECT_H;
  const ctx = exact.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, ASPECT_W, ASPECT_H);
  return exact;
}

export async function exportScreenshotElement(
  element: HTMLElement,
  filename: string
): Promise<void> {
  await ensureAppStoreFontsReady();

  const canvas = await html2canvas(element, {
    width: ASPECT_W,
    height: ASPECT_H,
    scale: 1,
    useCORS: true,
    backgroundColor: null,
    logging: false,
    foreignObjectRendering: false,
  });

  const exact = toExactCanvas(canvas);

  /** PNG quality 1 = lossless; no JPEG recompression. */
  const blob = await new Promise<Blob | null>((resolve) =>
    exact.toBlob(resolve, 'image/png', 1)
  );
  if (!blob) throw new Error('Failed to create PNG');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
