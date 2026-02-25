-- Calendar events: mentor availability blocks + booked sessions
-- Used by the mentor calendar UI and mentee booking UI.

create extension if not exists "pgcrypto";
create extension if not exists btree_gist;

create table if not exists public.calendar (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references auth.users on delete cascade,
  mentee_id uuid references auth.users on delete set null,
  type text not null check (type in ('block','session')),
  title text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint calendar_time_order check (end_at > start_at)
);

-- Prevent overlapping events for the same mentor.
-- This protects against double-booking and booking into blocked time.
alter table public.calendar
  add constraint calendar_no_overlap
  exclude using gist (
    mentor_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  );

alter table public.calendar enable row level security;

-- Read: mentors see their calendar; mentees see their own sessions.
create policy "calendar_select_participants"
  on public.calendar
  for select
  using (auth.uid() = mentor_id or auth.uid() = mentee_id);

-- Mentors manage their own blocks.
create policy "calendar_insert_mentor_blocks"
  on public.calendar
  for insert
  with check (
    auth.uid() = mentor_id
    and type = 'block'
    and mentee_id is null
  );

create policy "calendar_update_mentor_blocks"
  on public.calendar
  for update
  using (auth.uid() = mentor_id and type = 'block');

create policy "calendar_delete_mentor_blocks"
  on public.calendar
  for delete
  using (auth.uid() = mentor_id and type = 'block');

-- Mentees can insert sessions for themselves (booking flow).
create policy "calendar_insert_mentee_sessions"
  on public.calendar
  for insert
  with check (
    auth.uid() = mentee_id
    and type = 'session'
  );
