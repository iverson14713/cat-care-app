-- Align daily_records + care_events RLS with weight/monthly (is_cat_owner / is_cat_member).
-- Removes phase1 household policies and subquery policies that fail under owner_id cats schema.

-- daily_records: drop legacy + phase1 policy names
drop policy if exists "daily_records_select" on public.daily_records;
drop policy if exists "daily_records_insert" on public.daily_records;
drop policy if exists "daily_records_update" on public.daily_records;
drop policy if exists "daily_records_delete" on public.daily_records;
drop policy if exists "daily_records_select_member" on public.daily_records;
drop policy if exists "daily_records_insert_member" on public.daily_records;
drop policy if exists "daily_records_update_member" on public.daily_records;
drop policy if exists "daily_records_delete_member" on public.daily_records;

create policy "daily_records_select" on public.daily_records for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

create policy "daily_records_insert" on public.daily_records for insert to authenticated
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

create policy "daily_records_update" on public.daily_records for update to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id))
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

create policy "daily_records_delete" on public.daily_records for delete to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

-- care_events
drop policy if exists "care_events_select" on public.care_events;
drop policy if exists "care_events_insert" on public.care_events;
drop policy if exists "care_events_select_member" on public.care_events;
drop policy if exists "care_events_insert_member" on public.care_events;

create policy "care_events_select" on public.care_events for select to authenticated
  using (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

create policy "care_events_insert" on public.care_events for insert to authenticated
  with check (public.is_cat_owner(cat_id) or public.is_cat_member(cat_id));

grant select, insert, update, delete on public.daily_records to authenticated;
grant select, insert on public.care_events to authenticated;
