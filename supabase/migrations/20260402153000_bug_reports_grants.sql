begin;

grant select, insert, update on table public.bug_reports to authenticated;

commit;
