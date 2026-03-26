begin;

create extension if not exists pgcrypto;

alter table public.messages
  add column if not exists client_id uuid;

create unique index if not exists messages_client_id_unique
  on public.messages (client_id);

create table if not exists public.thread_memberships (
  thread_id bigint not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_delivered_message_id bigint references public.messages(id) on delete set null,
  last_read_message_id bigint references public.messages(id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (thread_id, user_id)
);

create index if not exists thread_memberships_user_id_idx
  on public.thread_memberships (user_id);

create or replace function public.thread_memberships_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_thread_memberships_updated_at on public.thread_memberships;

create trigger set_thread_memberships_updated_at
before update on public.thread_memberships
for each row
execute function public.thread_memberships_set_updated_at();

insert into public.thread_memberships (thread_id, user_id)
select distinct membership.thread_id, membership.user_id
from (
  select pm.thread_id::bigint, pm.member_a::uuid as user_id
  from public.peer_matches pm
  where pm.thread_id is not null

  union all

  select pm.thread_id::bigint, pm.member_b::uuid as user_id
  from public.peer_matches pm
  where pm.thread_id is not null

  union all

  select mr.thread_id::bigint, mr.mentee::uuid as user_id
  from public.mentor_requests mr
  where mr.thread_id is not null

  union all

  select mr.thread_id::bigint, mr.mentor::uuid as user_id
  from public.mentor_requests mr
  where mr.thread_id is not null
) membership
on conflict (thread_id, user_id) do nothing;

create or replace function public.ensure_thread_memberships(p_thread_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.peer_matches pm
    where pm.thread_id::bigint = p_thread_id
      and v_user_id in (pm.member_a::uuid, pm.member_b::uuid)
  )
  and not exists (
    select 1
    from public.mentor_requests mr
    where mr.thread_id::bigint = p_thread_id
      and v_user_id in (mr.mentee::uuid, mr.mentor::uuid)
  ) then
    raise exception 'Not authorized for thread %', p_thread_id;
  end if;

  insert into public.thread_memberships (thread_id, user_id)
  select distinct p_thread_id, participant.user_id
  from (
    select pm.member_a::uuid as user_id
    from public.peer_matches pm
    where pm.thread_id::bigint = p_thread_id

    union all

    select pm.member_b::uuid as user_id
    from public.peer_matches pm
    where pm.thread_id::bigint = p_thread_id

    union all

    select mr.mentee::uuid as user_id
    from public.mentor_requests mr
    where mr.thread_id::bigint = p_thread_id

    union all

    select mr.mentor::uuid as user_id
    from public.mentor_requests mr
    where mr.thread_id::bigint = p_thread_id
  ) participant
  on conflict (thread_id, user_id) do nothing;
end;
$$;

create or replace function public.is_thread_member(
  p_thread_id bigint,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.thread_memberships tm
    where tm.thread_id = p_thread_id
      and tm.user_id = p_user_id
  );
$$;

create or replace function public.advance_thread_membership_receipts(
  p_thread_id bigint,
  p_user_id uuid,
  p_delivered_message_id bigint default null,
  p_read_message_id bigint default null,
  p_seen_at timestamptz default timezone('utc', now())
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.thread_memberships (
    thread_id,
    user_id,
    last_delivered_message_id,
    last_read_message_id,
    last_seen_at
  )
  values (
    p_thread_id,
    p_user_id,
    p_delivered_message_id,
    p_read_message_id,
    p_seen_at
  )
  on conflict (thread_id, user_id)
  do update
  set
    last_delivered_message_id = case
      when excluded.last_delivered_message_id is null then public.thread_memberships.last_delivered_message_id
      when public.thread_memberships.last_delivered_message_id is null then excluded.last_delivered_message_id
      when public.thread_memberships.last_delivered_message_id < excluded.last_delivered_message_id then excluded.last_delivered_message_id
      else public.thread_memberships.last_delivered_message_id
    end,
    last_read_message_id = case
      when excluded.last_read_message_id is null then public.thread_memberships.last_read_message_id
      when public.thread_memberships.last_read_message_id is null then excluded.last_read_message_id
      when public.thread_memberships.last_read_message_id < excluded.last_read_message_id then excluded.last_read_message_id
      else public.thread_memberships.last_read_message_id
    end,
    last_seen_at = case
      when public.thread_memberships.last_seen_at is null then excluded.last_seen_at
      when excluded.last_seen_at is null then public.thread_memberships.last_seen_at
      when public.thread_memberships.last_seen_at < excluded.last_seen_at then excluded.last_seen_at
      else public.thread_memberships.last_seen_at
    end;
end;
$$;

create or replace function public.mark_thread_delivered(
  p_thread_id bigint,
  p_message_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_thread_memberships(p_thread_id);

  if not public.is_thread_member(p_thread_id, v_user_id) then
    raise exception 'Not authorized for thread %', p_thread_id;
  end if;

  if not exists (
    select 1
    from public.messages m
    where m.id = p_message_id
      and m.thread_id = p_thread_id
  ) then
    raise exception 'Message % is not in thread %', p_message_id, p_thread_id;
  end if;

  perform public.advance_thread_membership_receipts(
    p_thread_id,
    v_user_id,
    p_message_id,
    null,
    timezone('utc', now())
  );
end;
$$;

create or replace function public.mark_thread_read(
  p_thread_id bigint,
  p_message_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_thread_memberships(p_thread_id);

  if not public.is_thread_member(p_thread_id, v_user_id) then
    raise exception 'Not authorized for thread %', p_thread_id;
  end if;

  if not exists (
    select 1
    from public.messages m
    where m.id = p_message_id
      and m.thread_id = p_thread_id
  ) then
    raise exception 'Message % is not in thread %', p_message_id, p_thread_id;
  end if;

  perform public.advance_thread_membership_receipts(
    p_thread_id,
    v_user_id,
    p_message_id,
    p_message_id,
    timezone('utc', now())
  );
end;
$$;

create or replace function public.send_message(
  p_thread_id bigint,
  p_body text,
  p_reply_to_message_id bigint default null,
  p_client_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_message public.messages;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_body = '' then
    raise exception 'Message body cannot be empty';
  end if;

  perform public.ensure_thread_memberships(p_thread_id);

  if not public.is_thread_member(p_thread_id, v_user_id) then
    raise exception 'Not authorized for thread %', p_thread_id;
  end if;

  if p_reply_to_message_id is not null and not exists (
    select 1
    from public.messages m
    where m.id = p_reply_to_message_id
      and m.thread_id = p_thread_id
  ) then
    raise exception 'Reply target % is not in thread %', p_reply_to_message_id, p_thread_id;
  end if;

  insert into public.messages (
    thread_id,
    sender,
    body,
    reply_to_message_id,
    client_id
  )
  values (
    p_thread_id,
    v_user_id,
    v_body,
    p_reply_to_message_id,
    p_client_id
  )
  on conflict (client_id)
  do update
  set
    body = excluded.body,
    reply_to_message_id = excluded.reply_to_message_id
  where public.messages.thread_id = excluded.thread_id
    and public.messages.sender = excluded.sender
  returning * into v_message;

  perform public.advance_thread_membership_receipts(
    p_thread_id,
    v_user_id,
    v_message.id,
    v_message.id,
    timezone('utc', now())
  );

  return v_message;
end;
$$;

alter table public.thread_memberships enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    begin
      alter publication supabase_realtime add table public.thread_memberships;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end
$$;

drop policy if exists "thread_memberships_select" on public.thread_memberships;
create policy "thread_memberships_select"
on public.thread_memberships
for select
using (public.is_thread_member(thread_id));

drop policy if exists "thread_memberships_insert_self" on public.thread_memberships;
create policy "thread_memberships_insert_self"
on public.thread_memberships
for insert
with check (auth.uid() = user_id);

drop policy if exists "thread_memberships_update_self" on public.thread_memberships;
create policy "thread_memberships_update_self"
on public.thread_memberships
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant execute on function public.ensure_thread_memberships(bigint) to authenticated;
grant execute on function public.mark_thread_delivered(bigint, bigint) to authenticated;
grant execute on function public.mark_thread_read(bigint, bigint) to authenticated;
grant execute on function public.send_message(bigint, text, bigint, uuid) to authenticated;

commit;
