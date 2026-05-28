-- Fix weight_records RLS for owner_id + cat_members schema (same as daily_records fix).
-- Drops phase1 household_members policies that block owners not in household_members.

drop policy if exists "weight_records_select" on public.weight_records;
drop policy if exists "weight_records_insert" on public.weight_records;
drop policy if exists "weight_records_update" on public.weight_records;
drop policy if exists "weight_records_delete" on public.weight_records;
drop policy if exists "weight_records_select_member" on public.weight_records;
drop policy if exists "weight_records_insert_member" on public.weight_records;
drop policy if exists "weight_records_update_member" on public.weight_records;
drop policy if exists "weight_records_delete_member" on public.weight_records;

create policy "weight_records_select" on public.weight_records for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

create policy "weight_records_insert" on public.weight_records for insert to authenticated
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

create policy "weight_records_update" on public.weight_records for update to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id))
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

create policy "weight_records_delete" on public.weight_records for delete to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

-- Backfill owner membership rows (is_cat_member) for cats created before trigger existed.
insert into public.cat_members (cat_id, user_id, role)
select c.id, c.owner_id, 'owner'
from public.cats c
where c.owner_id is not null
  and not exists (
    select 1
    from public.cat_members m
    where m.cat_id = c.id and m.user_id = c.owner_id
  )
on conflict (cat_id, user_id) do nothing;

grant select, insert, update, delete on public.weight_records to authenticated;
