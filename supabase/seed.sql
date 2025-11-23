-- Replace these UUIDs with real IDs from Auth → Users

-- Example users:
-- member/mentee
insert into profiles (id, full_name, role, title, industry, bio)
values
  ('65348b44-d89f-4939-88cf-a50274caca4c', 'Josh Mentee', 'member',
   'Sales Executive', 'SaaS', 'Looking for help breaking into mid-level roles'),
  ('a319f25c-1fe4-4bab-b126-5021836c08c4', 'Alex Member', 'member',
   'Account Manager', 'Advertising', 'Wants to grow a portfolio of key accounts')
on conflict (id) do nothing;

-- mentors
insert into profiles (id, full_name, role, title, industry, bio)
values
  ('aa6d4433-1148-49ac-82a1-3a943fb8eee7', 'Josh Mentor', 'mentor',
   'Sales Director', 'SaaS', 'Director mentoring ambitious sales professionals'),
  ('d3a611ec-2422-4bdf-bfeb-374865a96791', 'Alex Mentor', 'mentor',
   'Head of Customer Success', 'Fintech', 'Helps mentees move into leadership roles')
on conflict (id) do nothing;

-- some initial peer_swipes (likes)
insert into peer_swipes (swiper, swiped, direction, comment)
values
  ('65348b44-d89f-4939-88cf-a50274caca4c', 'a319f25c-1fe4-4bab-b126-5021836c08c4', 'like', 'Love your profile!'),
  ('a319f25c-1fe4-4bab-b126-5021836c08c4', '65348b44-d89f-4939-88cf-a50274caca4c', 'like', 'Let\'s connect');

-- a sample match between the two members
insert into peer_matches (member_a, member_b)
values
  ('65348b44-d89f-4939-88cf-a50274caca4c', 'a319f25c-1fe4-4bab-b126-5021836c08c4')
on conflict do nothing;

-- some tokens (starting balances)
insert into tokens (user_id, delta, reason)
values
  ('65348b44-d89f-4939-88cf-a50274caca4c', 10, 'Initial grant'),
  ('a319f25c-1fe4-4bab-b126-5021836c08c4', 10, 'Initial grant');

-- one mentor request from Josh to Chris
insert into mentor_requests (mentee, mentor, status, tokens_cost)
values
  ('65348b44-d89f-4939-88cf-a50274caca4c', 'aa6d4433-1148-49ac-82a1-3a943fb8eee7', 'requested', 3);
