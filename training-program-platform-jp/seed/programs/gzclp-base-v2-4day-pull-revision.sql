-- Migration: gzclp-base-v2-4day pull revision
-- Run in Supabase Dashboard > SQL Editor against the LIVE database.
--
-- Changes:
--   1. Add exercises: seated-row (シーテッドロウ), arnold-press (アーノルドプレス)
--   2. Replace dumbbell-row → seated-row at pos3 for all B1/B2 days
--      (横引き: DB Row は片側ダンベル → Seated Row はケーブル両手で初心者向き)
--   3. Replace upright-row → arnold-press in gzcl4-ohp-t3 swap group
--      (縦引き系の Upright Row を除去 → プル2系統 縦/横 が完全に成立)
--   4. Update B day notes to reflect Seated Row
--
-- Safe to re-run: exercises use on conflict do nothing.
-- Exercise update: idempotent (WHERE exercise_id = ex_db_row only matches if not yet replaced).

do $$
declare
  ex_seated_row   uuid;
  ex_arnold_press uuid;
  ex_upright_row  uuid;
  ex_db_row       uuid;
  prog_id         uuid;
  updated_rows    int;
begin
  -- ── 1. Upsert new exercises ───────────────────────────────────────────────

  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('seated-row',   U&'\30B7\30FC\30C6\30C3\30C9\30ED\30A6',   'Seated Row',   'back'),
    ('arnold-press', U&'\30A2\30FC\30CE\30EB\30C9\30D7\30EC\30B9', 'Arnold Press', 'shoulders')
  on conflict (slug) do nothing;

  -- ── 2. Resolve UUIDs ─────────────────────────────────────────────────────

  select id into ex_seated_row   from public.exercises where slug = 'seated-row';
  select id into ex_arnold_press from public.exercises where slug = 'arnold-press';
  select id into ex_upright_row  from public.exercises where slug = 'upright-row';
  select id into ex_db_row       from public.exercises where slug = 'dumbbell-row';

  if ex_seated_row   is null then raise exception 'seated-row could not be inserted/found'; end if;
  if ex_arnold_press is null then raise exception 'arnold-press could not be inserted/found'; end if;

  select id into prog_id from public.programs where slug = 'gzclp-base-v2-4day';
  if prog_id is null then
    raise exception 'Program gzclp-base-v2-4day not found — run gzclp-base-v2-4day.sql first';
  end if;

  -- ── 3. Replace dumbbell-row → seated-row at pos3 for B days ─────────────
  --    Targets only rows where exercise_id is still dumbbell-row (idempotent).

  update public.program_day_exercises pde
  set exercise_id = ex_seated_row
  where pde.order_index = 3
    and pde.exercise_id = ex_db_row
    and pde.program_day_id in (
      select pd.id
      from public.program_days pd
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
    );

  get diagnostics updated_rows = row_count;
  raise notice 'program_day_exercises updated (dumbbell-row → seated-row): % rows', updated_rows;

  -- ── 4. Update notes for B days ────────────────────────────────────────────

  update public.program_days pd
  set notes = replace(pd.notes, 'DB Row', 'Seated Row')
  where pd.notes like '%DB Row%'
    and pd.id in (
      select pd2.id
      from public.program_days pd2
      join public.program_weeks pw on pw.id = pd2.program_week_id
      where pw.program_id = prog_id
    );

  get diagnostics updated_rows = row_count;
  raise notice 'program_days notes updated: % rows', updated_rows;

  -- ── 5. Replace upright-row → arnold-press in gzcl4-ohp-t3 ───────────────
  --    Skips silently if upright-row is not in the group (already migrated).

  if ex_upright_row is not null then
    update public.exercise_swap_group_members
    set exercise_id = ex_arnold_press
    where group_slug = 'gzcl4-ohp-t3'
      and exercise_id = ex_upright_row;

    get diagnostics updated_rows = row_count;
    raise notice 'gzcl4-ohp-t3 swap group updated (upright-row → arnold-press): % rows', updated_rows;
  else
    raise notice 'upright-row not found in exercises — swap group step skipped';
  end if;

  raise notice 'Pull revision complete for gzclp-base-v2-4day.';
end;
$$;

-- Verification query — run after migration to confirm changes:
--
-- select
--   pd.day_number,
--   pde.order_index,
--   e.slug            as exercise_slug,
--   e.name_ja,
--   pde.exercise_type
-- from public.program_day_exercises pde
-- join public.program_days pd    on pd.id = pde.program_day_id
-- join public.program_weeks pw   on pw.id = pd.program_week_id
-- join public.programs p         on p.id  = pw.program_id
-- join public.exercises e        on e.id  = pde.exercise_id
-- where p.slug = 'gzclp-base-v2-4day'
--   and pde.order_index = 3
--   and pw.week_number  = 1
-- order by pd.day_number;
-- Expected: day1→lat-pulldown, day2→seated-row, day3→lat-pulldown, day4→seated-row
--
-- select group_slug, e.slug, e.name_ja
-- from public.exercise_swap_group_members m
-- join public.exercises e on e.id = m.exercise_id
-- where group_slug = 'gzcl4-ohp-t3'
-- order by e.slug;
-- Expected: arnold-press, lateral-raise, rear-delt-fly  (no upright-row)
