begin;

create table if not exists public.user_blocks (
  id bigserial primary key,
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker, blocked),
  check (blocker <> blocked)
);

insert into public.user_blocks (blocker, blocked, created_at)
select b.blocker_id, b.blocked_id, b.created_at
from public.blocked_users b
on conflict (blocker, blocked) do nothing;

create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker, created_at desc);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked, created_at desc);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_select_own_rows" on public.user_blocks;
create policy "user_blocks_select_own_rows"
  on public.user_blocks
  for select
  using (auth.uid() in (blocker, blocked));

drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own"
  on public.user_blocks
  for insert
  with check (auth.uid() = blocker);

drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own"
  on public.user_blocks
  for delete
  using (auth.uid() = blocker);

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

  if exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker = v_me and ub.blocked = other_user)
       or (ub.blocker = other_user and ub.blocked = v_me)
  ) then
    raise exception 'Users are blocked';
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

  insert into public.user_blocks (blocker, blocked)
  values (v_me, p_blocked_id)
  on conflict (blocker, blocked) do nothing;

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

  delete from public.user_blocks
  where blocker = v_me
    and blocked = p_blocked_id;

  delete from public.peer_swipes
  where (swiper = v_me and swiped = p_blocked_id)
     or (swiper = p_blocked_id and swiped = v_me);

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
        from public.user_blocks ub
        where (ub.blocker = me.uid and ub.blocked = p.id)
           or (ub.blocker = p.id and ub.blocked = me.uid)
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

create or replace function public.create_match_on_mutual_handshake(other_user uuid)
returns public.peer_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing_match public.peer_matches;
  new_match public.peer_matches;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker = me and ub.blocked = other_user)
       or (ub.blocker = other_user and ub.blocked = me)
  ) then
    return null;
  end if;

  select * into existing_match
  from public.peer_matches
  where (member_a = me and member_b = other_user)
     or (member_a = other_user and member_b = me);

  if existing_match.id is not null then
    return existing_match;
  end if;

  if exists (
    select 1 from public.peer_swipes
    where swiper = me and swiped = other_user and direction = 'like'
  )
  and exists (
    select 1 from public.peer_swipes
    where swiper = other_user and swiped = me and direction = 'like'
  ) then
    if me < other_user then
      insert into public.peer_matches (member_a, member_b)
      values (me, other_user)
      returning * into new_match;
    else
      insert into public.peer_matches (member_a, member_b)
      values (other_user, me)
      returning * into new_match;
    end if;

    return new_match;
  end if;

  return null;
end;
$$;

commit;
