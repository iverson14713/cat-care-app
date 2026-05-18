-- Photos, weekly AI reports, per-user AI usage, shared care state.

create table if not exists public.daily_record_photos (
  cat_id uuid not null references public.cats (id) on delete cascade,
  record_date date not null,
  abnormal_photos jsonb not null default '[]'::jsonb,
  daily_photos jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (cat_id, record_date)
);

create index if not exists daily_record_photos_cat_idx on public.daily_record_photos (cat_id, record_date desc);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  week_end date not null,
  report jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id) on delete set null,
  unique (cat_id, week_end)
);

create index if not exists weekly_reports_cat_week_idx on public.weekly_reports (cat_id, week_end desc);

create table if not exists public.user_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  daily_used int not null default 0,
  vet_used int not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, usage_date)
);

create table if not exists public.shared_care_states (
  cat_id uuid primary key references public.cats (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ai_plan text not null default 'free' check (ai_plan in ('free', 'pro')),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.daily_record_photos enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.user_ai_usage enable row level security;
alter table public.shared_care_states enable row level security;
alter table public.user_preferences enable row level security;

-- daily_record_photos
drop policy if exists "daily_record_photos_select" on public.daily_record_photos;
create policy "daily_record_photos_select" on public.daily_record_photos for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));
drop policy if exists "daily_record_photos_insert" on public.daily_record_photos;
create policy "daily_record_photos_insert" on public.daily_record_photos for insert to authenticated
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));
drop policy if exists "daily_record_photos_update" on public.daily_record_photos;
create policy "daily_record_photos_update" on public.daily_record_photos for update to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id))
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));
drop policy if exists "daily_record_photos_delete" on public.daily_record_photos;
create policy "daily_record_photos_delete" on public.daily_record_photos for delete to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

-- weekly_reports
drop policy if exists "weekly_reports_select" on public.weekly_reports;
create policy "weekly_reports_select" on public.weekly_reports for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));
drop policy if exists "weekly_reports_insert" on public.weekly_reports;
create policy "weekly_reports_insert" on public.weekly_reports for insert to authenticated
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));
drop policy if exists "weekly_reports_update" on public.weekly_reports;
create policy "weekly_reports_update" on public.weekly_reports for update to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id))
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));
drop policy if exists "weekly_reports_delete" on public.weekly_reports;
create policy "weekly_reports_delete" on public.weekly_reports for delete to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

-- user_ai_usage
drop policy if exists "user_ai_usage_select" on public.user_ai_usage;
create policy "user_ai_usage_select" on public.user_ai_usage for select to authenticated using (user_id = auth.uid());
drop policy if exists "user_ai_usage_insert" on public.user_ai_usage;
create policy "user_ai_usage_insert" on public.user_ai_usage for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user_ai_usage_update" on public.user_ai_usage;
create policy "user_ai_usage_update" on public.user_ai_usage for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- shared_care_states
drop policy if exists "shared_care_states_select" on public.shared_care_states;
create policy "shared_care_states_select" on public.shared_care_states for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));
drop policy if exists "shared_care_states_insert" on public.shared_care_states;
create policy "shared_care_states_insert" on public.shared_care_states for insert to authenticated
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));
drop policy if exists "shared_care_states_update" on public.shared_care_states;
create policy "shared_care_states_update" on public.shared_care_states for update to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id))
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

-- user_preferences
drop policy if exists "user_preferences_select" on public.user_preferences;
create policy "user_preferences_select" on public.user_preferences for select to authenticated using (user_id = auth.uid());
drop policy if exists "user_preferences_insert" on public.user_preferences;
create policy "user_preferences_insert" on public.user_preferences for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user_preferences_update" on public.user_preferences;
create policy "user_preferences_update" on public.user_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.daily_record_photos to authenticated;
grant select, insert, update, delete on public.weekly_reports to authenticated;
grant select, insert, update on public.user_ai_usage to authenticated;
grant select, insert, update on public.shared_care_states to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
