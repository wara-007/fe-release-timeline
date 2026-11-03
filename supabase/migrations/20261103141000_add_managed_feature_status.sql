alter table public.fe_managed_features
 add column status text not null default 'unknown'
 check(status in ('unknown','planned','merging','testing','done','deployed'));
