-- Per-cat invite codes + accept_cat_invite() for real shared care.
-- Includes profiles bootstrap when missing (required for display names + co-member RLS).

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

-- Backfill profiles for existing auth users (safe to re-run).
insert into public.profiles (id, display_name)
select
  u.id,
  nullif(
    trim(
      coalesce(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name',
        split_part(u.email, '@', 1)
      )
    ),
    ''
  )
from auth.users u
on conflict (id) do nothing;

create table if not exists public.cat_invite_codes (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete cascade,
  code text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz,
  max_uses int,
  use_count int not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists cat_invite_codes_code_lower_idx on public.cat_invite_codes (lower(code));
create index if not exists cat_invite_codes_cat_active_idx on public.cat_invite_codes (cat_id, created_at desc);

alter table public.cat_invite_codes enable row level security;

drop policy if exists "cat_invite_codes_select" on public.cat_invite_codes;
create policy "cat_invite_codes_select" on public.cat_invite_codes for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

drop policy if exists "cat_invite_codes_insert" on public.cat_invite_codes;
create policy "cat_invite_codes_insert" on public.cat_invite_codes for insert to authenticated
  with check (public.is_cat_owner(cat_id) and created_by = auth.uid());

drop policy if exists "cat_invite_codes_update" on public.cat_invite_codes;
create policy "cat_invite_codes_update" on public.cat_invite_codes for update to authenticated
  using (public.is_cat_owner(cat_id))
  with check (public.is_cat_owner(cat_id));

drop policy if exists "cat_invite_codes_delete" on public.cat_invite_codes;
create policy "cat_invite_codes_delete" on public.cat_invite_codes for delete to authenticated
  using (public.is_cat_owner(cat_id));

grant select, insert, update, delete on public.cat_invite_codes to authenticated;

-- Allow owner to remove members (not self-delete owner row via this policy — app blocks)
drop policy if exists "cat_members_delete_by_owner" on public.cat_members;
create policy "cat_members_delete_by_owner" on public.cat_members for delete to authenticated
  using (
    public.is_cat_owner(cat_id)
    and role = 'member'
  );

create or replace function public.accept_cat_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat_id uuid;
  v_uid uuid := auth.uid();
  v_invite_id uuid;
  v_actor text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select ic.id, ic.cat_id
  into v_invite_id, v_cat_id
  from public.cat_invite_codes ic
  where upper(trim(ic.code)) = upper(trim(p_code))
    and ic.revoked_at is null
    and (ic.expires_at is null or ic.expires_at > timezone('utc', now()))
    and (ic.max_uses is null or ic.use_count < ic.max_uses)
  order by ic.created_at desc
  limit 1;

  if v_cat_id is null then
    raise exception 'invalid_or_expired_invite';
  end if;

  if exists (
    select 1 from public.cat_members m
    where m.cat_id = v_cat_id and m.user_id = v_uid
  ) then
    return v_cat_id;
  end if;

  if exists (select 1 from public.cats c where c.id = v_cat_id and c.owner_id = v_uid) then
    insert into public.cat_members (cat_id, user_id, role)
    values (v_cat_id, v_uid, 'owner')
    on conflict (cat_id, user_id) do nothing;
    return v_cat_id;
  end if;

  insert into public.cat_members (cat_id, user_id, role)
  values (v_cat_id, v_uid, 'member');

  update public.cat_invite_codes
  set use_count = use_count + 1
  where id = v_invite_id;

  select coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1))
  into v_actor
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_uid;

  insert into public.care_events (cat_id, actor, action, summary)
  values (
    v_cat_id,
    coalesce(v_actor, 'Member'),
    'member_joined',
    'joined shared care via invite'
  );

  return v_cat_id;
end;
$$;

revoke all on function public.accept_cat_invite(text) from public;
grant execute on function public.accept_cat_invite(text) to authenticated;

-- Co-members can read each other's display names for shared care roster.
drop policy if exists "profiles_select_cat_co_members" on public.profiles;
create policy "profiles_select_cat_co_members"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.cat_members m_me
      join public.cat_members m_other on m_other.cat_id = m_me.cat_id
      where m_me.user_id = auth.uid()
        and m_other.user_id = profiles.id
    )
  );
