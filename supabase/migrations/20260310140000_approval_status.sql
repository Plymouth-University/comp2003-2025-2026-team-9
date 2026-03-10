begin;

-- Add approval_status column to profiles
alter table public.profiles
  add column if not exists approval_status text
    not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected'));

-- Backfill all existing profiles as approved so current users are not locked out
update public.profiles
  set approval_status = 'approved'
  where approval_status = 'pending';

-- Index for quick admin lookups of pending users
create index if not exists profiles_approval_status_idx
  on public.profiles (approval_status)
  where approval_status = 'pending';

-- Allow admins to update any profile (for approval_status changes)
drop policy if exists "admins_update_any_profile" on public.profiles;
create policy "admins_update_any_profile"
  on public.profiles
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Allow admins to update applications (approve/reject)
drop policy if exists "admins_update_applications" on public.applications;
create policy "admins_update_applications"
  on public.applications
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Allow admins to read all applications
drop policy if exists "admins_read_applications" on public.applications;
create policy "admins_read_applications"
  on public.applications
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Allow admins to delete profiles
drop policy if exists "admins_delete_any_profile" on public.profiles;
create policy "admins_delete_any_profile"
  on public.profiles
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Trigger: notify all admins when a new pending user signs up
create or replace function public.enqueue_new_signup_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_row record;
  new_user_name text;
begin
  -- Only fire for new pending profiles
  if new.approval_status is distinct from 'pending' then
    return new;
  end if;

  new_user_name := coalesce(new.full_name, 'A new user');

  for admin_row in
    select id from public.profiles where role = 'admin'
  loop
    insert into public.notification_events (
      event_type,
      recipient_user_id,
      actor_user_id,
      title,
      body,
      payload,
      source_table,
      source_pk
    ) values (
      'new_signup_pending',
      admin_row.id,
      new.id,
      'New sign-up request',
      new_user_name || ' is waiting for approval.',
      jsonb_build_object(
        'user_id', new.id,
        'user_name', new_user_name,
        'requested_role', coalesce(new.role, 'member')
      ),
      'profiles',
      new.id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_profiles_notify_admins_new_signup on public.profiles;
create trigger trg_profiles_notify_admins_new_signup
after insert on public.profiles
for each row
execute function public.enqueue_new_signup_admin_notification();

commit;
