alter table public.fe_release_builds
  add column comment text not null default ''
  check (char_length(comment) <= 1000);

create table public.fe_release_build_history (
  id bigint generated always as identity primary key,
  record_id text not null check (char_length(record_id) between 1 and 300),
  image text not null check (char_length(image) between 1 and 500),
  comment text not null default '' check (char_length(comment) <= 1000),
  updated_at timestamptz not null
);

create index fe_release_build_history_record_updated_idx
  on public.fe_release_build_history (record_id, updated_at desc);

insert into public.fe_release_build_history (record_id, image, comment, updated_at)
select record_id, image, comment, updated_at
from public.fe_release_builds
where image <> '';

create function public.archive_fe_release_build()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.fe_release_build_history (record_id, image, comment, updated_at)
  values (new.record_id, new.image, new.comment, new.updated_at);
  return new;
end;
$$;

revoke all on function public.archive_fe_release_build() from public, anon, authenticated;

create trigger archive_fe_release_build_after_write
after insert or update of image, comment, updated_at on public.fe_release_builds
for each row execute function public.archive_fe_release_build();

alter table public.fe_release_build_history enable row level security;
revoke all on public.fe_release_build_history from anon, authenticated;
grant select, insert on public.fe_release_build_history to anon, authenticated;
grant usage, select on sequence public.fe_release_build_history_id_seq to anon, authenticated;

create policy "Read shared release build history"
on public.fe_release_build_history for select
to anon, authenticated
using (true);

create policy "Append shared release build history"
on public.fe_release_build_history for insert
to anon, authenticated
with check (true);

comment on table public.fe_release_build_history is 'Append-only history of website-owned image/build values and comments. Google Sheets remains read-only.';
