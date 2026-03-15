create table user_blocks (
  id bigserial primary key,
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker, blocked),
  check (blocker <> blocked)
);
