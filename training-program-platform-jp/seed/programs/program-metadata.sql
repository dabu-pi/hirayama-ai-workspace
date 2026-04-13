-- Seed: Program Metadata
-- Run after all target programs already exist.
--
-- Targets:
--   - gzclp-base
--   - starting-strength-base
--   - upper-lower-base
--
-- This seed is authoritative for the current metadata assignment of the
-- public program library. It may be re-run safely (upsert + delete/re-insert).

do $$
declare
  prog_gzclp           uuid;
  prog_starting_strength uuid;
  prog_upper_lower     uuid;

  tag_strength         uuid;
  tag_barbell          uuid;
  tag_full_body        uuid;
  tag_upper_lower      uuid;
  tag_squat_focus      uuid;
  tag_explosive        uuid;
begin
  -- 1. tag master (upsert by slug)
  insert into public.program_tags (slug, label, axis, description, sort_order)
  values
    ('strength',    'Strength',    'goal',      'Primary goal is improving absolute strength on the main lifts.',        10),
    ('barbell',     'Barbell',     'equipment', 'Program assumes a barbell-centered setup.',                              10),
    ('full-body',   'Full Body',   'split',     'Each session trains the full body rather than a body-part split.',      10),
    ('upper-lower', 'Upper / Lower', 'split',   'Sessions alternate between upper-body and lower-body focused days.',    20),
    ('squat-focus', 'Squat Focus', 'focus',     'Program places unusually frequent emphasis on the squat.',             20),
    ('explosive',   'Explosive',   'focus',     'Program includes speed- and power-oriented work such as power clean.', 30)
  on conflict (slug) do update
    set
      label       = excluded.label,
      axis        = excluded.axis,
      description = excluded.description,
      sort_order  = excluded.sort_order;

  select id into tag_strength    from public.program_tags where slug = 'strength';
  select id into tag_barbell     from public.program_tags where slug = 'barbell';
  select id into tag_full_body   from public.program_tags where slug = 'full-body';
  select id into tag_upper_lower from public.program_tags where slug = 'upper-lower';
  select id into tag_squat_focus from public.program_tags where slug = 'squat-focus';
  select id into tag_explosive   from public.program_tags where slug = 'explosive';

  if tag_strength    is null
  or tag_barbell     is null
  or tag_full_body   is null
  or tag_upper_lower is null
  or tag_squat_focus is null
  or tag_explosive   is null then
    raise exception 'Tag lookup failed for program metadata seed.';
  end if;

  -- 2. target programs
  select id into prog_gzclp            from public.programs where slug = 'gzclp-base';
  select id into prog_starting_strength from public.programs where slug = 'starting-strength-base';
  select id into prog_upper_lower      from public.programs where slug = 'upper-lower-base';

  if prog_gzclp is null then
    raise exception 'Program slug not found: gzclp-base';
  end if;
  if prog_starting_strength is null then
    raise exception 'Program slug not found: starting-strength-base';
  end if;
  if prog_upper_lower is null then
    raise exception 'Program slug not found: upper-lower-base';
  end if;

  -- 3. current assignments (authoritative rewrite for all target programs)
  delete from public.program_tag_assignments
  where program_id in (prog_gzclp, prog_starting_strength, prog_upper_lower);

  insert into public.program_tag_assignments (program_id, tag_id, axis)
  values
    -- gzclp-base: Strength / Barbell / Full Body
    (prog_gzclp, tag_strength,    'goal'),
    (prog_gzclp, tag_barbell,     'equipment'),
    (prog_gzclp, tag_full_body,   'split'),
    -- starting-strength-base: Strength / Barbell / Full Body + Squat Focus / Explosive
    (prog_starting_strength, tag_strength,    'goal'),
    (prog_starting_strength, tag_barbell,     'equipment'),
    (prog_starting_strength, tag_full_body,   'split'),
    (prog_starting_strength, tag_squat_focus, 'focus'),
    (prog_starting_strength, tag_explosive,   'focus'),
    -- upper-lower-base: Strength / Barbell / Upper-Lower
    (prog_upper_lower, tag_strength,    'goal'),
    (prog_upper_lower, tag_barbell,     'equipment'),
    (prog_upper_lower, tag_upper_lower, 'split');

  raise notice 'Seed complete: program metadata assigned for gzclp-base, starting-strength-base, upper-lower-base.';
end;
$$;

-- Confirmation query
-- select
--   p.slug as program_slug,
--   p.level,
--   pt.axis,
--   pt.slug as tag_slug,
--   pt.label
-- from public.programs p
-- left join public.program_tag_assignments pta on pta.program_id = p.id
-- left join public.program_tags pt on pt.id = pta.tag_id
-- where p.slug in ('gzclp-base', 'starting-strength-base', 'upper-lower-base')
-- order by p.slug, pt.axis, pt.sort_order, pt.label;
