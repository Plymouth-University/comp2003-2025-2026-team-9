-- Fix: delete_my_account failed with FK violation on peer_swipes (and other
-- tables that reference auth.users without ON DELETE CASCADE).
-- Solution: explicitly remove the user's rows from every dependent table
-- before deleting the auth.users row.

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

  -- Remove rows from tables that reference auth.users without CASCADE
  delete from public.blocked_users   where blocker_id = v_me or blocked_id = v_me;
  delete from public.peer_swipes     where swiper = v_me or swiped = v_me;
  delete from public.peer_matches    where member_a = v_me or member_b = v_me;
  delete from public.mentor_requests where mentee = v_me or mentor = v_me;
  delete from public.tokens          where user_id = v_me;
  delete from public.notification_events where recipient_user_id = v_me or actor_user_id = v_me;

  -- messages & threads are ON DELETE CASCADE from auth.users via profiles,
  -- but clean up messages sent by this user to be safe
  delete from public.messages where sender = v_me;

  -- profiles has ON DELETE CASCADE, but delete explicitly so triggers fire
  delete from public.profiles where id = v_me;

  -- Now the auth user can be removed without FK violations
  delete from auth.users where id = v_me;

  return jsonb_build_object('ok', true, 'deleted_user_id', v_me);
end;
$$;
