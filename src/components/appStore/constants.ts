/** App Store 6.7" display — iPhone 14 Pro Max / 15 Pro Max */
export const ASPECT_W = 1290;
export const ASPECT_H = 2796;

/** Logical app width inside device screen (matches mobile layout). */
export const DEVICE_LOGICAL_W = 390;

/** Enlarge mockup ~7% so in-app UI is clearer; still fits 1290×2796 with headline layout. */
export const PHONE_MOCKUP_SCALE = 1.07;

const BASE_PHONE_SCREEN_W = 612;
const BASE_PHONE_SCREEN_H = 1328;
const BASE_PHONE_BEZEL = 44;

/** Visible screen area inside mockup frame (px at export resolution). */
export const PHONE_SCREEN_W = Math.round(BASE_PHONE_SCREEN_W * PHONE_MOCKUP_SCALE);
export const PHONE_SCREEN_H = Math.round(BASE_PHONE_SCREEN_H * PHONE_MOCKUP_SCALE);
export const PHONE_BEZEL = Math.round(BASE_PHONE_BEZEL * PHONE_MOCKUP_SCALE);
export const PHONE_FRAME_RADIUS = Math.round(56 * PHONE_MOCKUP_SCALE);
export const PHONE_SCREEN_RADIUS = Math.round(44 * PHONE_MOCKUP_SCALE);
export const SCREEN_SCALE = PHONE_SCREEN_W / DEVICE_LOGICAL_W;

/** Vertical offset for phone block (headline area ~500px). */
export const PHONE_MOCKUP_TOP = 508;

export const BRAND_GRADIENT =
  'linear-gradient(165deg, #fdba74 0%, #fb923c 18%, #f97316 42%, #ea580c 72%, #c2410c 100%)';

/** CJK-friendly stack for mock screens and export (html2canvas). */
export const APP_STORE_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Segoe UI", sans-serif';

export const NOTO_SANS_TC_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap';
