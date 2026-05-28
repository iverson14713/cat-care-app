/**
 * Assistant API lives on Vercel `/api/assistant/*` (or local `server/index.mjs` via Vite proxy).
 * In Capacitor, `capacitor.config` `server.hostname` (e.g. petcare.app) may NOT serve those routes;
 * set `VITE_ASSISTANT_API_BASE_URL` at build time to your deployment root, e.g. `https://your-app.vercel.app`
 */
export function getAssistantApiBase(): string {
  const raw = import.meta.env.VITE_ASSISTANT_API_BASE_URL?.trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

/** Absolute URL for `/api/assistant/...` when base is set; otherwise same-origin relative path. */
export function assistantApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getAssistantApiBase();
  return base ? `${base}${p}` : p;
}
