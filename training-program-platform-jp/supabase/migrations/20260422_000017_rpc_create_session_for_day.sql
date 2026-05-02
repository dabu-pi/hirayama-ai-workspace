-- RPC: create_workout_session_for_day
--
-- Purpose:
--   Collapses session + exercises + sets creation from 3 sequential round-trips
--   (INSERT session → INSERT exercises → INSERT sets) into 1 DB function call.
--
--   All INSERTs run within a single transaction, so:
--     - FK check on workout_session_exercises.workout_session_id succeeds
--       because the session row is visible within the same transaction.
--     - RLS policies on workout_session_exercises / workout_sets chain through
--       workout_sessions using EXISTS(...) — also satisfied within the same Tx.
--
-- Security:
--   SECURITY INVOKER — function runs as the calling (authenticated) user.
--   RLS policies on all three tables remain active without modification.
--   auth.uid() resolves from the JWT passed by the Supabase client.
--   Unauthenticated calls raise an exception immediately.
--
-- Rollback:
--   Any INSERT failure raises an exception and rolls back the entire function.
--   session-without-exercises partial state (possible in the old 3-RT path) cannot occur.

create or replace function public.create_workout_session_for_day(
  p_program_day_id   uuid,
  p_enrollment_id    uuid,     -- nullable — pass NULL when no enrollment is linked
  p_exercises        jsonb     -- array of exercise objects; empty array creates session only
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $func$
declare
  v_user_id              uuid;
  v_session_id           uuid;
  v_exercise             jsonb;
  v_session_exercise_id  uuid;
  v_set_count            int;
  v_i                    int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  -- 1. Insert session.
  --    user_id = auth.uid() satisfies the RLS insert policy:
  --      "Users can insert own sessions" → with check (auth.uid() = user_id)
  insert into public.workout_sessions (
    user_id,
    program_day_id,
    program_enrollment_id,
    status
  )
  values (
    v_user_id,
    p_program_day_id,
    p_enrollment_id,
    'in_progress'
  )
  returning id into v_session_id;

  -- 2. Insert exercises and sets from the jsonb array.
  --    Each jsonb element represents one program_day_exercise.
  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    -- 2a. Insert session exercise.
    --     RLS policy on workout_session_exercises uses:
    --       EXISTS (SELECT 1 FROM workout_sessions WHERE id = ... AND user_id = auth.uid())
    --     This succeeds because the session row is visible within this transaction.
    insert into public.workout_session_exercises (
      workout_session_id,
      exercise_id,
      exercise_type,
      order_index,
      was_added,
      was_swapped,
      swap_group_slug
    )
    values (
      v_session_id,
      (v_exercise->>'exercise_id')::uuid,
      v_exercise->>'exercise_type',
      (v_exercise->>'order_index')::int,
      false,
      false,
      v_exercise->>'swap_group_slug'   -- jsonb ->> returns SQL NULL for JSON null
    )
    returning id into v_session_exercise_id;

    -- 2b. Insert sets (minimum 1 even if set_count = 0).
    v_set_count := greatest(1, (v_exercise->>'set_count')::int);
    for v_i in 1..v_set_count loop
      insert into public.workout_sets (
        workout_session_exercise_id,
        set_number,
        target_reps_text,
        weight_kg,
        reps_done,
        is_completed,
        is_locked,
        is_auto_filled,
        deleted_at
      )
      values (
        v_session_exercise_id,
        v_i,
        v_exercise->>'target_reps_text',   -- NULL for JSON null
        null,
        null,
        false,
        false,
        false,
        null
      );
    end loop;
  end loop;

  return v_session_id;
end;
$func$;
