-- Seed: Program Metadata
-- Run after all target programs already exist and after
-- 20260413_000010_program_source_metadata.sql has been applied.
--
-- Targets:
--   - gzclp-base
--   - starting-strength-base
--   - upper-lower-base
--   - dumbbell-full-body-base
--
-- This seed is authoritative for the current metadata assignment of the
-- public program library. It may be re-run safely (upsert + delete/re-insert).

do $$
declare
  prog_gzclp uuid;
  prog_starting_strength uuid;
  prog_upper_lower uuid;
  prog_dumbbell_full_body uuid;

  tag_strength uuid;
  tag_barbell uuid;
  tag_full_body uuid;
  tag_upper_lower uuid;
  tag_squat_focus uuid;
  tag_explosive uuid;
  tag_general_fitness uuid;
  tag_dumbbell uuid;
begin
  insert into public.program_tags (slug, label, axis, description, sort_order)
  values
    ('strength', 'Strength', 'goal', 'Primary goal is improving absolute strength on the main lifts.', 10),
    ('general-fitness', 'General Fitness', 'goal', 'Primary goal is building overall fitness and movement quality rather than sport-specific strength.', 20),
    ('barbell', 'Barbell', 'equipment', 'Program assumes a barbell-centered setup.', 10),
    ('dumbbell', 'Dumbbell', 'equipment', 'Program uses dumbbells as the primary equipment.', 20),
    ('full-body', 'Full Body', 'split', 'Each session trains the full body rather than a body-part split.', 10),
    ('upper-lower', 'Upper / Lower', 'split', 'Sessions alternate between upper-body and lower-body focused days.', 20),
    ('squat-focus', 'Squat Focus', 'focus', 'Program places unusually frequent emphasis on the squat.', 20),
    ('explosive', 'Explosive', 'focus', 'Program includes speed- and power-oriented work such as power clean.', 30)
  on conflict (slug) do update
    set
      label = excluded.label,
      axis = excluded.axis,
      description = excluded.description,
      sort_order = excluded.sort_order;

  select id into tag_strength       from public.program_tags where slug = 'strength';
  select id into tag_general_fitness from public.program_tags where slug = 'general-fitness';
  select id into tag_barbell         from public.program_tags where slug = 'barbell';
  select id into tag_dumbbell        from public.program_tags where slug = 'dumbbell';
  select id into tag_full_body       from public.program_tags where slug = 'full-body';
  select id into tag_upper_lower     from public.program_tags where slug = 'upper-lower';
  select id into tag_squat_focus     from public.program_tags where slug = 'squat-focus';
  select id into tag_explosive       from public.program_tags where slug = 'explosive';

  if tag_strength        is null
    or tag_general_fitness is null
    or tag_barbell         is null
    or tag_dumbbell        is null
    or tag_full_body       is null
    or tag_upper_lower     is null
    or tag_squat_focus     is null
    or tag_explosive       is null then
    raise exception 'Tag lookup failed for program metadata seed.';
  end if;

  select id into prog_gzclp             from public.programs where slug = 'gzclp-base';
  select id into prog_starting_strength from public.programs where slug = 'starting-strength-base';
  select id into prog_upper_lower       from public.programs where slug = 'upper-lower-base';
  select id into prog_dumbbell_full_body from public.programs where slug = 'dumbbell-full-body-base';

  if prog_gzclp is null then
    raise exception 'Program slug not found: gzclp-base';
  end if;
  if prog_starting_strength is null then
    raise exception 'Program slug not found: starting-strength-base';
  end if;
  if prog_upper_lower is null then
    raise exception 'Program slug not found: upper-lower-base';
  end if;
  if prog_dumbbell_full_body is null then
    raise exception 'Program slug not found: dumbbell-full-body-base';
  end if;

  update public.programs
  set
    title = 'GZCLP Base',
    source_program_name = 'GZCLP',
    source_fidelity = 'original',
    source_notes = 'Original Cody Lefever base month: 3-day schedule, A1/B1/A2/B2 rotation, and standard T1/T2/T3 progression.'
  where id = prog_gzclp;

  update public.programs
  set
    title = 'Starting Strength Phase 2 Base',
    source_program_name = 'Starting Strength Novice Program - Phase 2',
    source_fidelity = 'original',
    source_notes = 'Phase 2 snapshot only: squat every session, bench and press alternate, deadlift on A, power clean on B. Slug retained for route continuity.'
  where id = prog_starting_strength;

  update public.programs
  set
    title = 'Upper Lower Base',
    source_program_name = null,
    source_fidelity = 'custom',
    source_notes = 'Internal MVP upper/lower template. No single canonical source program is being represented.'
  where id = prog_upper_lower;

  update public.programs
  set
    title = 'Dumbbell Full Body Base',
    source_program_name = null,
    source_fidelity = 'custom',
    source_notes = 'Internal beginner dumbbell full-body template. No single canonical source program is being represented.'
  where id = prog_dumbbell_full_body;

  delete from public.program_tag_assignments
  where program_id in (prog_gzclp, prog_starting_strength, prog_upper_lower, prog_dumbbell_full_body);

  insert into public.program_tag_assignments (program_id, tag_id, axis)
  values
    (prog_gzclp, tag_strength, 'goal'),
    (prog_gzclp, tag_barbell, 'equipment'),
    (prog_gzclp, tag_full_body, 'split'),
    (prog_starting_strength, tag_strength, 'goal'),
    (prog_starting_strength, tag_barbell, 'equipment'),
    (prog_starting_strength, tag_full_body, 'split'),
    (prog_starting_strength, tag_squat_focus, 'focus'),
    (prog_starting_strength, tag_explosive, 'focus'),
    (prog_upper_lower, tag_strength, 'goal'),
    (prog_upper_lower, tag_barbell, 'equipment'),
    (prog_upper_lower, tag_upper_lower, 'split'),
    (prog_dumbbell_full_body, tag_general_fitness, 'goal'),
    (prog_dumbbell_full_body, tag_dumbbell, 'equipment'),
    (prog_dumbbell_full_body, tag_full_body, 'split');

  raise notice 'Seed complete: program metadata assigned for gzclp-base, starting-strength-base, upper-lower-base, dumbbell-full-body-base.';
end;
$$;

-- Confirmation query
-- select
--   p.slug as program_slug,
--   p.title,
--   p.source_program_name,
--   p.source_fidelity,
--   p.source_notes,
--   p.level,
--   pt.axis,
--   pt.slug as tag_slug,
--   pt.label
-- from public.programs p
-- left join public.program_tag_assignments pta on pta.program_id = p.id
-- left join public.program_tags pt on pt.id = pta.tag_id
-- where p.slug in ('gzclp-base', 'starting-strength-base', 'upper-lower-base')
-- order by p.slug, pt.axis, pt.sort_order, pt.label;
