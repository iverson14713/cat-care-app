-- Pet type on cats: cat | dog (existing rows default to cat).

alter table public.cats
  add column if not exists pet_type text not null default 'cat'
  check (pet_type in ('cat', 'dog'));

comment on column public.cats.pet_type is 'Pet species for daily care labels: cat or dog.';
