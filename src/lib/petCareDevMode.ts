/**
 * Pet Care dev-only UI (test notifications, auth debug, IAP test unlock).
 * Never enabled in production / capacitor release builds.
 */
export function isPetCareDevMode(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.DEV || import.meta.env.VITE_PETCARE_DEV_MODE === 'true';
}
