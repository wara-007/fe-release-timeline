create table public.fe_managed_releases (
 id text primary key check(char_length(id) between 1 and 300),
 origin text not null check(origin in ('manual','sheet_override')),
 name text not null check(char_length(name) between 1 and 200), version text not null default '',
 release_date date, stream text not null default '', platform text not null default 'unknown' check(platform in ('web','app','shared','unknown')),
 description text not null default '' check(char_length(description)<=2000), archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.fe_managed_release_members (
 id uuid primary key default gen_random_uuid(), release_id text not null references public.fe_managed_releases(id) on delete cascade,
 source_type text not null check(source_type in ('sheet','custom')), feature_id text,
 title text not null default '', platform text not null default 'unknown' check(platform in ('web','app','shared','unknown')),
 owner text not null default '', dev_start date, dev_end date, qa_start date, qa_end date,
 note text not null default '' check(char_length(note)<=2000), sort_order integer not null default 0
);
create index fe_managed_release_members_release_idx on public.fe_managed_release_members(release_id,sort_order);
alter table public.fe_managed_releases enable row level security;alter table public.fe_managed_release_members enable row level security;
revoke all on public.fe_managed_releases,public.fe_managed_release_members from anon,authenticated;
grant select,insert,update on public.fe_managed_releases to anon,authenticated;
grant select,insert,update,delete on public.fe_managed_release_members to anon,authenticated;
create policy "Read managed releases" on public.fe_managed_releases for select to anon,authenticated using(true);
create policy "Insert managed releases" on public.fe_managed_releases for insert to anon,authenticated with check(true);
create policy "Update managed releases" on public.fe_managed_releases for update to anon,authenticated using(true) with check(true);
create policy "Read managed release members" on public.fe_managed_release_members for select to anon,authenticated using(true);
create policy "Insert managed release members" on public.fe_managed_release_members for insert to anon,authenticated with check(true);
create policy "Update managed release members" on public.fe_managed_release_members for update to anon,authenticated using(true) with check(true);
create policy "Delete managed release members" on public.fe_managed_release_members for delete to anon,authenticated using(true);
