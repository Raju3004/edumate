-- EduMate / PS 06 — initial Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
-- Kept to exactly what the two modules need: nothing speculative bolted on.

-- ─────────────────────────────────────────────
-- 1. profiles — one row per signed-up learner
--    Extends Supabase's built-in auth.users (don't duplicate email/password there).
-- ─────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row the moment someone signs up via Supabase Auth.
create function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─────────────────────────────────────────────
-- 2. learning_profiles — Module 1: Student Learning Profile
--    One row per (learner, subject, topic). This is what "adapts teaching
--    according to the student's needs" reads from and writes to.
-- ─────────────────────────────────────────────
create table learning_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  topic text not null,
  understanding_level smallint not null default 1 check (understanding_level between 1 and 5),
  confidence numeric(3,2) not null default 0.5 check (confidence between 0 and 1),
  known_misconceptions jsonb not null default '[]'::jsonb,
  pace text not null default 'steady' check (pace in ('behind', 'steady', 'ahead')),
  updated_at timestamptz not null default now(),
  unique (user_id, subject, topic)
);

-- ─────────────────────────────────────────────
-- 3. tutor_sessions — one row per tutoring conversation
-- ─────────────────────────────────────────────
create table tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  topic text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- ─────────────────────────────────────────────
-- 4. messages — Module 2: Tutor–Student Relationship
--    Every turn in a session, including the "explain why" understanding checks.
-- ─────────────────────────────────────────────
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references tutor_sessions(id) on delete cascade,
  role text not null check (role in ('student', 'tutor')),
  content text not null,
  is_understanding_check boolean not null default false,
  marked_understood boolean,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 5. progress_events — lightweight log for pace/gap tracking over time
--    Lets the Learning Profile module show "how this learner has moved" without
--    needing a full analytics table.
-- ─────────────────────────────────────────────
create table progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  topic text not null,
  event_type text not null check (event_type in ('level_check', 'misconception_detected', 'pace_update', 'session_completed')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Row Level Security — a learner can only ever touch their own rows.
-- Required on every table before this goes anywhere near Vercel/Render.
-- ─────────────────────────────────────────────
alter table profiles enable row level security;
alter table learning_profiles enable row level security;
alter table tutor_sessions enable row level security;
alter table messages enable row level security;
alter table progress_events enable row level security;

create policy "read own profile" on profiles
  for select using (auth.uid() = id);
create policy "update own profile" on profiles
  for update using (auth.uid() = id);

create policy "manage own learning profile" on learning_profiles
  for all using (auth.uid() = user_id);

create policy "manage own sessions" on tutor_sessions
  for all using (auth.uid() = user_id);

create policy "manage own messages" on messages
  for all using (
    auth.uid() = (select user_id from tutor_sessions where tutor_sessions.id = messages.session_id)
  );

create policy "manage own progress events" on progress_events
  for all using (auth.uid() = user_id);

-- Helpful indexes for the lookups the tutor will do on every turn.
create index idx_learning_profiles_user on learning_profiles(user_id, subject, topic);
create index idx_sessions_user on tutor_sessions(user_id);
create index idx_messages_session on messages(session_id, created_at);
create index idx_progress_user on progress_events(user_id, subject, topic, created_at);
