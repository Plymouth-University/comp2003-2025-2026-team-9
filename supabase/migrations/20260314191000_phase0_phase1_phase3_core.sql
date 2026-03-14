begin;

alter table public.profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists looking_for text,
  add column if not exists tokens_balance integer not null default 0;

alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.peer_matches
  add column if not exists thread_id bigint references public.threads (id) on delete set null;

create table if not exists public.blocked_users (
  id bigserial primary key,
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_idx
  on public.blocked_users (blocker_id, created_at desc);

create index if not exists blocked_users_blocked_idx
  on public.blocked_users (blocked_id, created_at desc);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_select_own_rows" on public.blocked_users;
create policy "blocked_users_select_own_rows"
  on public.blocked_users
  for select
  using (auth.uid() in (blocker_id, blocked_id));

drop policy if exists "blocked_users_insert_own" on public.blocked_users;
create policy "blocked_users_insert_own"
  on public.blocked_users
  for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "blocked_users_delete_own" on public.blocked_users;
create policy "blocked_users_delete_own"
  on public.blocked_users
  for delete
  using (auth.uid() = blocker_id);

create or replace function public.ensure_peer_thread(other_user uuid)
returns public.threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_match public.peer_matches;
  v_thread public.threads;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if other_user is null then
    raise exception 'other_user is required';
  end if;

  select *
    into v_match
  from public.peer_matches
  where (member_a = v_me and member_b = other_user)
     or (member_a = other_user and member_b = v_me)
  order by id desc
  limit 1;

  if v_match.id is null then
    raise exception 'No peer match exists between users';
  end if;

  if v_match.thread_id is not null then
    select *
      into v_thread
    from public.threads
    where id = v_match.thread_id
    limit 1;

    if v_thread.id is not null then
      return v_thread;
    end if;
  end if;

  insert into public.threads (type)
  values ('peer')
  returning * into v_thread;

  update public.peer_matches
  set thread_id = v_thread.id
  where id = v_match.id;

  return v_thread;
end;
$$;

create or replace function public.undo_last_pass_swipe(p_swiped_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_deleted_id bigint;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_swiped_id is null then
    raise exception 'p_swiped_id is required';
  end if;

  with target as (
    select id
    from public.peer_swipes
    where swiper = v_me
      and swiped = p_swiped_id
      and direction = 'pass'
    order by created_at desc, id desc
    limit 1
  )
  delete from public.peer_swipes ps
  using target
  where ps.id = target.id
  returning ps.id into v_deleted_id;

  return v_deleted_id is not null;
end;
$$;

create or replace function public.block_user(p_blocked_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_blocked_id is null then
    raise exception 'p_blocked_id is required';
  end if;

  if p_blocked_id = v_me then
    raise exception 'Cannot block yourself';
  end if;

  insert into public.blocked_users (blocker_id, blocked_id)
  values (v_me, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.peer_swipes
  where (swiper = v_me and swiped = p_blocked_id)
     or (swiper = p_blocked_id and swiped = v_me);

  delete from public.peer_matches
  where (member_a = v_me and member_b = p_blocked_id)
     or (member_a = p_blocked_id and member_b = v_me);

  return jsonb_build_object('ok', true, 'blocked_id', p_blocked_id);
end;
$$;

create or replace function public.unblock_user(p_blocked_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_blocked_id is null then
    raise exception 'p_blocked_id is required';
  end if;

  delete from public.blocked_users
  where blocker_id = v_me
    and blocked_id = p_blocked_id;

  return jsonb_build_object('ok', true, 'unblocked_id', p_blocked_id);
end;
$$;

create or replace function public.discover_profiles(
  p_max_distance_miles integer default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  full_name text,
  title text,
  industry text,
  bio text,
  photo_url text,
  role text,
  location text,
  skills text[],
  interests text[],
  looking_for text,
  distance_miles double precision
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select
      auth.uid() as uid,
      p.latitude as my_lat,
      p.longitude as my_lng
    from public.profiles p
    where p.id = auth.uid()
    limit 1
  ),
  candidates as (
    select
      p.id,
      p.full_name,
      p.title,
      p.industry,
      p.bio,
      p.photo_url,
      p.role,
      p.location,
      p.skills,
      p.interests,
      p.looking_for,
      case
        when me.my_lat is null or me.my_lng is null or p.latitude is null or p.longitude is null then null
        else (
          3958.8 * acos(
            least(
              1.0,
              greatest(
                -1.0,
                cos(radians(me.my_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(me.my_lng)) +
                sin(radians(me.my_lat)) * sin(radians(p.latitude))
              )
            )
          )
        )
      end as distance_miles
    from public.profiles p
    cross join me
    where me.uid is not null
      and p.id <> me.uid
      and p.role = 'member'
      and coalesce(p.approval_status, 'approved') = 'approved'
      and not exists (
        select 1
        from public.peer_swipes s
        where s.swiper = me.uid
          and s.swiped = p.id
      )
      and not exists (
        select 1
        from public.peer_matches m
        where (m.member_a = me.uid and m.member_b = p.id)
           or (m.member_a = p.id and m.member_b = me.uid)
      )
      and not exists (
        select 1
        from public.blocked_users b
        where (b.blocker_id = me.uid and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = me.uid)
      )
  )
  select
    c.id,
    c.full_name,
    c.title,
    c.industry,
    c.bio,
    c.photo_url,
    c.role,
    c.location,
    c.skills,
    c.interests,
    c.looking_for,
    c.distance_miles
  from candidates c
  where p_max_distance_miles is null
     or (c.distance_miles is not null and c.distance_miles <= p_max_distance_miles::double precision)
  order by c.distance_miles nulls last, c.id
  limit greatest(coalesce(p_limit, 1), 1);
$$;

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users
  where id = v_me;

  return jsonb_build_object('ok', true, 'deleted_user_id', v_me);
end;
$$;

revoke all on function public.ensure_peer_thread(uuid) from public;
revoke all on function public.undo_last_pass_swipe(uuid) from public;
revoke all on function public.block_user(uuid) from public;
revoke all on function public.unblock_user(uuid) from public;
revoke all on function public.discover_profiles(integer, integer) from public;
revoke all on function public.delete_my_account() from public;

grant execute on function public.ensure_peer_thread(uuid) to authenticated;
grant execute on function public.undo_last_pass_swipe(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.discover_profiles(integer, integer) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

commit;
