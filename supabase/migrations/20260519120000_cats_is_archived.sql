-- Soft-delete cats: archive instead of hard delete (history, photos, AI data kept).

alter table public.cats
  add column if not exists is_archived boolean not null default false;

create index if not exists cats_owner_archived_idx on public.cats (owner_id, is_archived);

comment on column public.cats.is_archived is 'When true, cat is hidden from main UI; records remain in cloud.';
