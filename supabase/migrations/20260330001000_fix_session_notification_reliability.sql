begin;

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

  if new.status = 'scheduled' then
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
      new.id::text,
      format('mentor-request:%s:scheduled', new.id)
    )
    on conflict (dedupe_key) do nothing;
  elsif new.status = 'cancelled' and old.status in ('requested', 'proposed') then
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
      new.id::text,
      format('mentor-request:%s:declined', new.id)
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

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
      and mr.scheduled_start > now() + interval '55 minutes'
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
      and mr.scheduled_start > now() + interval '10 minutes'
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
      and mr.scheduled_start > now() - interval '2 minutes'
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

commit;
