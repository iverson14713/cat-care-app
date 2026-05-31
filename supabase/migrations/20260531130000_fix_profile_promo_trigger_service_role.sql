-- Fix protect_profile_promo_fields: allow service-role API to write promo entitlements.
-- The original trigger checked request.jwt.claim.role, but Supabase PostgREST / supabase-js
-- exposes the JWT role inside request.jwt.claims JSON instead.

CREATE OR REPLACE FUNCTION public.is_service_role_request()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, auth
AS $$
DECLARE
  claims_role text;
BEGIN
  -- Primary: full JWT payload set by PostgREST for supabase-js (incl. service role key)
  BEGIN
    claims_role := nullif(trim(current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '');
  EXCEPTION
    WHEN invalid_text_representation THEN
      claims_role := NULL;
    WHEN OTHERS THEN
      claims_role := NULL;
  END;

  IF claims_role = 'service_role' THEN
    RETURN true;
  END IF;

  -- Fallback: singular claim key (some Postgres / extension contexts)
  IF coalesce(nullif(trim(current_setting('request.jwt.claim.role', true)), ''), '') = 'service_role' THEN
    RETURN true;
  END IF;

  -- Fallback: Supabase auth helper
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.is_service_role_request() IS
  'True when the current request uses the Supabase service_role JWT (server-side API).';

CREATE OR REPLACE FUNCTION public.protect_profile_promo_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Server-side redeem API (service role) may set promo entitlement fields.
  IF public.is_service_role_request() THEN
    RETURN NEW;
  END IF;

  -- Block authenticated clients from setting promo fields on insert.
  IF TG_OP = 'INSERT' THEN
    NEW.promo_pro_until := NULL;
    NEW.promo_source := NULL;
    NEW.redeemed_code := NULL;
    NEW.promo_ai_bonus := 0;
    RETURN NEW;
  END IF;

  -- Block authenticated clients from changing promo fields on update.
  IF NEW.promo_pro_until IS DISTINCT FROM OLD.promo_pro_until
     OR NEW.promo_source IS DISTINCT FROM OLD.promo_source
     OR NEW.redeemed_code IS DISTINCT FROM OLD.redeemed_code
     OR NEW.promo_ai_bonus IS DISTINCT FROM OLD.promo_ai_bonus THEN
    RAISE EXCEPTION 'promo entitlement fields are read-only';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profile_promo_fields() IS
  'Prevents client JWT users from mutating promo entitlement columns; service_role bypasses.';
