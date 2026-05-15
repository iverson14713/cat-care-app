-- Phase 2: cats + cat_members (owner / member reserved for shared care).
-- Run after profiles migration. Apply via Supabase SQL Editor or `supabase db push`.

create table if not exists public.cats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null default '🐱',
  profile_photo text not null default '',
  birthday text not null default '',
  gender text not null default '',
  breed text not null default '',
  neutered text not null default '',
  chip_no text not null default '',
  chronic_note text not null default '',
  allergy_note text not null default '',
  vet_clinic text not null default '',
  profile_note text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists cats_owner_id_idx on public.cats (owner_id);
create index if not exists cats_created_at_idx on public.cats (created_at);

create table if not exists public.cat_members (
  cat_id uuid not null references public.cats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (cat_id, user_id)
);

create index if not exists cat_members_user_id_idx on public.cat_members (user_id);
create index if not exists cat_members_cat_id_idx on public.cat_members (cat_id);

alter table public.cats enable row level security;
alter table public.cat_members enable row level security;

-- cats: visible if you are owner OR listed as a member
drop policy if exists "cats_select_visible" on public.cats;
create policy "cats_select_visible"
  on public.cats
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.cat_members m
      where m.cat_id = cats.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "cats_insert_owner" on public.cats;
create policy "cats_insert_owner"
  on public.cats
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "cats_update_owner" on public.cats;
create policy "cats_update_owner"
  on public.cats
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "cats_delete_owner" on public.cats;
create policy "cats_delete_owner"
  on public.cats
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- cat_members: read all rows for cats you belong to (for future shared roster)
drop policy if exists "cat_members_select_visible" on public.cat_members;
create policy "cat_members_select_visible"
  on public.cat_members
  for select
  to authenticated
  using (
    exists (
      select 1 from public.cat_members m
      where m.cat_id = cat_members.cat_id
        and m.user_id = auth.uid()
    )
  );

-- Owner may add other members (shared care — reserved for next phases)
drop policy if exists "cat_members_insert_by_owner" on public.cat_members;
create policy "cat_members_insert_by_owner"
  on public.cat_members
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.cat_members existing
      where existing.cat_id = cat_members.cat_id
        and existing.user_id = auth.uid()
        and existing.role = 'owner'
    )
  );

grant select, insert, update, delete on table public.cats to authenticated;
grant select, insert, update, delete on table public.cat_members to authenticated;

-- updated_at on cats
create or replace function public.set_cats_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists cats_set_updated_at on public.cats;
create trigger cats_set_updated_at
  before update on public.cats
  for each row
  execute function public.set_cats_updated_at();

-- New cat → owner row in cat_members (bypasses RLS via security definer)
create or replace function public.handle_new_cat_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cat_members (cat_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (cat_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists cats_after_insert_owner_member on public.cats;
create trigger cats_after_insert_owner_member
  after insert on public.cats
  for each row
  execute function public.handle_new_cat_owner_member();
