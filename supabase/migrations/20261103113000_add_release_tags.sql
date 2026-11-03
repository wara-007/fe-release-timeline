alter table public.fe_managed_releases
  add column tags text[] not null default '{}'
  check (tags <@ array['web','app','be']::text[]);
