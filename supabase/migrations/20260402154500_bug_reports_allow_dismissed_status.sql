begin;

alter table public.bug_reports
  drop constraint if exists bug_reports_status_check;

alter table public.bug_reports
  add constraint bug_reports_status_check
  check (status in ('new', 'dismissed'));

commit;
