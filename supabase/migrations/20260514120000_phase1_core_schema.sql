-- Phase 1: core schema + RLS (no frontend changes in this migration)
-- Run with Supabase CLI: supabase db push / migration apply, or paste in SQL editor.
--
-- Client bootstrap order (Phase 2):
--   1) INSERT households
--   2) INSERT household_members (owner bootstrap: role=owner, user_id=auth.uid(), first row only)
--   3) INSERT cats (requires active household member)
--   4) daily_records / weight_records / care_events as needed

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🐱',
  profile_photo_url text,
  birthday date,
  gender text,
  breed text,
  neutered text,
  chip_no text,
  chronic_note text,
  allergy_note text,
  vet_clinic text,
  profile_note text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

CREATE TABLE public.daily_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  cat_id uuid NOT NULL REFERENCES public.cats (id) ON DELETE CASCADE,
  date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cat_id, date)
);

CREATE TABLE public.weight_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  cat_id uuid NOT NULL REFERENCES public.cats (id) ON DELETE CASCADE,
  date date NOT NULL,
  weight_kg numeric(6, 3) NOT NULL,
  note text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.care_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  cat_id uuid NOT NULL REFERENCES public.cats (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  code text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  expires_at timestamptz,
  max_uses int,
  use_count int NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invite_codes_code_lower_unique ON public.invite_codes (lower(code));

CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  feature text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX cats_household_id_idx ON public.cats (household_id);
CREATE INDEX household_members_user_id_idx ON public.household_members (user_id);
CREATE INDEX household_members_household_id_idx ON public.household_members (household_id);
CREATE INDEX daily_records_cat_date_idx ON public.daily_records (cat_id, date);
CREATE INDEX weight_records_cat_id_idx ON public.weight_records (cat_id);
CREATE INDEX care_events_cat_created_idx ON public.care_events (cat_id, created_at DESC);
CREATE INDEX ai_usage_logs_household_date_idx ON public.ai_usage_logs (household_id, usage_date);

-- ---------------------------------------------------------------------------
-- updated_at touch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER households_set_updated_at
BEFORE UPDATE ON public.households
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER cats_set_updated_at
BEFORE UPDATE ON public.cats
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER weight_records_set_updated_at
BEFORE UPDATE ON public.weight_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: create profile row for new user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1), 'User'),
    now(),
    now()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Invite: accept by code (for Phase 2 client; validates expiry / revoke / max uses)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_invite(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
  v_invite_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT ic.id, ic.household_id
  INTO v_invite_id, v_household_id
  FROM public.invite_codes ic
  WHERE lower(ic.code) = lower(trim(p_code))
    AND ic.revoked_at IS NULL
    AND (ic.expires_at IS NULL OR ic.expires_at > now())
    AND (ic.max_uses IS NULL OR ic.use_count < ic.max_uses)
  FOR UPDATE;

  IF v_invite_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_invite';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = v_household_id
      AND hm.user_id = v_uid
      AND hm.status = 'active'
  ) THEN
    RETURN v_household_id;
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role, invited_by, status, joined_at)
  VALUES (v_household_id, v_uid, 'member', NULL, 'active', now());

  UPDATE public.invite_codes
  SET use_count = use_count + 1
  WHERE id = v_invite_id;

  RETURN v_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Helper predicates (inline in policies for clarity)

-- profiles: self always; others if co-member in an active household
CREATE POLICY profiles_select_own_or_cohousehold
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.household_members me
    JOIN public.household_members them
      ON them.household_id = me.household_id
     AND them.status = 'active'
    WHERE me.user_id = auth.uid()
      AND me.status = 'active'
      AND them.user_id = profiles.id
  )
);

CREATE POLICY profiles_insert_self
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_self
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- households: active members can read
CREATE POLICY households_select_member
ON public.households FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = households.id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

-- create household: any signed-in user (app will add owner row next)
CREATE POLICY households_insert_authenticated
ON public.households FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY households_update_owner
ON public.households FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = households.id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
);

CREATE POLICY households_delete_owner
ON public.households FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = households.id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
);

-- cats: members read; members insert; members update; only owner deletes
CREATE POLICY cats_select_member
ON public.cats FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = cats.household_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY cats_insert_member
ON public.cats FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = cats.household_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY cats_update_member
ON public.cats FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = cats.household_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY cats_delete_owner
ON public.cats FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = cats.household_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
);

-- household_members: members see rows in their households
CREATE POLICY household_members_select_member
ON public.household_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members me
    WHERE me.household_id = household_members.household_id
      AND me.user_id = auth.uid()
      AND me.status = 'active'
  )
);

-- Owner adds another user (invite flow controlled by app + invite_codes)
CREATE POLICY household_members_insert_owner
ON public.household_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_members.household_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
);

-- Owner removes (soft-delete) members; cannot target owner row
CREATE POLICY household_members_update_owner
ON public.household_members FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_members.household_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
  AND household_members.role <> 'owner'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_members.household_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
);

-- First owner row: inserting self as owner when creating household (no prior row)
CREATE POLICY household_members_insert_self_owner_bootstrap
ON public.household_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'owner'
  AND status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.household_members x
    WHERE x.household_id = household_members.household_id
  )
);

-- daily_records: member of cat's household
CREATE POLICY daily_records_select_member
ON public.daily_records FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = daily_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY daily_records_insert_member
ON public.daily_records FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = daily_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY daily_records_update_member
ON public.daily_records FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = daily_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = daily_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY daily_records_delete_member
ON public.daily_records FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = daily_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

-- weight_records
CREATE POLICY weight_records_select_member
ON public.weight_records FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = weight_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY weight_records_insert_member
ON public.weight_records FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = weight_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY weight_records_update_member
ON public.weight_records FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = weight_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = weight_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY weight_records_delete_member
ON public.weight_records FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = weight_records.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

-- care_events
CREATE POLICY care_events_select_member
ON public.care_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = care_events.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY care_events_insert_member
ON public.care_events FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = care_events.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY care_events_update_member
ON public.care_events FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = care_events.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = care_events.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY care_events_delete_member
ON public.care_events FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cats c
    JOIN public.household_members hm ON hm.household_id = c.household_id
    WHERE c.id = care_events.cat_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

-- invite_codes: members see; owner insert/update/delete
CREATE POLICY invite_codes_select_member
ON public.invite_codes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = invite_codes.household_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY invite_codes_insert_owner
ON public.invite_codes FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = invite_codes.household_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
);

CREATE POLICY invite_codes_update_owner
ON public.invite_codes FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = invite_codes.household_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
);

CREATE POLICY invite_codes_delete_owner
ON public.invite_codes FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = invite_codes.household_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'owner'
      AND hm.status = 'active'
  )
);

-- ai_usage_logs: insert self as actor; read if same household
CREATE POLICY ai_usage_logs_select_member
ON public.ai_usage_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = ai_usage_logs.household_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

CREATE POLICY ai_usage_logs_insert_member
ON public.ai_usage_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = ai_usage_logs.household_id
      AND hm.user_id = auth.uid()
      AND hm.status = 'active'
  )
);

-- ---------------------------------------------------------------------------
-- Comments (documentation)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.profiles IS 'App user display profile; 1:1 with auth.users.';
COMMENT ON TABLE public.households IS 'Shared care space; cats belong to a household.';
COMMENT ON TABLE public.cats IS 'Cat profile; MVP typically one cat per household.';
COMMENT ON TABLE public.household_members IS 'Membership; role owner | member; status active | removed.';
COMMENT ON TABLE public.daily_records IS 'Per-cat per-calendar-date snapshot; data JSON aligns with app DailyRecord.';
COMMENT ON TABLE public.weight_records IS 'Weight entries with attribution.';
COMMENT ON TABLE public.care_events IS 'Append-only activity log for who did what and when.';
COMMENT ON TABLE public.invite_codes IS 'Invite to a household; use accept_invite(code) to join as member.';
COMMENT ON TABLE public.ai_usage_logs IS 'Optional per-household AI usage audit trail.';
COMMENT ON FUNCTION public.accept_invite(text) IS 'Join household as member; increments invite use_count.';

-- ---------------------------------------------------------------------------
-- Table privileges (PostgREST / supabase-js authenticated client)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.households TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.weight_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.care_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invite_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_usage_logs TO authenticated;
