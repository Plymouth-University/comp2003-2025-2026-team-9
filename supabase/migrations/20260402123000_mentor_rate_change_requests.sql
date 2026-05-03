begin;

create table if not exists public.mentor_rate_change_requests (
  id bigserial primary key,
  mentor_id uuid not null references auth.users (id) on delete cascade,
  current_rate integer,
  requested_rate integer not null check (requested_rate > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mentor_rate_change_requested_gt_current_chk
    check (current_rate is null or requested_rate > current_rate)
);

create index if not exists mentor_rate_change_requests_mentor_idx
  on public.mentor_rate_change_requests (mentor_id, created_at desc);

create index if not exists mentor_rate_change_requests_status_idx
  on public.mentor_rate_change_requests (status, created_at desc);

create unique index if not exists mentor_rate_change_requests_one_pending_per_mentor_idx
  on public.mentor_rate_change_requests (mentor_id)
  where status = 'pending';

alter table public.mentor_rate_change_requests enable row level security;

drop policy if exists "mentor_rate_change_requests_select_own" on public.mentor_rate_change_requests;
create policy "mentor_rate_change_requests_select_own"
  on public.mentor_rate_change_requests
  for select
  to authenticated
  using (
    mentor_id = auth.uid()
    or public.is_admin_user()
  );

drop policy if exists "mentor_rate_change_requests_insert_own" on public.mentor_rate_change_requests;
create policy "mentor_rate_change_requests_insert_own"
  on public.mentor_rate_change_requests
  for insert
  to authenticated
  with check (
    mentor_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'mentor'
    )
    and status = 'pending'
  );

drop policy if exists "mentor_rate_change_requests_admin_update" on public.mentor_rate_change_requests;
create policy "mentor_rate_change_requests_admin_update"
  on public.mentor_rate_change_requests
  for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

commit;
