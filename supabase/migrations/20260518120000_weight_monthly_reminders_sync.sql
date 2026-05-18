-- Cross-device sync: weight, monthly care, user reminders (matches owner_id + cat_members RLS).

create table if not exists public.weight_records (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  record_date date not null,
  weight_kg numeric(8, 3) not null,
  note text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cat_id, record_date)
);

create index if not exists weight_records_cat_date_idx on public.weight_records (cat_id, record_date desc);

create table if not exists public.monthly_records (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  month_key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cat_id, month_key)
);

create index if not exists monthly_records_cat_month_idx on public.monthly_records (cat_id, month_key desc);

create table if not exists public.user_reminders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reminders jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.weight_records enable row level security;
alter table public.monthly_records enable row level security;
alter table public.user_reminders enable row level security;

-- weight_records
drop policy if exists "weight_records_select" on public.weight_records;
create policy "weight_records_select"
  on public.weight_records for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

drop policy if exists "weight_records_insert" on public.weight_records;
create policy "weight_records_insert"
  on public.weight_records for insert to authenticated
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

drop policy if exists "weight_records_update" on public.weight_records;
create policy "weight_records_update"
  on public.weight_records for update to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id))
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

drop policy if exists "weight_records_delete" on public.weight_records;
create policy "weight_records_delete"
  on public.weight_records for delete to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

-- monthly_records
drop policy if exists "monthly_records_select" on public.monthly_records;
create policy "monthly_records_select"
  on public.monthly_records for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

drop policy if exists "monthly_records_insert" on public.monthly_records;
create policy "monthly_records_insert"
  on public.monthly_records for insert to authenticated
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

drop policy if exists "monthly_records_update" on public.monthly_records;
create policy "monthly_records_update"
  on public.monthly_records for update to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id))
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

drop policy if exists "monthly_records_delete" on public.monthly_records;
create policy "monthly_records_delete"
  on public.monthly_records for delete to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

-- user_reminders (per user)
drop policy if exists "user_reminders_select" on public.user_reminders;
create policy "user_reminders_select"
  on public.user_reminders for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_reminders_insert" on public.user_reminders;
create policy "user_reminders_insert"
  on public.user_reminders for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_reminders_update" on public.user_reminders;
create policy "user_reminders_update"
  on public.user_reminders for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.weight_records to authenticated;
grant select, insert, update, delete on public.monthly_records to authenticated;
grant select, insert, update on public.user_reminders to authenticated;
