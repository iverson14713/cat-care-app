-- Phase 1: profiles table + RLS + auto row on signup.
-- Run via Supabase CLI (`supabase db push`) or paste into Dashboard → SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update on table public.profiles to authenticated;

-- Keep updated_at fresh on change
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

-- New auth user → profile row (security definer bypasses RLS)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dn text;
begin
  dn := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data->>'display_name',
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1)
      )
    ),
    ''
  );
  insert into public.profiles (id, display_name)
  values (new.id, dn)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
