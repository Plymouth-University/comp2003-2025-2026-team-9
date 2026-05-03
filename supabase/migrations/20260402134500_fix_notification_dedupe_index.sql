begin;

drop index if exists public.notification_events_dedupe_key_uq;

create unique index if not exists notification_events_dedupe_key_uq
  on public.notification_events (dedupe_key);

commit;
