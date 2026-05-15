/**
 * Phase 1: manual types aligned with `supabase/migrations/20260514120000_phase1_core_schema.sql`.
 * Regenerate later with `supabase gen types typescript` when the remote schema is linked.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type HouseholdRole = 'owner' | 'member';
export type HouseholdMemberStatus = 'active' | 'removed';

export interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
}

export interface ProfileUpdate {
  display_name?: string;
  avatar_url?: string | null;
}

export interface HouseholdRow {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface HouseholdInsert {
  id?: string;
  name?: string | null;
}

export interface HouseholdUpdate {
  name?: string | null;
}

export interface CatRow {
  id: string;
  household_id: string;
  name: string;
  emoji: string;
  profile_photo_url: string | null;
  birthday: string | null;
  gender: string | null;
  breed: string | null;
  neutered: string | null;
  chip_no: string | null;
  chronic_note: string | null;
  allergy_note: string | null;
  vet_clinic: string | null;
  profile_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CatInsert {
  id?: string;
  household_id: string;
  name: string;
  emoji?: string;
  profile_photo_url?: string | null;
  birthday?: string | null;
  gender?: string | null;
  breed?: string | null;
  neutered?: string | null;
  chip_no?: string | null;
  chronic_note?: string | null;
  allergy_note?: string | null;
  vet_clinic?: string | null;
  profile_note?: string | null;
  created_by?: string | null;
}

export interface CatUpdate {
  name?: string;
  emoji?: string;
  profile_photo_url?: string | null;
  birthday?: string | null;
  gender?: string | null;
  breed?: string | null;
  neutered?: string | null;
  chip_no?: string | null;
  chronic_note?: string | null;
  allergy_note?: string | null;
  vet_clinic?: string | null;
  profile_note?: string | null;
}

export interface HouseholdMemberRow {
  id: string;
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  invited_by: string | null;
  status: HouseholdMemberStatus;
  joined_at: string;
}

export interface HouseholdMemberInsert {
  id?: string;
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  invited_by?: string | null;
  status?: HouseholdMemberStatus;
}

export interface HouseholdMemberUpdate {
  status?: HouseholdMemberStatus;
}

export interface DailyRecordRow {
  id: string;
  cat_id: string;
  date: string;
  data: Json;
  updated_by: string | null;
  updated_at: string;
}

export interface DailyRecordInsert {
  id?: string;
  cat_id: string;
  date: string;
  data?: Json;
  updated_by?: string | null;
}

export interface DailyRecordUpdate {
  data?: Json;
  updated_by?: string | null;
}

export interface WeightRecordRow {
  id: string;
  cat_id: string;
  date: string;
  weight_kg: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeightRecordInsert {
  id?: string;
  cat_id: string;
  date: string;
  weight_kg: number;
  note?: string | null;
  created_by?: string | null;
}

export interface WeightRecordUpdate {
  date?: string;
  weight_kg?: number;
  note?: string | null;
}

export interface CareEventRow {
  id: string;
  cat_id: string;
  event_type: string;
  payload: Json;
  created_by: string | null;
  created_at: string;
}

export interface CareEventInsert {
  id?: string;
  cat_id: string;
  event_type: string;
  payload?: Json;
  created_by?: string | null;
}

export interface CareEventUpdate {
  payload?: Json;
}

export interface InviteCodeRow {
  id: string;
  household_id: string;
  code: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  revoked_at: string | null;
  created_at: string;
}

export interface InviteCodeInsert {
  id?: string;
  household_id: string;
  code: string;
  created_by: string;
  expires_at?: string | null;
  max_uses?: number | null;
}

export interface InviteCodeUpdate {
  revoked_at?: string | null;
  use_count?: number;
}

export interface AiUsageLogRow {
  id: string;
  household_id: string;
  user_id: string;
  usage_date: string;
  feature: string;
  meta: Json;
  created_at: string;
}

export interface AiUsageLogInsert {
  id?: string;
  household_id: string;
  user_id: string;
  usage_date: string;
  feature: string;
  meta?: Json;
}

/** For `createClient<Database>(...)` in Phase 2. */
export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: ProfileInsert; Update: ProfileUpdate };
      households: { Row: HouseholdRow; Insert: HouseholdInsert; Update: HouseholdUpdate };
      cats: { Row: CatRow; Insert: CatInsert; Update: CatUpdate };
      household_members: {
        Row: HouseholdMemberRow;
        Insert: HouseholdMemberInsert;
        Update: HouseholdMemberUpdate;
      };
      daily_records: { Row: DailyRecordRow; Insert: DailyRecordInsert; Update: DailyRecordUpdate };
      weight_records: { Row: WeightRecordRow; Insert: WeightRecordInsert; Update: WeightRecordUpdate };
      care_events: { Row: CareEventRow; Insert: CareEventInsert; Update: CareEventUpdate };
      invite_codes: { Row: InviteCodeRow; Insert: InviteCodeInsert; Update: InviteCodeUpdate };
      ai_usage_logs: { Row: AiUsageLogRow; Insert: AiUsageLogInsert; Update: never };
    };
    Views: Record<string, never>;
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
