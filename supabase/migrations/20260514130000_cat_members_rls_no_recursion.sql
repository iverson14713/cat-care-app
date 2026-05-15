-- Fix infinite RLS recursion on cat_members (policies must not SELECT cat_members from cat_members).
-- Also avoid cats <-> cat_members mutual recursion: cats SELECT uses security definer helper for membership.

-- ---------------------------------------------------------------------------
-- Helpers: SECURITY DEFINER + stable search_path so RLS is not re-applied in a loop.
-- ---------------------------------------------------------------------------

create or replace function public.is_cat_owner(p_cat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cats c
    where c.id = p_cat_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function public.is_cat_member(p_cat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cat_members m
    where m.cat_id = p_cat_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_cat_owner(uuid) from public;
grant execute on function public.is_cat_owner(uuid) to authenticated;

revoke all on function public.is_cat_member(uuid) from public;
grant execute on function public.is_cat_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cats: replace SELECT policy so it never subqueries cat_members directly.
-- ---------------------------------------------------------------------------

drop policy if exists "cats_select_visible" on public.cats;
create policy "cats_select_visible"
  on public.cats
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    or public.is_cat_member(id)
  );

-- ---------------------------------------------------------------------------
-- cat_members: SELECT / INSERT / DELETE — no self-reference on cat_members.
-- ---------------------------------------------------------------------------

drop policy if exists "cat_members_select_visible" on public.cat_members;
create policy "cat_members_select_visible"
  on public.cat_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_cat_owner(cat_id)
  );

drop policy if exists "cat_members_insert_by_owner" on public.cat_members;
create policy "cat_members_insert_by_owner"
  on public.cat_members
  for insert
  to authenticated
  with check (
    public.is_cat_owner(cat_id)
    and role = 'member'
  );

drop policy if exists "cat_members_delete_by_owner_or_self" on public.cat_members;
drop policy if exists "cat_members_delete_by_owner" on public.cat_members;
create policy "cat_members_delete_by_owner"
  on public.cat_members
  for delete
  to authenticated
  using (
    public.is_cat_owner(cat_id)
    and role <> 'owner'
  );
