create table public.fe_release_statuses (
  release_id text primary key check (char_length(release_id) between 1 and 300),
  status text not null check (status in ('unknown', 'planned', 'merging', 'testing', 'done', 'deployed')),
  updated_at timestamptz not null default now()
);

alter table public.fe_release_statuses enable row level security;
revoke all on public.fe_release_statuses from anon, authenticated;
grant select, insert, update on public.fe_release_statuses to anon, authenticated;

create policy "Read shared release statuses"
on public.fe_release_statuses for select
to anon, authenticated
using (true);

create policy "Insert shared release statuses"
on public.fe_release_statuses for insert
to anon, authenticated
with check (true);

create policy "Update shared release statuses"
on public.fe_release_statuses for update
to anon, authenticated
using (true)
with check (true);

comment on table public.fe_release_statuses is 'Website-owned release status overrides. Google Sheets remains read-only.';
