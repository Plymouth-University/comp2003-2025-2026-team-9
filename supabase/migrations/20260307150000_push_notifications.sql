begin;

create table if not exists public.expo_push_tokens (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now()
);

alter table public.expo_push_tokens
  add column if not exists device_id text,
  add column if not exists platform text,
  add column if not exists app_id text,
  add column if not exists last_seen_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expo_push_tokens_user_id_token_key'
  ) then
    alter table public.expo_push_tokens
      add constraint expo_push_tokens_user_id_token_key unique (user_id, token);
  end if;
end $$;

create index if not exists expo_push_tokens_user_id_idx
  on public.expo_push_tokens (user_id);

alter table public.expo_push_tokens enable row level security;

drop policy if exists "Users can read their own push tokens" on public.expo_push_tokens;
create policy "Users can read their own push tokens"
  on public.expo_push_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own push tokens" on public.expo_push_tokens;
create policy "Users can insert their own push tokens"
  on public.expo_push_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own push tokens" on public.expo_push_tokens;
create policy "Users can update their own push tokens"
  on public.expo_push_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own push tokens" on public.expo_push_tokens;
create policy "Users can delete their own push tokens"
  on public.expo_push_tokens
  for delete
  using (auth.uid() = user_id);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default true,
  notify_new_message boolean not null default true,
  notify_incoming_like boolean not null default true,
  notify_mutual_connection boolean not null default true,
  notify_mentor_request_updates boolean not null default true,
  notify_session_reminder_1h boolean not null default true,
  notify_session_reminder_15m boolean not null default true,
  notify_session_starting_now boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences
  add column if not exists push_enabled boolean not null default true,
  add column if not exists notify_new_message boolean not null default true,
  add column if not exists notify_incoming_like boolean not null default true,
  add column if not exists notify_mutual_connection boolean not null default true,
  add column if not exists notify_mentor_request_updates boolean not null default true,
  add column if not exists notify_session_reminder_1h boolean not null default true,
  add column if not exists notify_session_reminder_15m boolean not null default true,
  add column if not exists notify_session_starting_now boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can read their own notification preferences" on public.notification_preferences;
create policy "Users can read their own notification preferences"
  on public.notification_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own notification preferences" on public.notification_preferences;
create policy "Users can insert their own notification preferences"
  on public.notification_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notification preferences" on public.notification_preferences;
create policy "Users can update their own notification preferences"
  on public.notification_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_events (
  id bigserial primary key,
  event_type text not null,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  title text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  source_table text,
  source_pk text,
  dedupe_key text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.notification_events
  add column if not exists dedupe_key text,
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists scheduled_for timestamptz not null default now(),
  add column if not exists sent_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists notification_events_status_scheduled_idx
  on public.notification_events (status, scheduled_for);

create index if not exists notification_events_recipient_idx
  on public.notification_events (recipient_user_id, created_at desc);

create unique index if not exists notification_events_dedupe_key_uq
  on public.notification_events (dedupe_key)
  where dedupe_key is not null;

create table if not exists public.notification_deliveries (
  id bigserial primary key,
  event_id bigint not null references public.notification_events (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  status text not null check (status in ('ok', 'error')),
  expo_ticket_id text,
  error text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_event_id_idx
  on public.notification_deliveries (event_id);

create or replace function public.set_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_preferences_set_updated_at
  on public.notification_preferences;
create trigger trg_notification_preferences_set_updated_at
before update on public.notification_preferences
for each row
execute function public.set_notification_preferences_updated_at();

create or replace function public.enqueue_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  actor_name text;
  recipient_role text;
  peer_row record;
  mentor_row record;
begin
  select p.full_name into actor_name
  from public.profiles p
  where p.id = new.sender;

  select pm.member_a, pm.member_b
    into peer_row
  from public.peer_matches pm
  where pm.thread_id = new.thread_id
  order by pm.created_at desc nulls last
  limit 1;

  if peer_row.member_a is not null then
    recipient_id := case
      when peer_row.member_a = new.sender then peer_row.member_b
      else peer_row.member_a
    end;
  else
    select mr.mentor, mr.mentee
      into mentor_row
    from public.mentor_requests mr
    where mr.thread_id = new.thread_id
    order by mr.id desc
    limit 1;

    if mentor_row.mentor is not null then
      recipient_id := case
        when mentor_row.mentor = new.sender then mentor_row.mentee
        else mentor_row.mentor
      end;
    end if;
  end if;

  if recipient_id is null or recipient_id = new.sender then
    return new;
  end if;

  select p.role into recipient_role
  from public.profiles p
  where p.id = recipient_id;

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
    'new_message',
    recipient_id,
    new.sender,
    'New message 💬',
    coalesce(actor_name, 'Someone') || ' sent you a message.',
    jsonb_build_object(
      'thread_id', new.thread_id,
      'other_user_id', new.sender,
      'other_name', coalesce(actor_name, 'Someone'),
      'message_preview', left(coalesce(new.body, ''), 120),
      'recipient_role', coalesce(recipient_role, 'member')
    ),
    'messages',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_messages_enqueue_notification on public.messages;
create trigger trg_messages_enqueue_notification
after insert on public.messages
for each row
execute function public.enqueue_message_notification();

create or replace function public.enqueue_incoming_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  recipient_role text;
begin
  if new.direction is distinct from 'like' then
    return new;
  end if;

  select p.full_name into actor_name
  from public.profiles p
  where p.id = new.swiper;

  select p.role into recipient_role
  from public.profiles p
  where p.id = new.swiped;

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
    'incoming_like',
    new.swiped,
    new.swiper,
    'New connection request 👋',
    coalesce(actor_name, 'Someone') || ' wants to connect with you.',
    jsonb_build_object(
      'other_user_id', new.swiper,
      'other_name', coalesce(actor_name, 'Someone'),
      'recipient_role', coalesce(recipient_role, 'member')
    ),
    'peer_swipes',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_peer_swipes_enqueue_notification on public.peer_swipes;
create trigger trg_peer_swipes_enqueue_notification
after insert on public.peer_swipes
for each row
execute function public.enqueue_incoming_like_notification();

create or replace function public.enqueue_mutual_connection_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  name_a text;
  name_b text;
  role_a text;
  role_b text;
begin
  select full_name, role
    into name_a, role_a
  from public.profiles
  where id = new.member_a;

  select full_name, role
    into name_b, role_b
  from public.profiles
  where id = new.member_b;

  insert into public.notification_events (
    event_type,
    recipient_user_id,
    actor_user_id,
    title,
    body,
    payload,
    source_table,
    source_pk
  ) values
  (
    'mutual_connection',
    new.member_a,
    new.member_b,
    'You made a new connection 🎉',
    'You and ' || coalesce(name_b, 'a member') || ' are now connected.',
    jsonb_build_object(
      'thread_id', new.thread_id,
      'other_user_id', new.member_b,
      'other_name', coalesce(name_b, 'Member'),
      'recipient_role', coalesce(role_a, 'member')
    ),
    'peer_matches',
    new.id::text
  ),
  (
    'mutual_connection',
    new.member_b,
    new.member_a,
    'You made a new connection 🎉',
    'You and ' || coalesce(name_a, 'a member') || ' are now connected.',
    jsonb_build_object(
      'thread_id', new.thread_id,
      'other_user_id', new.member_a,
      'other_name', coalesce(name_a, 'Member'),
      'recipient_role', coalesce(role_b, 'member')
    ),
    'peer_matches',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_peer_matches_enqueue_notification on public.peer_matches;
create trigger trg_peer_matches_enqueue_notification
after insert on public.peer_matches
for each row
execute function public.enqueue_mutual_connection_notification();

create or replace function public.enqueue_mentor_request_created_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  if new.status is distinct from 'requested' then
    return new;
  end if;

  select full_name into actor_name
  from public.profiles
  where id = new.mentee;

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
    'mentor_request_new',
    new.mentor,
    new.mentee,
    'New mentor session request 📅',
    coalesce(actor_name, 'A mentee') || ' requested a new session.',
    jsonb_build_object(
      'request_id', new.id,
      'thread_id', new.thread_id,
      'other_user_id', new.mentee,
      'other_name', coalesce(actor_name, 'Mentee'),
      'scheduled_start', new.scheduled_start,
      'recipient_role', 'mentor'
    ),
    'mentor_requests',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_mentor_requests_enqueue_create_notification on public.mentor_requests;
create trigger trg_mentor_requests_enqueue_create_notification
after insert on public.mentor_requests
for each row
execute function public.enqueue_mentor_request_created_notification();

create or replace function public.enqueue_mentor_request_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select full_name into actor_name
  from public.profiles
  where id = new.mentor;

  if old.status = 'requested' and new.status = 'scheduled' then
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
      'mentor_request_scheduled',
      new.mentee,
      new.mentor,
      'Session confirmed ✅',
      coalesce(actor_name, 'Your mentor') || ' accepted your session request.',
      jsonb_build_object(
        'request_id', new.id,
        'thread_id', new.thread_id,
        'other_user_id', new.mentor,
        'other_name', coalesce(actor_name, 'Mentor'),
        'scheduled_start', new.scheduled_start,
        'video_link', new.video_link,
        'recipient_role', 'member'
      ),
      'mentor_requests',
      new.id::text
    );
  elsif old.status = 'requested' and new.status = 'cancelled' then
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
      'mentor_request_declined',
      new.mentee,
      new.mentor,
      'Session request update',
      coalesce(actor_name, 'Your mentor') || ' declined your request.',
      jsonb_build_object(
        'request_id', new.id,
        'thread_id', new.thread_id,
        'other_user_id', new.mentor,
        'other_name', coalesce(actor_name, 'Mentor'),
        'scheduled_start', new.scheduled_start,
        'recipient_role', 'member'
      ),
      'mentor_requests',
      new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mentor_requests_enqueue_status_notification on public.mentor_requests;
create trigger trg_mentor_requests_enqueue_status_notification
after update of status on public.mentor_requests
for each row
execute function public.enqueue_mentor_request_status_notification();

create or replace function public.enqueue_session_reminder_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_1h integer := 0;
  inserted_15m integer := 0;
  inserted_now integer := 0;
begin
  with due as (
    select
      mr.id,
      mr.mentor,
      mr.mentee,
      mr.thread_id,
      mr.scheduled_start,
      mr.video_link
    from public.mentor_requests mr
    where mr.status = 'scheduled'
      and mr.scheduled_start > now() + interval '59 minutes'
      and mr.scheduled_start <= now() + interval '60 minutes'
  ),
  inserted as (
    insert into public.notification_events (
      event_type,
      recipient_user_id,
      actor_user_id,
      title,
      body,
      payload,
      source_table,
      source_pk,
      dedupe_key
    )
    select
      'session_reminder_1h',
      due.mentor,
      due.mentee,
      'Session in 1 hour ⏰',
      'Your mentorship session starts in about 1 hour.',
      jsonb_build_object(
        'request_id', due.id,
        'thread_id', due.thread_id,
        'other_user_id', due.mentee,
        'scheduled_start', due.scheduled_start,
        'video_link', due.video_link,
        'recipient_role', 'mentor'
      ),
      'mentor_requests',
      due.id::text,
      format('session:%s:1h:mentor', due.id)
    from due
    union all
    select
      'session_reminder_1h',
      due.mentee,
      due.mentor,
      'Session in 1 hour ⏰',
      'Your mentorship session starts in about 1 hour.',
      jsonb_build_object(
        'request_id', due.id,
        'thread_id', due.thread_id,
        'other_user_id', due.mentor,
        'scheduled_start', due.scheduled_start,
        'video_link', due.video_link,
        'recipient_role', 'member'
      ),
      'mentor_requests',
      due.id::text,
      format('session:%s:1h:mentee', due.id)
    from due
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into inserted_1h from inserted;

  with due as (
    select
      mr.id,
      mr.mentor,
      mr.mentee,
      mr.thread_id,
      mr.scheduled_start,
      mr.video_link
    from public.mentor_requests mr
    where mr.status = 'scheduled'
      and mr.scheduled_start > now() + interval '14 minutes'
      and mr.scheduled_start <= now() + interval '15 minutes'
  ),
  inserted as (
    insert into public.notification_events (
      event_type,
      recipient_user_id,
      actor_user_id,
      title,
      body,
      payload,
      source_table,
      source_pk,
      dedupe_key
    )
    select
      'session_reminder_15m',
      due.mentor,
      due.mentee,
      'Session in 15 minutes 🔔',
      'Quick heads up — your mentorship session starts in 15 minutes.',
      jsonb_build_object(
        'request_id', due.id,
        'thread_id', due.thread_id,
        'other_user_id', due.mentee,
        'scheduled_start', due.scheduled_start,
        'video_link', due.video_link,
        'recipient_role', 'mentor'
      ),
      'mentor_requests',
      due.id::text,
      format('session:%s:15m:mentor', due.id)
    from due
    union all
    select
      'session_reminder_15m',
      due.mentee,
      due.mentor,
      'Session in 15 minutes 🔔',
      'Quick heads up — your mentorship session starts in 15 minutes.',
      jsonb_build_object(
        'request_id', due.id,
        'thread_id', due.thread_id,
        'other_user_id', due.mentor,
        'scheduled_start', due.scheduled_start,
        'video_link', due.video_link,
        'recipient_role', 'member'
      ),
      'mentor_requests',
      due.id::text,
      format('session:%s:15m:mentee', due.id)
    from due
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into inserted_15m from inserted;

  with due as (
    select
      mr.id,
      mr.mentor,
      mr.mentee,
      mr.thread_id,
      mr.scheduled_start,
      mr.video_link
    from public.mentor_requests mr
    where mr.status = 'scheduled'
      and mr.scheduled_start > now() - interval '1 minute'
      and mr.scheduled_start <= now() + interval '1 minute'
  ),
  inserted as (
    insert into public.notification_events (
      event_type,
      recipient_user_id,
      actor_user_id,
      title,
      body,
      payload,
      source_table,
      source_pk,
      dedupe_key
    )
    select
      'session_starting_now',
      due.mentor,
      due.mentee,
      'Session starting now 🎥',
      'Your mentorship session is starting now.',
      jsonb_build_object(
        'request_id', due.id,
        'thread_id', due.thread_id,
        'other_user_id', due.mentee,
        'scheduled_start', due.scheduled_start,
        'video_link', due.video_link,
        'recipient_role', 'mentor'
      ),
      'mentor_requests',
      due.id::text,
      format('session:%s:now:mentor', due.id)
    from due
    union all
    select
      'session_starting_now',
      due.mentee,
      due.mentor,
      'Session starting now 🎥',
      'Your mentorship session is starting now.',
      jsonb_build_object(
        'request_id', due.id,
        'thread_id', due.thread_id,
        'other_user_id', due.mentor,
        'scheduled_start', due.scheduled_start,
        'video_link', due.video_link,
        'recipient_role', 'member'
      ),
      'mentor_requests',
      due.id::text,
      format('session:%s:now:mentee', due.id)
    from due
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into inserted_now from inserted;

  return inserted_1h + inserted_15m + inserted_now;
end;
$$;
create or replace function public.invoke_push_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  supabase_url text := current_setting('app.settings.supabase_url', true);
begin
  if supabase_url is null or supabase_url = '' then
    return;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'net') then
    perform net.http_post(
      url := supabase_url || '/functions/v1/push-dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('limit', 100)
    );
  end if;
end;
$$;

do $$
declare
  job record;
begin
  begin
    execute 'create extension if not exists pg_cron';
  exception
    when others then
      raise notice 'pg_cron extension unavailable; skipping job creation (%).', sqlerrm;
  end;

  begin
    execute 'create extension if not exists pg_net';
  exception
    when others then
      raise notice 'pg_net extension unavailable; net-triggered dispatch may need manual scheduling (%).', sqlerrm;
  end;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      for job in
        select c.jobid
        from cron.job c
        where c.jobname = 'enqueue-session-reminders'
      loop
        perform cron.unschedule(job.jobid);
      end loop;

      perform cron.schedule(
        'enqueue-session-reminders',
        '* * * * *',
        'select public.enqueue_session_reminder_events();'
      );

      for job in
        select c.jobid
        from cron.job c
        where c.jobname = 'dispatch-push-events'
      loop
        perform cron.unschedule(job.jobid);
      end loop;

      perform cron.schedule(
        'dispatch-push-events',
        '* * * * *',
        'select public.invoke_push_dispatch();'
      );
    exception
      when others then
      raise notice 'Failed to schedule notification cron jobs (%).', sqlerrm;
    end;
  end if;
end
$$;

commit;
