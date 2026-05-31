import { Capacitor } from '@capacitor/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import PetCareShare from './native/petCareShare';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read export blob'));
        return;
      }
      resolve(result.includes(',') ? result.split(',')[1]! : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read export blob'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob'));
          return;
        }
        resolve(blob);
      },
      type,
      0.92
    );
  });
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.-]+/g, '_');
}

async function shareOrDownloadBlob(blob: Blob, filename: string, mimeType: string): Promise<void> {
  const safeName = sanitizeFilename(filename);

  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    await PetCareShare.shareFile({
      base64Data: base64,
      filename: safeName,
      mimeType,
    });
    return;
  }

  const file = new File([blob], safeName, { type: mimeType });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: safeName });
      return;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      throw e;
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function captureReportCanvas(element: HTMLElement, backgroundColor: string): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor,
    logging: false,
  });
}

export async function exportReportElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureReportCanvas(element, '#fafaf9');
  const blob = await canvasToBlob(canvas);
  await shareOrDownloadBlob(blob, filename, 'image/png');
}

export async function exportReportElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureReportCanvas(element, '#ffffff');
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  const blob = pdf.output('blob');
  await shareOrDownloadBlob(blob, filename, 'application/pdf');
}

export async function shareReportText(title: string, text: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await PetCareShare.shareText({ title, text });
      return result.shared || Boolean(result.cancelled);
    } catch {
      return false;
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return false;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
