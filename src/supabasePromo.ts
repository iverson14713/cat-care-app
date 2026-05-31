import { Capacitor } from '@capacitor/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assistantApiUrl, getAssistantApiBase } from './lib/assistantApiBase';
import { mapSupabaseErr, type DbError } from './supabaseError';

export type PromoEntitlement = {
  promoProUntil: string | null;
  promoSource: string | null;
  redeemedCode: string | null;
  promoAiBonus: number;
};

export type PromoRedeemErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'CODE_NOT_FOUND'
  | 'CODE_INACTIVE'
  | 'CODE_EXPIRED'
  | 'CODE_LIMIT_REACHED'
  | 'ALREADY_REDEEMED'
  | 'ALREADY_PRO'
  | 'SUPABASE_SERVICE_KEY_MISSING'
  | 'DATABASE_ERROR'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR'
  | 'INVALID_JSON'
  | 'NETWORK'
  /** @deprecated legacy API codes — mapped on the client */
  | 'UNAUTHENTICATED'
  | 'INVALID_CODE'
  | 'NO_SERVICE_ROLE_KEY'
  | 'NO_SUPABASE_URL'
  | 'SERVER';

export type PromoRedeemResult =
  | {
      ok: true;
      type: 'pro_trial' | 'ai_bonus';
      code: string;
      campaignName: string;
      promoProUntil: string | null;
      promoAiBonus: number;
      bonusAdded?: number | null;
      promoProUntilLabel: string | null;
      entitlement: PromoEntitlement;
    }
  | {
      ok: false;
      error: string;
      message?: string;
      code: PromoRedeemErrorCode;
      httpStatus?: number;
      rawBody?: unknown;
    };

const EMPTY_ENTITLEMENT: PromoEntitlement = {
  promoProUntil: null,
  promoSource: null,
  redeemedCode: null,
  promoAiBonus: 0,
};

function normalizePromoErrorCode(raw: string | undefined): PromoRedeemErrorCode {
  switch (raw) {
    case 'NOT_AUTHENTICATED':
    case 'UNAUTHENTICATED':
      return 'NOT_AUTHENTICATED';
    case 'INVALID_REQUEST':
    case 'INVALID_CODE':
    case 'INVALID_JSON':
      return raw === 'INVALID_JSON' ? 'INVALID_JSON' : 'INVALID_REQUEST';
    case 'SUPABASE_SERVICE_KEY_MISSING':
    case 'NO_SERVICE_ROLE_KEY':
      return 'SUPABASE_SERVICE_KEY_MISSING';
    case 'DATABASE_ERROR':
    case 'SERVER':
    case 'NO_SUPABASE_URL':
      return raw === 'NO_SUPABASE_URL' ? 'DATABASE_ERROR' : raw === 'SERVER' ? 'DATABASE_ERROR' : 'DATABASE_ERROR';
    case 'CODE_NOT_FOUND':
    case 'CODE_INACTIVE':
    case 'CODE_EXPIRED':
    case 'CODE_LIMIT_REACHED':
    case 'ALREADY_REDEEMED':
    case 'ALREADY_PRO':
    case 'UNKNOWN_ERROR':
      return raw;
    default:
      return 'UNKNOWN_ERROR';
  }
}

export function isPromoProActive(until: string | null | undefined, now = Date.now()): boolean {
  if (!until) return false;
  const ts = new Date(until).getTime();
  return Number.isFinite(ts) && ts > now;
}

export async function fetchPromoEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<{ entitlement: PromoEntitlement; error: DbError | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('promo_pro_until, promo_source, redeemed_code, promo_ai_bonus')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { entitlement: EMPTY_ENTITLEMENT, error: mapSupabaseErr(error) };

  return {
    entitlement: {
      promoProUntil: data?.promo_pro_until ?? null,
      promoSource: data?.promo_source ?? null,
      redeemedCode: data?.redeemed_code ?? null,
      promoAiBonus: Math.max(0, data?.promo_ai_bonus ?? 0),
    },
    error: null,
  };
}

function warnMissingAssistantApiBase() {
  if (!Capacitor.isNativePlatform() || getAssistantApiBase()) return;
  console.warn(
    '[PetCare promo] Capacitor: VITE_ASSISTANT_API_BASE_URL is empty — /api/promo/redeem will hit the app origin (likely wrong). Set it in .env.capacitor before npm run build:ios.'
  );
}

export async function redeemPromoCode(
  accessToken: string,
  code: string,
  options?: { currentPlan?: 'free' | 'pro' }
): Promise<PromoRedeemResult> {
  warnMissingAssistantApiBase();

  const url = assistantApiUrl('/api/promo/redeem');
  const token = accessToken.trim();

  if (!token) {
    return {
      ok: false,
      error: 'Missing access token',
      message: promoErrorMessage('zh', 'NOT_AUTHENTICATED'),
      code: 'NOT_AUTHENTICATED',
    };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code: code.trim(),
        currentPlan: options?.currentPlan === 'pro' ? 'pro' : 'free',
      }),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[promo/redeem] network error', { url, error });
    return { ok: false, error, code: 'NETWORK', httpStatus: 0 };
  }

  const rawText = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
  } catch {
    console.error('[promo/redeem] invalid JSON response', {
      url,
      httpStatus: res.status,
      body: rawText.slice(0, 500),
    });
    return {
      ok: false,
      error: 'Invalid server response',
      code: res.status >= 500 ? 'UNKNOWN_ERROR' : 'INVALID_JSON',
      httpStatus: res.status,
      rawBody: rawText,
    };
  }

  if (!json || typeof json !== 'object') {
    console.error('[promo/redeem] empty or invalid body', { url, httpStatus: res.status, body: json });
    return {
      ok: false,
      error: 'Invalid server response',
      code: res.status >= 500 ? 'UNKNOWN_ERROR' : 'INVALID_JSON',
      httpStatus: res.status,
      rawBody: json,
    };
  }

  if (json.ok === true) {
    return json as Extract<PromoRedeemResult, { ok: true }>;
  }

  const codeKey = normalizePromoErrorCode(typeof json.code === 'string' ? json.code : undefined);
  const errorText = typeof json.error === 'string' ? json.error : 'Redemption failed';
  const messageText = typeof json.message === 'string' ? json.message : undefined;

  if (!res.ok) {
    console.error('[promo/redeem] API error', {
      url,
      httpStatus: res.status,
      code: codeKey,
      error: errorText,
      message: messageText,
      body: json,
    });
  }

  return {
    ok: false,
    error: errorText,
    message: messageText,
    code: codeKey,
    httpStatus: res.status,
    rawBody: json,
  };
}

export function promoErrorMessage(lang: 'zh' | 'en', code: PromoRedeemErrorCode | string | undefined): string {
  const zh: Record<string, string> = {
    NOT_AUTHENTICATED: '請先登入後再兌換',
    CODE_NOT_FOUND: '代碼不存在，請確認後再試',
    CODE_EXPIRED: '代碼已過期',
    CODE_LIMIT_REACHED: '代碼已達使用上限',
    ALREADY_REDEEMED: '此帳號已兌換過此代碼',
    ALREADY_PRO: '你目前已是 Pro，無需兌換此代碼',
    CODE_INACTIVE: '代碼已停用',
    SUPABASE_SERVICE_KEY_MISSING: '伺服器設定不完整，請稍後再試',
    DATABASE_ERROR: '資料庫錯誤，請稍後再試',
    INVALID_REQUEST: '請輸入有效的兌換碼',
    INVALID_JSON: '伺服器回應格式錯誤',
    NETWORK: '網路連線失敗，請稍後再試',
    UNKNOWN_ERROR: '兌換失敗，請稍後再試',
    UNAUTHENTICATED: '請先登入後再兌換',
    INVALID_CODE: '請輸入有效的兌換碼',
    SERVER: '兌換失敗，請稍後再試',
  };
  const en: Record<string, string> = {
    NOT_AUTHENTICATED: 'Sign in to redeem a code.',
    CODE_NOT_FOUND: 'Code not found. Please check and try again.',
    CODE_EXPIRED: 'This code has expired.',
    CODE_LIMIT_REACHED: 'This code has reached its redemption limit.',
    ALREADY_REDEEMED: 'This account has already redeemed this code.',
    ALREADY_PRO: 'You already have Pro — this code is not needed.',
    CODE_INACTIVE: 'This code is inactive.',
    SUPABASE_SERVICE_KEY_MISSING: 'Server configuration incomplete. Please try again later.',
    DATABASE_ERROR: 'Database error. Please try again later.',
    INVALID_REQUEST: 'Enter a valid promo code.',
    INVALID_JSON: 'Invalid server response format.',
    NETWORK: 'Network error. Please try again.',
    UNKNOWN_ERROR: 'Redemption failed. Please try again.',
    UNAUTHENTICATED: 'Sign in to redeem a code.',
    INVALID_CODE: 'Enter a valid promo code.',
    SERVER: 'Redemption failed. Please try again.',
  };
  const table = lang === 'zh' ? zh : en;
  return table[code ?? ''] ?? table.UNKNOWN_ERROR;
}

/** Prefer backend message; special-case HTTP 500 per product requirement. */
export function resolvePromoRedeemMessage(
  lang: 'zh' | 'en',
  result: Extract<PromoRedeemResult, { ok: false }>
): string {
  if (result.httpStatus === 500) {
    return lang === 'zh' ? '兌換失敗：伺服器錯誤' : 'Redemption failed: server error';
  }
  if (result.message?.trim()) return result.message.trim();
  return promoErrorMessage(lang, result.code);
}

export function promoSuccessMessage(
  lang: 'zh' | 'en',
  result: Extract<PromoRedeemResult, { ok: true }>
): string {
  if (result.type === 'ai_bonus') {
    const added = result.bonusAdded ?? 0;
    return lang === 'zh'
      ? `已加贈 AI 次數 +${added}（今日上限已提升）`
      : `AI bonus applied (+${added} to your daily limit)`;
  }
  const until = result.promoProUntilLabel ?? (result.promoProUntil ? result.promoProUntil.slice(0, 10) : '');
  return lang === 'zh'
    ? `已啟用活動體驗資格，到期日：${until}`
    : `Promo Pro activated until ${until}`;
}
