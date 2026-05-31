import type { SupabaseClient } from '@supabase/supabase-js';
import { assistantApiUrl } from './lib/assistantApiBase';
import { mapSupabaseErr, type DbError } from './supabaseError';

export type PromoEntitlement = {
  promoProUntil: string | null;
  promoSource: string | null;
  redeemedCode: string | null;
  promoAiBonus: number;
};

export type PromoRedeemErrorCode =
  | 'CODE_NOT_FOUND'
  | 'CODE_EXPIRED'
  | 'CODE_LIMIT_REACHED'
  | 'ALREADY_REDEEMED'
  | 'CODE_INACTIVE'
  | 'UNAUTHENTICATED'
  | 'INVALID_CODE'
  | 'NO_SERVICE_ROLE_KEY'
  | 'NO_SUPABASE_URL'
  | 'SERVER'
  | 'INVALID_JSON';

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
  | { ok: false; error: string; code: PromoRedeemErrorCode };

const EMPTY_ENTITLEMENT: PromoEntitlement = {
  promoProUntil: null,
  promoSource: null,
  redeemedCode: null,
  promoAiBonus: 0,
};

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

export async function redeemPromoCode(accessToken: string, code: string): Promise<PromoRedeemResult> {
  const res = await fetch(assistantApiUrl('/api/promo/redeem'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ code: code.trim() }),
  });

  let json: PromoRedeemResult | { error?: string; code?: PromoRedeemErrorCode; ok?: boolean } = {
    ok: false,
    error: 'Unknown error',
    code: 'SERVER',
  };
  try {
    json = (await res.json()) as PromoRedeemResult;
  } catch {
    return { ok: false, error: 'Invalid server response', code: 'SERVER' };
  }

  if (json && typeof json === 'object' && 'ok' in json) {
    return json as PromoRedeemResult;
  }
  return { ok: false, error: 'Invalid server response', code: 'SERVER' };
}

export function promoErrorMessage(lang: 'zh' | 'en', code: PromoRedeemErrorCode | string | undefined): string {
  const zh: Record<string, string> = {
    CODE_NOT_FOUND: '代碼不存在',
    CODE_EXPIRED: '代碼已過期',
    CODE_LIMIT_REACHED: '代碼已達使用上限',
    ALREADY_REDEEMED: '此帳號已兌換過',
    CODE_INACTIVE: '代碼已停用',
    UNAUTHENTICATED: '請先登入後再兌換',
    INVALID_CODE: '請輸入有效的推廣碼',
    SERVER: '兌換失敗，請稍後再試',
  };
  const en: Record<string, string> = {
    CODE_NOT_FOUND: 'Code not found',
    CODE_EXPIRED: 'Code expired',
    CODE_LIMIT_REACHED: 'Code redemption limit reached',
    ALREADY_REDEEMED: 'This account already redeemed this code',
    CODE_INACTIVE: 'Code is inactive',
    UNAUTHENTICATED: 'Sign in to redeem a code',
    INVALID_CODE: 'Enter a valid promo code',
    SERVER: 'Redemption failed. Please try again.',
  };
  const table = lang === 'zh' ? zh : en;
  return table[code ?? ''] ?? table.SERVER;
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
