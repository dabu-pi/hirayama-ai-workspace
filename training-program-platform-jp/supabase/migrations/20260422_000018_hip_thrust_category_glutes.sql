-- Reclassify hip-thrust from 'legs' to 'glutes' so the お尻 muscle-group
-- filter returns at least one exercise. Seed file updated in parallel;
-- this migration covers rows already present in the DB.
update public.exercises
set category = 'glutes'
where slug = 'hip-thrust'
  and category = 'legs';
