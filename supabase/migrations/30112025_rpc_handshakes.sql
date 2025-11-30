create or replace function public.create_match_on_mutual_handshake(other_user uuid)
returns peer_matches
language plpgsql
security definer
as $$
declare
  me uuid := auth.uid();
  existing_match peer_matches;
  new_match peer_matches;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Is there already a match?
  select * into existing_match
  from peer_matches
  where (member_a = me and member_b = other_user)
     or (member_a = other_user and member_b = me);

  if existing_match.id is not null then
    return existing_match;
  end if;

  -- 2. Check for mutual "like" swipes (comments optional)
  if exists (
    select 1 from peer_swipes
    where swiper = me and swiped = other_user and direction = 'like'
  )
  and exists (
    select 1 from peer_swipes
    where swiper = other_user and swiped = me and direction = 'like'
  )
  then
    -- deterministic ordering
    if me < other_user then
      insert into peer_matches (member_a, member_b)
      values (me, other_user)
      returning * into new_match;
    else
      insert into peer_matches (member_a, member_b)
      values (other_user, me)
      returning * into new_match;
    end if;

    return new_match;
  end if;

  -- no mutual like yet
  return null;
end;
$$;
