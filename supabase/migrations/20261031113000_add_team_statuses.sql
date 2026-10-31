alter table public.fe_release_statuses
  add column be_status text not null default 'unknown'
    check (be_status in ('unknown','not_started','in_progress','done','testing','passed','failed','blocked')),
  add column fe_status text not null default 'unknown'
    check (fe_status in ('unknown','not_started','in_progress','done','testing','passed','failed','blocked')),
  add column qa_status text not null default 'unknown'
    check (qa_status in ('unknown','not_started','in_progress','done','testing','passed','failed','blocked'));
