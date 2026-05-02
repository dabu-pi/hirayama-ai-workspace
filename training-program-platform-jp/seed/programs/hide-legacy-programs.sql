-- Seed: Hide Legacy Programs
-- Sets is_public = false for programs that are no longer part of the active library.
-- Safe to re-run (idempotent UPDATE).
--
-- Active library (is_public = true):
--   gzclp-base           GZCLP Base
--   gzclp-base-v2-4day   GZCLP 5-Exercise 4-Day
--   big3-3day            BIG3 3-Day
--
-- Hidden (is_public = false):
--   gzclp-base-v2          3-Day variant — superseded by gzclp-base-v2-4day
--   starting-strength-base
--   upper-lower-base
--   dumbbell-full-body-base
--   full-body-foundation

update public.programs
set is_public = false
where slug in (
  'gzclp-base-v2',
  'starting-strength-base',
  'upper-lower-base',
  'dumbbell-full-body-base',
  'full-body-foundation'
);

-- Confirmation: expected 5 rows updated.
-- select slug, title, is_public from public.programs order by is_public desc, slug;
