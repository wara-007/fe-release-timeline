create table public.fe_managed_features (
 id text primary key check(char_length(id) between 1 and 300),
 title text not null check(char_length(title) between 1 and 300),
 platform text not null default 'unknown' check(platform in ('web','app','shared','unknown')),
 owner text not null default '' check(char_length(owner)<=150),
 dev_start date, dev_end date, qa_start date, qa_end date,
 note text not null default '' check(char_length(note)<=2000),
 archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(dev_start is null or dev_end is null or dev_start<=dev_end),
 check(qa_start is null or qa_end is null or qa_start<=qa_end)
);
alter table public.fe_managed_release_members drop constraint fe_managed_release_members_source_type_check;
alter table public.fe_managed_release_members add constraint fe_managed_release_members_source_type_check check(source_type in ('sheet','custom','managed'));
alter table public.fe_managed_features enable row level security;
revoke all on public.fe_managed_features from anon,authenticated;
grant select,insert,update on public.fe_managed_features to anon,authenticated;
create policy "Read managed features" on public.fe_managed_features for select to anon,authenticated using(true);
create policy "Insert managed features" on public.fe_managed_features for insert to anon,authenticated with check(true);
create policy "Update managed features" on public.fe_managed_features for update to anon,authenticated using(true) with check(true);
