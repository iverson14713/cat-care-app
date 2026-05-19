-- Phase 3: daily_records + care_events (today care sync; photos still local-only in app).
-- Requires cats + cat_members migration. Apply via Supabase SQL Editor or `supabase db push`.

create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  record_date date not null,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cat_id, record_date)
);

create index if not exists daily_records_cat_date_idx on public.daily_records (cat_id, record_date desc);

create table if not exists public.care_events (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  actor text not null,
  action text not null,
  summary text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists care_events_cat_created_idx on public.care_events (cat_id, created_at desc);

alter table public.daily_records enable row level security;
alter table public.care_events enable row level security;

-- Same visibility as cats: owner OR cat_member may read/write daily_records
drop policy if exists "daily_records_select" on public.daily_records;
create policy "daily_records_select"
  on public.daily_records
  for select
  to authenticated
  using (
    exists (select 1 from public.cats c where c.id = daily_records.cat_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.cat_members m
      where m.cat_id = daily_records.cat_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "daily_records_insert" on public.daily_records;
create policy "daily_records_insert"
  on public.daily_records
  for insert
  to authenticated
  with check (
    exists (select 1 from public.cats c where c.id = daily_records.cat_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.cat_members m
      where m.cat_id = daily_records.cat_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "daily_records_update" on public.daily_records;
create policy "daily_records_update"
  on public.daily_records
  for update
  to authenticated
  using (
    exists (select 1 from public.cats c where c.id = daily_records.cat_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.cat_members m
      where m.cat_id = daily_records.cat_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (select 1 from public.cats c where c.id = daily_records.cat_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.cat_members m
      where m.cat_id = daily_records.cat_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "daily_records_delete" on public.daily_records;
create policy "daily_records_delete"
  on public.daily_records
  for delete
  to authenticated
  using (
    exists (select 1 from public.cats c where c.id = daily_records.cat_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.cat_members m
      where m.cat_id = daily_records.cat_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "care_events_select" on public.care_events;
create policy "care_events_select"
  on public.care_events
  for select
  to authenticated
  using (
    exists (select 1 from public.cats c where c.id = care_events.cat_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.cat_members m
      where m.cat_id = care_events.cat_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "care_events_insert" on public.care_events;
create policy "care_events_insert"
  on public.care_events
  for insert
  to authenticated
  with check (
    exists (select 1 from public.cats c where c.id = care_events.cat_id and c.owner_id = auth.uid())
    or exists (
      select 1 from public.cat_members m
      where m.cat_id = care_events.cat_id and m.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.daily_records to authenticated;
grant select, insert on table public.care_events to authenticated;

create or replace function public.set_daily_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists daily_records_set_updated_at on public.daily_records;
create trigger daily_records_set_updated_at
  before update on public.daily_records
  for each row
  execute function public.set_daily_records_updated_at();
