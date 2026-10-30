create table public.fe_release_builds (
  record_id text primary key check (char_length(record_id) between 1 and 300),
  image text not null check (char_length(image) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.fe_release_builds enable row level security;
revoke all on public.fe_release_builds from anon, authenticated;
grant select, insert, update on public.fe_release_builds to anon, authenticated;
create policy "Read shared release builds" on public.fe_release_builds for select to anon, authenticated using (true);
create policy "Insert shared release builds" on public.fe_release_builds for insert to anon, authenticated with check (true);
create policy "Update shared release builds" on public.fe_release_builds for update to anon, authenticated using (true) with check (true);
comment on table public.fe_release_builds is 'Shared image/build metadata for the no-login FE timeline. Google Sheets is read-only; no spreadsheet content is stored here.';