-- Migration: gzclp-base-v2-4day pull revision (v2 — final)
-- Run in Supabase Dashboard > SQL Editor against the LIVE database.
--
-- Pull system redesign:
--   A1/A2 pos3: Lat Pulldown  (縦引き)          — 変更なし
--   B1    pos3: Seated Row    (横引き・ケーブル) — dumbbell-row から変更
--   B2    pos3: Barbell Row   (横引き・バーベル) — dumbbell-row から変更
--   縦引き×2/週 + 横引き(ケーブル)×2/週 + 横引き(バーベル)×2/週 のバランス
--
-- Other changes:
--   gzcl4-ohp-t3 swap: Upright Row → Arnold Press
--   (縦引き系を肩 swap から除去 → push 系で統一)
--
-- Safe to re-run:
--   - exercises: on conflict do nothing
--   - exercise_id updates: WHERE clause includes all transitional states (idempotent)
--   - notes updates: handles original 'DB Row' and intermediate 'Seated Row' states

do $$
declare
  ex_seated_row   uuid;
  ex_barbell_row  uuid;
  ex_arnold_press uuid;
  ex_upright_row  uuid;
  ex_db_row       uuid;
  ex_ohp          uuid;
  ex_deadlift     uuid;
  prog_id         uuid;
  updated_rows    int;
begin
  -- ── 1. Upsert exercises (barbell-row may already exist from upper-lower-base.sql) ──

  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('seated-row',   U&'\30B7\30FC\30C6\30C3\30C9\30ED\30A6',     'Seated Row',   'back'),
    ('barbell-row',  U&'\30D0\30FC\30D9\30EB\30ED\30A6',           'Barbell Row',  'back'),
    ('arnold-press', U&'\30A2\30FC\30CE\30EB\30C9\30D7\30EC\30B9', 'Arnold Press', 'shoulders')
  on conflict (slug) do nothing;

  -- ── 2. Resolve UUIDs ──────────────────────────────────────────────────────

  select id into ex_seated_row   from public.exercises where slug = 'seated-row';
  select id into ex_barbell_row  from public.exercises where slug = 'barbell-row';
  select id into ex_arnold_press from public.exercises where slug = 'arnold-press';
  select id into ex_upright_row  from public.exercises where slug = 'upright-row';
  select id into ex_db_row       from public.exercises where slug = 'dumbbell-row';
  select id into ex_ohp          from public.exercises where slug = 'overhead-press';
  select id into ex_deadlift     from public.exercises where slug = 'deadlift';

  if ex_seated_row   is null then raise exception 'seated-row could not be inserted/found'; end if;
  if ex_barbell_row  is null then raise exception 'barbell-row could not be inserted/found'; end if;
  if ex_arnold_press is null then raise exception 'arnold-press could not be inserted/found'; end if;
  if ex_ohp          is null then raise exception 'overhead-press not found'; end if;
  if ex_deadlift     is null then raise exception 'deadlift not found'; end if;

  select id into prog_id from public.programs where slug = 'gzclp-base-v2-4day';
  if prog_id is null then
    raise exception 'Program gzclp-base-v2-4day not found — run gzclp-base-v2-4day.sql first';
  end if;

  -- ── 3a. B1 days (T1=OHP): pos3 → seated-row ──────────────────────────────
  --    Matches any of: dumbbell-row / seated-row (transitional states) → idempotent

  update public.program_day_exercises pde
  set exercise_id = ex_seated_row
  where pde.order_index = 3
    and pde.exercise_id in (ex_db_row, ex_seated_row)
    and pde.program_day_id in (
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = ex_ohp
        and pde2.exercise_type = 'T1'
    );

  get diagnostics updated_rows = row_count;
  raise notice 'B1 pos3 updated → seated-row: % rows', updated_rows;

  -- ── 3b. B2 days (T1=Deadlift): pos3 → barbell-row ────────────────────────
  --    Matches any of: dumbbell-row / seated-row / barbell-row → idempotent

  update public.program_day_exercises pde
  set exercise_id = ex_barbell_row
  where pde.order_index = 3
    and pde.exercise_id in (ex_db_row, ex_seated_row, ex_barbell_row)
    and pde.program_day_id in (
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = ex_deadlift
        and pde2.exercise_type = 'T1'
    );

  get diagnostics updated_rows = row_count;
  raise notice 'B2 pos3 updated → barbell-row: % rows', updated_rows;

  -- ── 4a. B1 notes: '... T3 DB Row / ...' → '... T3 Seated Row / ...' ──────
  --    Also normalises any intermediate 'Seated Row' state (→ no-op).

  update public.program_days pd
  set notes = replace(replace(pd.notes, 'DB Row', 'Seated Row'), 'Barbell Row', 'Seated Row')
  where pd.id in (
    select pde2.program_day_id
    from public.program_day_exercises pde2
    join public.program_days pd2 on pd2.id = pde2.program_day_id
    join public.program_weeks pw on pw.id = pd2.program_week_id
    where pw.program_id = prog_id
      and pde2.order_index = 1
      and pde2.exercise_id = ex_ohp
      and pde2.exercise_type = 'T1'
  );

  get diagnostics updated_rows = row_count;
  raise notice 'B1 notes updated → Seated Row: % rows', updated_rows;

  -- ── 4b. B2 notes: '... T3 DB Row / ...' → '... T3 Barbell Row / ...' ─────
  --    Also handles intermediate 'Seated Row' state.

  update public.program_days pd
  set notes = replace(replace(pd.notes, 'DB Row', 'Barbell Row'), 'Seated Row', 'Barbell Row')
  where pd.id in (
    select pde2.program_day_id
    from public.program_day_exercises pde2
    join public.program_days pd2 on pd2.id = pde2.program_day_id
    join public.program_weeks pw on pw.id = pd2.program_week_id
    where pw.program_id = prog_id
      and pde2.order_index = 1
      and pde2.exercise_id = ex_deadlift
      and pde2.exercise_type = 'T1'
  );

  get diagnostics updated_rows = row_count;
  raise notice 'B2 notes updated → Barbell Row: % rows', updated_rows;

  -- ── 5. gzcl4-ohp-t3: upright-row → arnold-press ──────────────────────────
  --    Skips silently if upright-row is not in the group (already migrated).

  if ex_upright_row is not null then
    update public.exercise_swap_group_members
    set exercise_id = ex_arnold_press
    where group_slug = 'gzcl4-ohp-t3'
      and exercise_id = ex_upright_row;

    get diagnostics updated_rows = row_count;
    raise notice 'gzcl4-ohp-t3 swap updated (upright-row → arnold-press): % rows', updated_rows;
  else
    raise notice 'upright-row not in exercises — swap group step skipped (ok if already migrated)';
  end if;

  raise notice 'Pull revision v2 complete for gzclp-base-v2-4day.';
end;
$$;

-- ── Verification queries — run after migration ─────────────────────────────
--
-- 1. Pull exercises at pos3, week 1 (should show 4 distinct exercises):
--
-- select pd.day_number, e.slug as exercise_slug, e.name_ja
-- from public.program_day_exercises pde
-- join public.program_days pd    on pd.id = pde.program_day_id
-- join public.program_weeks pw   on pw.id = pd.program_week_id
-- join public.programs p         on p.id  = pw.program_id
-- join public.exercises e        on e.id  = pde.exercise_id
-- where p.slug = 'gzclp-base-v2-4day'
--   and pde.order_index = 3
--   and pw.week_number  = 1
-- order by pd.day_number;
--
-- Expected:
--   day1 → lat-pulldown   (ラットプルダウン)  A1
--   day2 → seated-row     (シーテッドロウ)     B1
--   day3 → lat-pulldown   (ラットプルダウン)  A2
--   day4 → barbell-row    (バーベルロウ)       B2
--
-- 2. OHP swap group (should have no upright-row):
--
-- select group_slug, e.slug, e.name_ja
-- from public.exercise_swap_group_members m
-- join public.exercises e on e.id = m.exercise_id
-- where group_slug = 'gzcl4-ohp-t3'
-- order by e.slug;
--
-- Expected: arnold-press, lateral-raise, rear-delt-fly
--
-- 3. B day notes spot check:
--
-- select pd.day_number, pd.notes
-- from public.program_days pd
-- join public.program_weeks pw on pw.id = pd.program_week_id
-- join public.programs p       on p.id  = pw.program_id
-- where p.slug = 'gzclp-base-v2-4day'
--   and pw.week_number = 1
--   and pd.day_number in (2, 4);
--
-- Expected:
--   day2 notes contains 'Seated Row'  (not 'DB Row', not 'Barbell Row')
--   day4 notes contains 'Barbell Row' (not 'DB Row', not 'Seated Row')
