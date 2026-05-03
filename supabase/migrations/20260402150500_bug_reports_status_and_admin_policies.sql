begin;

alter table public.bug_reports
  add column if not exists status text;

update public.bug_reports
set status = 'new'
where status is null;

alter table public.bug_reports
  alter column status set default 'new';

alter table public.bug_reports
  alter column status set not null;

create index if not exists bug_reports_status_created_at_idx
  on public.bug_reports (status, created_at desc);

alter table public.bug_reports enable row level security;

drop policy if exists "authenticated users can insert bug reports" on public.bug_reports;
create policy "authenticated users can insert bug reports"
  on public.bug_reports
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "admins can read bug reports" on public.bug_reports;
create policy "admins can read bug reports"
  on public.bug_reports
  for select
  to authenticated
  using (public.is_admin_user());

drop policy if exists "admins can update bug reports" on public.bug_reports;
create policy "admins can update bug reports"
  on public.bug_reports
  for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

commit;
