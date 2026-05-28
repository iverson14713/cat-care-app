/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Root URL of the deployment that serves `/api/assistant/*` (Vercel). Required for Capacitor if WebView host has no API. */
  readonly VITE_ASSISTANT_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
