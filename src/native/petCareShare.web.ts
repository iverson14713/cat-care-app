import type { PetCareSharePlugin } from './petCareShare';

const PetCareShareWeb: PetCareSharePlugin = {
  async shareFile({ base64Data, filename, mimeType = 'application/octet-stream' }) {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });

    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return { shared: true };
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') {
          return { shared: false, cancelled: true };
        }
        throw e;
      }
    }

    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return { shared: true };
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  async shareText({ title, text }) {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text });
        return { shared: true };
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') {
          return { shared: false, cancelled: true };
        }
      }
    }

    await navigator.clipboard.writeText(text);
    return { shared: true };
  },
};

export default PetCareShareWeb;
