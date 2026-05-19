import html2canvas from 'html2canvas';
import { ASPECT_H, ASPECT_W } from './constants';
import { ensureAppStoreFontsReady } from './fonts';

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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) throw new Error('Failed to create PNG');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
