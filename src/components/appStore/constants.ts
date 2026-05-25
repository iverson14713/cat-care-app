/** Apple App Store — iPhone 6.5-inch display class (required upload size). */
export const ASPECT_W = 1284;
export const ASPECT_H = 2778;

/** Prior artboard; layout values scale proportionally to keep safe margins. */
const REF_W = 1290;
const REF_H = 2796;
const SCALE_W = ASPECT_W / REF_W;
const SCALE_H = ASPECT_H / REF_H;

const layout = (n: number) => Math.round(n * SCALE_H);
const layoutW = (n: number) => Math.round(n * SCALE_W);

/** Logical app width inside device screen (matches mobile layout). */
export const DEVICE_LOGICAL_W = 390;

/** Mockup scale tuned for 1284×2778 artboard. */
export const PHONE_MOCKUP_SCALE = Math.round(1.45 * SCALE_H * 100) / 100;

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

export const PHONE_OUTER_W = PHONE_SCREEN_W + PHONE_BEZEL * 2;
export const PHONE_OUTER_H = PHONE_SCREEN_H + PHONE_BEZEL * 2;

/** Compact headline block — less empty space above the phone. */
export const SLIDE_HEADER_TOP = layout(48);
export const SLIDE_HEADER_BLOCK_H = layout(372);
export const SLIDE_HEADER_PHONE_GAP = layout(16);
export const PHONE_BOTTOM_SAFE = layout(64);

const topFromHeader = SLIDE_HEADER_TOP + SLIDE_HEADER_BLOCK_H + SLIDE_HEADER_PHONE_GAP;
const topFromBottom = ASPECT_H - PHONE_OUTER_H - PHONE_BOTTOM_SAFE;

/** Tight coupling between title and device; still clears bottom safe area. */
export const PHONE_MOCKUP_TOP = Math.min(topFromHeader, topFromBottom);

export const BRAND_GRADIENT =
  'linear-gradient(152deg, #fed7aa 0%, #fdba74 12%, #fb923c 32%, #f97316 52%, #ea580c 78%, #c2410c 100%)';

export const BRAND_GRADIENT_OVERLAY =
  'radial-gradient(ellipse 90% 55% at 12% 8%, rgba(255,255,255,0.38) 0%, transparent 58%),' +
  'radial-gradient(ellipse 70% 50% at 88% 18%, rgba(254,243,199,0.35) 0%, transparent 52%),' +
  'radial-gradient(ellipse 65% 45% at 75% 92%, rgba(251,191,36,0.28) 0%, transparent 55%),' +
  'radial-gradient(ellipse 55% 40% at 8% 78%, rgba(255,237,213,0.32) 0%, transparent 50%)';

/** CJK-friendly stack for mock screens and export (html2canvas). */
export const APP_STORE_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Segoe UI", sans-serif';

export const NOTO_SANS_TC_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;800&display=swap';

/** Typography at export resolution */
export const SLIDE_BRAND_SIZE = layout(30);
export const SLIDE_HEADLINE_SIZE = layout(86);
export const SLIDE_SUBTITLE_SIZE = layout(38);

/** Horizontal padding scales with canvas width */
export const SLIDE_HEADER_PX = layoutW(48);

export const SLIDE_HEADLINE_SHADOW =
  '0 4px 32px rgba(120,40,0,0.28), 0 0 48px rgba(255,255,255,0.22), 0 2px 0 rgba(255,255,255,0.12)';

export const SLIDE_SUBTITLE_SHADOW = '0 2px 20px rgba(120,40,0,0.2), 0 0 28px rgba(255,255,255,0.12)';
