import { createClient } from '@supabase/supabase-js';

function getEnv(name) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function bearerTokenFromAuthHeader(authorization) {
  const raw = typeof authorization === 'string' ? authorization.trim() : '';
  if (!raw) return '';
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] || '').trim();
}

const USER_MESSAGES = {
  NOT_AUTHENTICATED: '請先登入後再兌換',
  CODE_NOT_FOUND: '代碼不存在，請確認後再試',
  CODE_INACTIVE: '代碼已停用',
  CODE_EXPIRED: '代碼已過期',
  CODE_LIMIT_REACHED: '代碼已達使用上限',
  ALREADY_REDEEMED: '此帳號已兌換過此代碼',
  ALREADY_PRO: '你目前已是 Pro，無需兌換此代碼',
  SUPABASE_SERVICE_KEY_MISSING: '伺服器設定不完整，請稍後再試',
  DATABASE_ERROR: '資料庫錯誤，請稍後再試',
  INVALID_REQUEST: '請輸入有效的兌換碼',
  UNKNOWN_ERROR: '兌換失敗，請稍後再試',
};

function userMessage(code, detail) {
  return USER_MESSAGES[code] ?? detail ?? USER_MESSAGES.UNKNOWN_ERROR;
}

function fail(step, status, code, detail, meta = {}) {
  const message = userMessage(code, detail);
  console.error('[promo/redeem] failed', {
    step,
    userId: meta.userId ?? null,
    code: meta.promoCode ?? null,
    error: detail,
    errCode: code,
  });
  return { status, json: { ok: false, code, error: detail, message } };
}

function assertConfigured() {
  const url = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url) {
    return fail('config', 503, 'DATABASE_ERROR', 'Missing SUPABASE_URL (or VITE_SUPABASE_URL)');
  }
  if (!serviceRoleKey) {
    return fail('config', 503, 'SUPABASE_SERVICE_KEY_MISSING', 'Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return { ok: true, url, serviceRoleKey };
}

function normalizeCode(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

function addDaysIso(fromDate, days) {
  const d = new Date(fromDate.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function maxIso(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function formatYmd(iso) {
  return iso.slice(0, 10);
}

/**
 * Redeem a promo code for the authenticated user.
 * Requires Authorization: Bearer <access_token>.
 */
export async function redeemPromoPOST({ authorization, body }) {
  const cfg = assertConfigured();
  if (!cfg.ok) return cfg;

  const promoCodeInput = normalizeCode(body?.code);
  const meta = { promoCode: promoCodeInput || null };

  const token = bearerTokenFromAuthHeader(authorization);
  if (!token) {
    return fail('auth', 401, 'NOT_AUTHENTICATED', 'Missing Authorization bearer token', meta);
  }

  if (promoCodeInput.length < 3) {
    return fail('validate', 400, 'INVALID_REQUEST', 'Invalid promo code', meta);
  }

  const supabaseAdmin = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const userId = userData?.user?.id;
  meta.userId = userId ?? null;

  if (userErr || !userId) {
    return fail('auth', 401, 'NOT_AUTHENTICATED', userErr?.message || 'Invalid or expired session', meta);
  }

  const { data: promo, error: promoErr } = await supabaseAdmin
    .from('promo_codes')
    .select(
      'id, code, type, duration_days, bonus_ai_uses, max_redemptions, used_count, expires_at, is_active, campaign_name'
    )
    .ilike('code', promoCodeInput)
    .maybeSingle();

  if (promoErr) {
    return fail('lookup_promo', 500, 'DATABASE_ERROR', promoErr.message, meta);
  }
  if (!promo) {
    return fail('lookup_promo', 404, 'CODE_NOT_FOUND', 'Promo code not found', meta);
  }
  if (!promo.is_active) {
    return fail('validate_promo', 400, 'CODE_INACTIVE', 'Promo code is inactive', meta);
  }
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= Date.now()) {
    return fail('validate_promo', 400, 'CODE_EXPIRED', 'Promo code expired', meta);
  }
  if (promo.used_count >= promo.max_redemptions) {
    return fail('validate_promo', 400, 'CODE_LIMIT_REACHED', 'Promo code redemption limit reached', meta);
  }

  const { data: existingRedemption, error: redemptionLookupErr } = await supabaseAdmin
    .from('promo_redemptions')
    .select('id')
    .eq('user_id', userId)
    .eq('promo_code_id', promo.id)
    .maybeSingle();

  if (redemptionLookupErr) {
    return fail('lookup_redemption', 500, 'DATABASE_ERROR', redemptionLookupErr.message, meta);
  }
  if (existingRedemption) {
    return fail('validate_redemption', 409, 'ALREADY_REDEEMED', 'This account already redeemed this code', meta);
  }

  const { data: prefs, error: prefsErr } = await supabaseAdmin
    .from('user_preferences')
    .select('ai_plan')
    .eq('user_id', userId)
    .maybeSingle();

  if (prefsErr) {
    return fail('lookup_prefs', 500, 'DATABASE_ERROR', prefsErr.message, meta);
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('promo_pro_until, promo_source, redeemed_code, promo_ai_bonus')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    return fail('lookup_profile', 500, 'DATABASE_ERROR', profileErr.message, meta);
  }

  const clientPlan = body?.currentPlan === 'pro' ? 'pro' : 'free';
  const promoProActive =
    profile?.promo_pro_until && new Date(profile.promo_pro_until).getTime() > Date.now();
  const cloudPro = prefs?.ai_plan === 'pro';
  const isProUser = Boolean(promoProActive || cloudPro || clientPlan === 'pro');

  // ai_bonus codes remain redeemable for Pro users; only pro_trial is blocked.
  if (promo.type === 'pro_trial' && isProUser) {
    return fail('validate_entitlement', 400, 'ALREADY_PRO', 'User already has Pro', meta);
  }

  const now = new Date();
  const campaignName = promo.campaign_name?.trim() || promo.code;
  const profilePatch = {
    promo_source: campaignName,
    redeemed_code: promo.code,
    updated_at: now.toISOString(),
  };

  let promoProUntil = profile?.promo_pro_until ?? null;
  let promoAiBonus = profile?.promo_ai_bonus ?? 0;

  if (promo.type === 'pro_trial') {
    const base = maxIso(profile?.promo_pro_until, now.toISOString());
    promoProUntil = addDaysIso(new Date(base), promo.duration_days);
    profilePatch.promo_pro_until = promoProUntil;
  } else if (promo.type === 'ai_bonus') {
    promoAiBonus = Math.max(0, promoAiBonus) + Math.max(0, promo.bonus_ai_uses);
    profilePatch.promo_ai_bonus = promoAiBonus;
  }

  const { data: incremented, error: incrementErr } = await supabaseAdmin
    .from('promo_codes')
    .update({ used_count: promo.used_count + 1, updated_at: now.toISOString() })
    .eq('id', promo.id)
    .eq('used_count', promo.used_count)
    .select('used_count, max_redemptions')
    .maybeSingle();

  if (incrementErr) {
    return fail('increment_used_count', 500, 'DATABASE_ERROR', incrementErr.message, meta);
  }
  if (!incremented || incremented.used_count > incremented.max_redemptions) {
    return fail('increment_used_count', 409, 'CODE_LIMIT_REACHED', 'Promo code redemption limit reached', meta);
  }

  const { error: profileUpdateErr } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', userId);
  if (profileUpdateErr) {
    return fail('update_profile', 500, 'DATABASE_ERROR', profileUpdateErr.message, meta);
  }

  const { error: insertRedemptionErr } = await supabaseAdmin.from('promo_redemptions').insert({
    user_id: userId,
    promo_code_id: promo.id,
    code: promo.code,
  });

  if (insertRedemptionErr) {
    if (insertRedemptionErr.code === '23505') {
      return fail('insert_redemption', 409, 'ALREADY_REDEEMED', 'This account already redeemed this code', meta);
    }
    return fail('insert_redemption', 500, 'DATABASE_ERROR', insertRedemptionErr.message, meta);
  }

  return {
    status: 200,
    json: {
      ok: true,
      type: promo.type,
      code: promo.code,
      campaignName,
      promoProUntil,
      promoAiBonus,
      bonusAdded: promo.type === 'ai_bonus' ? promo.bonus_ai_uses : null,
      promoProUntilLabel: promoProUntil ? formatYmd(promoProUntil) : null,
      entitlement: {
        promoProUntil,
        promoSource: campaignName,
        redeemedCode: promo.code,
        promoAiBonus,
      },
    },
  };
}
