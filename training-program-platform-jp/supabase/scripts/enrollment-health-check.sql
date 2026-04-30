-- enrollment-health-check.sql
-- Queries to audit and repair active enrollment integrity.
-- Run in Supabase SQL Editor (read-only checks first, repair last).
--
-- Background: Multiple users encountered "wrong active program" symptoms
-- caused by stale current_program_day_id or incorrect enrollment status.
-- These queries identify affected rows for admin review.

-- ============================================================
-- CHECK 1: Users with multiple active, non-archived enrollments
-- (should be 0 rows; DB unique index prevents this, but verify)
-- ============================================================
SELECT
  user_id,
  COUNT(*) AS active_count,
  array_agg(id) AS enrollment_ids,
  array_agg(p.slug) AS program_slugs
FROM program_enrollments pe
JOIN programs p ON p.id = pe.program_id
WHERE pe.status = 'active'
  AND pe.archived_at IS NULL
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY active_count DESC;

-- ============================================================
-- CHECK 2: Active enrollments where current_program_day_id points
-- to a day that already has a completed session (stale advancement)
-- ============================================================
SELECT
  pe.id       AS enrollment_id,
  pe.user_id,
  p.slug      AS program_slug,
  pw.week_number,
  pd.day_number,
  pe.current_program_day_id,
  ws.id       AS completed_session_id,
  ws.finished_at
FROM program_enrollments pe
JOIN programs p ON p.id = pe.program_id
JOIN program_days pd ON pd.id = pe.current_program_day_id
JOIN program_weeks pw ON pw.id = pd.program_week_id
JOIN workout_sessions ws
  ON ws.program_day_id = pe.current_program_day_id
  AND ws.user_id = pe.user_id
  AND ws.status = 'completed'
  AND ws.archived_at IS NULL
WHERE pe.status = 'active'
  AND pe.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM workout_sessions ws2
    WHERE ws2.program_day_id = pe.current_program_day_id
      AND ws2.user_id = pe.user_id
      AND ws2.status = 'in_progress'
      AND ws2.archived_at IS NULL
  )
ORDER BY pe.user_id, ws.finished_at DESC;

-- ============================================================
-- CHECK 3: Active enrollments whose most recent session is for
-- a DIFFERENT program (enrollment / session mismatch)
-- ============================================================
SELECT
  pe.id            AS enrollment_id,
  pe.user_id,
  p_enr.slug       AS active_enrollment_program,
  p_sess.slug      AS latest_session_program,
  ws.started_at    AS latest_session_date,
  ws.status        AS latest_session_status
FROM program_enrollments pe
JOIN programs p_enr ON p_enr.id = pe.program_id
JOIN LATERAL (
  SELECT ws.*
  FROM workout_sessions ws
  WHERE ws.user_id = pe.user_id
    AND ws.program_day_id IS NOT NULL
    AND ws.archived_at IS NULL
  ORDER BY ws.started_at DESC
  LIMIT 1
) ws ON true
LEFT JOIN program_days pd ON pd.id = ws.program_day_id
LEFT JOIN program_weeks pw ON pw.id = pd.program_week_id
LEFT JOIN programs p_sess ON p_sess.id = pw.program_id
WHERE pe.status = 'active'
  AND pe.archived_at IS NULL
  AND p_sess.id IS DISTINCT FROM pe.program_id
ORDER BY pe.user_id;

-- ============================================================
-- CHECK 4: Active enrollments pointing to a completed program
-- (enrollment status should have been set to 'completed')
-- ============================================================
SELECT
  pe.id AS enrollment_id,
  pe.user_id,
  p.slug,
  pe.current_program_day_id
FROM program_enrollments pe
JOIN programs p ON p.id = pe.program_id
LEFT JOIN program_days pd ON pd.id = pe.current_program_day_id
WHERE pe.status = 'active'
  AND pe.archived_at IS NULL
  AND pe.current_program_day_id IS NULL
ORDER BY pe.user_id;

-- ============================================================
-- REPAIR: Advance stale current_program_day_id for a specific user
-- (run after confirming CHECK 2 results; replace UUIDs)
-- ============================================================
/*
UPDATE program_enrollments
SET
  current_program_day_id = '<next_day_uuid>',
  updated_at = now()
WHERE id = '<enrollment_uuid>'
  AND user_id = '<user_uuid>';
*/

-- ============================================================
-- REPAIR: Fix wrong active enrollment for a specific user
-- (pause the incorrect one, activate the correct one)
-- ============================================================
/*
BEGIN;

-- 1. Pause the incorrectly active enrollment
UPDATE program_enrollments
SET status = 'paused', updated_at = now()
WHERE user_id = '<user_uuid>'
  AND program_id = (SELECT id FROM programs WHERE slug = '<wrong_slug>')
  AND status = 'active';

-- 2. Re-activate the correct enrollment
UPDATE program_enrollments
SET status = 'active', archived_at = NULL, updated_at = now()
WHERE user_id = '<user_uuid>'
  AND program_id = (SELECT id FROM programs WHERE slug = '<correct_slug>')
  AND status = 'paused';

COMMIT;
*/
