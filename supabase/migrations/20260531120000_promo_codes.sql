-- Promo / redemption codes for campaigns (pet expo, influencers, etc.)
-- Redemption writes to profiles via service-role API only.

CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  type text NOT NULL CHECK (type IN ('pro_trial', 'ai_bonus')),
  duration_days integer,
  bonus_ai_uses integer NOT NULL DEFAULT 0,
  max_redemptions integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  campaign_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_code_nonempty CHECK (char_length(trim(code)) >= 3),
  CONSTRAINT promo_codes_used_lte_max CHECK (used_count <= max_redemptions),
  CONSTRAINT promo_codes_type_payload CHECK (
    (type = 'pro_trial' AND duration_days IS NOT NULL AND duration_days > 0)
    OR (type = 'ai_bonus' AND bonus_ai_uses > 0)
  )
);

CREATE UNIQUE INDEX promo_codes_code_normalized_uq ON public.promo_codes (lower(trim(code)));

CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes (id) ON DELETE RESTRICT,
  code text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, promo_code_id)
);

CREATE INDEX promo_redemptions_user_id_idx ON public.promo_redemptions (user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS promo_pro_until timestamptz,
  ADD COLUMN IF NOT EXISTS promo_source text,
  ADD COLUMN IF NOT EXISTS redeemed_code text,
  ADD COLUMN IF NOT EXISTS promo_ai_bonus integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.touch_promo_codes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promo_codes_set_updated_at ON public.promo_codes;
CREATE TRIGGER promo_codes_set_updated_at
BEFORE UPDATE ON public.promo_codes
FOR EACH ROW
EXECUTE FUNCTION public.touch_promo_codes_updated_at();

CREATE OR REPLACE FUNCTION public.protect_profile_promo_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.promo_pro_until := NULL;
    NEW.promo_source := NULL;
    NEW.redeemed_code := NULL;
    NEW.promo_ai_bonus := 0;
    RETURN NEW;
  END IF;
  IF NEW.promo_pro_until IS DISTINCT FROM OLD.promo_pro_until
     OR NEW.promo_source IS DISTINCT FROM OLD.promo_source
     OR NEW.redeemed_code IS DISTINCT FROM OLD.redeemed_code
     OR NEW.promo_ai_bonus IS DISTINCT FROM OLD.promo_ai_bonus THEN
    RAISE EXCEPTION 'promo entitlement fields are read-only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_promo_fields ON public.profiles;
CREATE TRIGGER protect_profile_promo_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_promo_fields();

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promo_redemptions_select_own
ON public.promo_redemptions FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- promo_codes: no client policies (service role API only)

COMMENT ON TABLE public.promo_codes IS 'Campaign promo / redemption codes (managed via admin SQL or dashboard)';
COMMENT ON TABLE public.promo_redemptions IS 'Per-user promo redemption audit trail';
COMMENT ON COLUMN public.profiles.promo_pro_until IS 'Promo Pro access expiry (UTC); checked alongside IAP';
-- Example admin inserts (run manually in Supabase SQL editor):
-- INSERT INTO public.promo_codes (code, type, duration_days, bonus_ai_uses, max_redemptions, campaign_name, note)
-- VALUES
--   ('YOURCODE30', 'pro_trial', 30, 0, 500, 'Campaign name', '30-day Pro trial'),
--   ('KOL90', 'pro_trial', 90, 0, 200, 'KOL 合作', '90-day Pro trial'),
--   ('VIP365', 'pro_trial', 365, 0, 50, 'VIP 年度體驗', '365-day Pro trial'),
--   ('AI10', 'ai_bonus', NULL, 10, 1000, 'AI 加贈活動', '+10 daily AI uses');
