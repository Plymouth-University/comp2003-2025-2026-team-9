-- PROFILES: everyone can read; users can only write their own row
create policy "profiles_select_all"
  on profiles
  for select
  using (true);

create policy "profiles_insert_own"
  on profiles
  for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on profiles
  for update
  using (auth.uid() = id);

------------------------------------------------------------
-- APPLICATIONS: allow anyone (incl. unauth) to submit an application
-- (we're not tying to auth.uid() here, just an email)
create policy "applications_insert_any"
  on applications
  for insert
  with check (true);

-- For the POC, let any logged-in user read all applications.
-- Later you can restrict this to admins.
create policy "applications_read_all"
  on applications
  for select
  using (auth.role() = 'authenticated');

------------------------------------------------------------
-- PEER_SWIPES: only the swiper can insert; only participants can see
create policy "peer_swipes_insert_own"
  on peer_swipes
  for insert
  with check (auth.uid() = swiper);

create policy "peer_swipes_read_participant"
  on peer_swipes
  for select
  using (auth.uid() in (swiper, swiped));

------------------------------------------------------------
-- PEER_MATCHES: only matched people can see their match
create policy "peer_matches_read_participant"
  on peer_matches
  for select
  using (auth.uid() in (member_a, member_b));

-- For now, allow inserts from the client.
-- Later you can move this into an RPC that enforces "mutual like".
create policy "peer_matches_insert_any"
  on peer_matches
  for insert
  with check (auth.uid() is not null);

------------------------------------------------------------
-- THREADS: keep it simple for POC - everyone can select.
-- (You're not directly exposing threads yet; they're usually read via matches/requests.)
create policy "threads_select_all"
  on threads
  for select
  using (true);

create policy "threads_insert_any"
  on threads
  for insert
  with check (auth.uid() is not null);

------------------------------------------------------------
-- MESSAGES: only the sender can insert; everyone can read for POC
-- (You can tighten this later when threads are fully wired.)
create policy "messages_insert_sender"
  on messages
  for insert
  with check (auth.uid() = sender);

create policy "messages_select_all"
  on messages
  for select
  using (true);

------------------------------------------------------------
-- TOKENS: users can only see their own balance/transactions
create policy "tokens_read_own"
  on tokens
  for select
  using (auth.uid() = user_id);

-- For now allow inserts from the app (e.g. seed or simple token grants).
-- Later you can lock this to an RPC / admin.
create policy "tokens_insert_any"
  on tokens
  for insert
  with check (auth.uid() is not null);

------------------------------------------------------------
-- MENTOR_REQUESTS: mentee creates; mentee+mentor can see & update
create policy "mentor_requests_insert_mentee"
  on mentor_requests
  for insert
  with check (auth.uid() = mentee);

create policy "mentor_requests_read_participants"
  on mentor_requests
  for select
  using (auth.uid() in (mentee, mentor));

create policy "mentor_requests_update_participants"
  on mentor_requests
  for update
  using (auth.uid() in (mentee, mentor));
