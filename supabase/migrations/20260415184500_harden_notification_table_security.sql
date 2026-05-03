begin;

alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "notification_events_select_own_or_admin" on public.notification_events;
create policy "notification_events_select_own_or_admin"
  on public.notification_events
  for select
  to authenticated
  using (
    recipient_user_id = auth.uid()
    or public.is_admin_user()
  );

drop policy if exists "notification_events_insert_admin" on public.notification_events;
create policy "notification_events_insert_admin"
  on public.notification_events
  for insert
  to authenticated
  with check (public.is_admin_user());

revoke all on table public.notification_deliveries from anon;
revoke all on table public.notification_deliveries from authenticated;

commit;
