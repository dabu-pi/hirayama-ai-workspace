-- Make workout_sessions.user_id nullable for MVP session creation without auth.
-- The current auth strategy (public.users mirrors auth.users) means unauthenticated
-- requests cannot satisfy the NOT NULL + FK constraint. Dropping NOT NULL lets the
-- admin client create sessions during MVP until proper auth is wired.
alter table public.workout_sessions
  alter column user_id drop not null;
