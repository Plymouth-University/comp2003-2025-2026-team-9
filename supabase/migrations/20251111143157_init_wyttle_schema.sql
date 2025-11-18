-- 1. PROFILES: one row per user (member/mentor/admin)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text check (role in ('member','mentor','admin')) default 'member',
  title text,
  industry text,
  bio text,
  linkedin_url text,
  skills text[],
  interests text[],
  photo_url text,
  created_at timestamptz default now()
);

-- 2. APPLICATIONS: onboarding applications (member or mentor)
create table if not exists public.applications (
  id bigserial primary key,
  user_email text not null,
  user_type text check (user_type in ('member','mentor')) not null,
  name text,
  job_title text,
  industry text,
  goals text,
  reason text,         -- why they want to be a mentor/member
  linkedin_url text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users -- admin
);

-- 3. PEER_SWIPES: Discovery Stack actions (like your "handshakes"/swipes)
create table if not exists public.peer_swipes (
  id bigserial primary key,
  swiper uuid references auth.users not null,
  swiped uuid references auth.users not null,
  direction text check (direction in ('like','pass')) not null,
  comment text,
  created_at timestamptz default now()
);

-- 4. PEER_MATCHES: when two people both "like" each other
create table if not exists public.peer_matches (
  id bigserial primary key,
  member_a uuid references auth.users not null,
  member_b uuid references auth.users not null,
  created_at timestamptz default now(),
  unique(member_a, member_b)
);

-- 5. THREADS: chat threads (peer or mentor)
create table if not exists public.threads (
  id bigserial primary key,
  type text check (type in ('peer','mentorship')) not null,
  created_at timestamptz default now()
);

-- 6. MESSAGES: chat messages per thread
create table if not exists public.messages (
  id bigserial primary key,
  thread_id bigint references public.threads on delete cascade,
  sender uuid references auth.users not null,
  body text not null,
  inserted_at timestamptz default now()
);

-- 7. TOKENS: mentor token balances / transactions
create table if not exists public.tokens (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  delta integer not null,  -- +10 purchase / -3 used / etc.
  reason text,
  created_at timestamptz default now()
);

-- 8. MENTOR_REQUESTS: bookings for mentors
create table if not exists public.mentor_requests (
  id bigserial primary key,
  mentee uuid references auth.users not null,
  mentor uuid references auth.users not null,
  thread_id bigint references public.threads,
  status text check (status in ('requested','proposed','scheduled','done','cancelled')) default 'requested',
  requested_at timestamptz default now(),
  proposed_at timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  video_link text,
  tokens_cost integer default 0
);

-- Enable RLS
alter table profiles         enable row level security;
alter table applications     enable row level security;
alter table peer_swipes      enable row level security;
alter table peer_matches     enable row level security;
alter table threads          enable row level security;
alter table messages         enable row level security;
alter table tokens           enable row level security;
alter table mentor_requests  enable row level security;
