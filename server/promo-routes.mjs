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

function assertConfigured() {
  const url = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url) {
    return { ok: false, status: 503, error: 'Missing SUPABASE_URL (or VITE_SUPABASE_URL)', code: 'NO_SUPABASE_URL' };
  }
  if (!serviceRoleKey) {
    return { ok: false, status: 503, error: 'Missing SUPABASE_SERVICE_ROLE_KEY', code: 'NO_SERVICE_ROLE_KEY' };
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
  if (!cfg.ok) return { status: cfg.status, json: { ok: false, error: cfg.error, code: cfg.code } };

  const token = bearerTokenFromAuthHeader(authorization);
  if (!token) {
    return { status: 401, json: { ok: false, error: 'Missing Authorization bearer token', code: 'UNAUTHENTICATED' } };
  }

  const codeInput = normalizeCode(body?.code);
  if (codeInput.length < 3) {
    return { status: 400, json: { ok: false, error: 'Invalid promo code', code: 'INVALID_CODE' } };
  }

  const supabaseAdmin = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userErr || !userId) {
    return { status: 401, json: { ok: false, error: 'Invalid or expired session', code: 'UNAUTHENTICATED' } };
  }

  const { data: promo, error: promoErr } = await supabaseAdmin
    .from('promo_codes')
    .select(
      'id, code, type, duration_days, bonus_ai_uses, max_redemptions, used_count, expires_at, is_active, campaign_name'
    )
    .ilike('code', codeInput)
    .maybeSingle();

  if (promoErr) {
    return { status: 500, json: { ok: false, error: promoErr.message, code: 'SERVER' } };
  }
  if (!promo) {
    return { status: 404, json: { ok: false, error: 'Promo code not found', code: 'CODE_NOT_FOUND' } };
  }
  if (!promo.is_active) {
    return { status: 400, json: { ok: false, error: 'Promo code is inactive', code: 'CODE_INACTIVE' } };
  }
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= Date.now()) {
    return { status: 400, json: { ok: false, error: 'Promo code expired', code: 'CODE_EXPIRED' } };
  }
  if (promo.used_count >= promo.max_redemptions) {
    return { status: 400, json: { ok: false, error: 'Promo code redemption limit reached', code: 'CODE_LIMIT_REACHED' } };
  }

  const { data: existingRedemption, error: redemptionLookupErr } = await supabaseAdmin
    .from('promo_redemptions')
    .select('id')
    .eq('user_id', userId)
    .eq('promo_code_id', promo.id)
    .maybeSingle();

  if (redemptionLookupErr) {
    return { status: 500, json: { ok: false, error: redemptionLookupErr.message, code: 'SERVER' } };
  }
  if (existingRedemption) {
    return { status: 409, json: { ok: false, error: 'This account already redeemed this code', code: 'ALREADY_REDEEMED' } };
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('promo_pro_until, promo_source, redeemed_code, promo_ai_bonus')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    return { status: 500, json: { ok: false, error: profileErr.message, code: 'SERVER' } };
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
    return { status: 500, json: { ok: false, error: incrementErr.message, code: 'SERVER' } };
  }
  if (!incremented || incremented.used_count > incremented.max_redemptions) {
    return { status: 409, json: { ok: false, error: 'Promo code redemption limit reached', code: 'CODE_LIMIT_REACHED' } };
  }

  const { error: profileUpdateErr } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', userId);
  if (profileUpdateErr) {
    return { status: 500, json: { ok: false, error: profileUpdateErr.message, code: 'SERVER' } };
  }

  const { error: insertRedemptionErr } = await supabaseAdmin.from('promo_redemptions').insert({
    user_id: userId,
    promo_code_id: promo.id,
    code: promo.code,
  });

  if (insertRedemptionErr) {
    if (insertRedemptionErr.code === '23505') {
      return { status: 409, json: { ok: false, error: 'This account already redeemed this code', code: 'ALREADY_REDEEMED' } };
    }
    return { status: 500, json: { ok: false, error: insertRedemptionErr.message, code: 'SERVER' } };
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
