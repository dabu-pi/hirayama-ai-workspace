-- ============================================================
-- Seed Template: [PROGRAM TITLE]
-- ============================================================
-- 使い方:
--   1. このファイルをコピーして seed/programs/[program-slug].sql として保存
--   2. [PLACEHOLDER] をすべて実際の値に置き換える
--   3. Supabase Dashboard > SQL Editor に貼り付けて実行
--   4. docs/seed-program-guide.md の確認クエリで構造を検証する
--
-- 命名規則:
--   ファイル名 = programs.slug と一致させること
--   例: title = 'Starting Strength Base' → ファイル名 = starting-strength-base.sql
--
-- 参考実装: seed/programs/gzclp-base.sql
-- ============================================================

do $$
declare
  -- ── 種目 UUID ─────────────────────────────────────────────
  -- 使用する種目の数だけ宣言する
  ex_1 uuid;  -- [EXERCISE_1_SLUG]
  ex_2 uuid;  -- [EXERCISE_2_SLUG]
  -- ex_3 uuid;  -- 必要に応じて追加

  -- ── プログラム UUID ───────────────────────────────────────
  prog_id uuid;

  -- ── 週 UUID ───────────────────────────────────────────────
  w1 uuid;
  -- w2 uuid;  -- 複数週の場合は追加
  -- w3 uuid;

  -- ── 日 UUID ───────────────────────────────────────────────
  w1d1 uuid;
  w1d2 uuid;
  -- w1d3 uuid;  -- 週あたりの日数に合わせて追加
  -- w2d1 uuid;

begin
  -- ══════════════════════════════════════════════════════════
  -- 1. exercises（種目）
  --    on conflict (slug) do nothing で既存種目を安全にスキップ
  -- ══════════════════════════════════════════════════════════
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('[EXERCISE_1_SLUG]', '[種目1日本語名]', '[Exercise 1 English Name]', '[category]'),
    ('[EXERCISE_2_SLUG]', '[種目2日本語名]', '[Exercise 2 English Name]', '[category]')
    -- category の例: 'chest' / 'back' / 'legs' / 'shoulders' / 'arms' / 'core'
  on conflict (slug) do nothing;

  -- 種目 UUID を slug から取得
  select id into ex_1 from public.exercises where slug = '[EXERCISE_1_SLUG]';
  select id into ex_2 from public.exercises where slug = '[EXERCISE_2_SLUG]';

  -- ══════════════════════════════════════════════════════════
  -- 2. programs（プログラム本体）
  --    slug が既存なら全体をスキップ（idempotent guard）
  -- ══════════════════════════════════════════════════════════
  if exists (select 1 from public.programs where slug = '[PROGRAM_SLUG]') then
    raise notice '[PROGRAM_SLUG] already exists, skipping.';
    return;
  end if;

  insert into public.programs
    (title, description, duration_weeks, days_per_week, level, is_public)
  values
    (
      '[PROGRAM TITLE]',
      '[プログラムの説明文。一覧のゴール表示と詳細の概要に使われる。]',
      [DURATION_WEEKS],   -- 例: 3（program_weeks の数と一致させること）
      [DAYS_PER_WEEK],    -- 例: 3（各週の program_days 数と一致させること）
      '[LEVEL]',          -- 例: 'beginner' / 'intermediate' / 'advanced'
      true                -- false のままだと /programs に表示されない
    )
  returning id into prog_id;

  -- ══════════════════════════════════════════════════════════
  -- 3. program_weeks（週）
  --    複数行 INSERT の後は SELECT INTO で個別に UUID を取得する
  --    （RETURNING INTO は 1行のみ対応のため）
  -- ══════════════════════════════════════════════════════════
  insert into public.program_weeks (program_id, week_number, label)
  values
    (prog_id, 1, 'Week 1');
    -- 複数週の場合:
    -- (prog_id, 2, 'Week 2'),
    -- (prog_id, 3, 'Week 3');

  select id into w1 from public.program_weeks
    where program_id = prog_id and week_number = 1;
  -- select id into w2 from public.program_weeks
  --   where program_id = prog_id and week_number = 2;

  -- ══════════════════════════════════════════════════════════
  -- 4. program_days（日）
  -- ══════════════════════════════════════════════════════════
  insert into public.program_days (program_week_id, day_number, notes)
  values
    (w1, 1, '[Day 1 の説明。例: Day A: ベンチ + スクワット]'),
    (w1, 2, '[Day 2 の説明。例: Day B: プレス + スクワット]');
    -- (w1, 3, '[Day 3 の説明]');

  select id into w1d1 from public.program_days
    where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days
    where program_week_id = w1 and day_number = 2;
  -- select id into w1d3 from public.program_days
  --   where program_week_id = w1 and day_number = 3;

  -- ══════════════════════════════════════════════════════════
  -- 5. program_day_exercises（種目配置）
  --    exercise_type: 'T1'=主種目 / 'T2'=補助 / 'T3'=アクセサリー
  --    order_index: 1から始め、同じ日で重複しないこと（UNIQUE制約）
  -- ══════════════════════════════════════════════════════════

  -- Week 1 Day 1
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_1, 'T1', [SET_COUNT], '[TARGET_REPS]', 1),
    -- 例: (w1d1, ex_1, 'T1', 5, '5', 1),
    (w1d1, ex_2, 'T1', [SET_COUNT], '[TARGET_REPS]', 2);
    -- 例: (w1d1, ex_2, 'T2', 3, '8-10', 2),

  -- Week 1 Day 2
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d2, ex_1, 'T1', [SET_COUNT], '[TARGET_REPS]', 1),
    (w1d2, ex_2, 'T2', [SET_COUNT], '[TARGET_REPS]', 2);

  -- 週が複数ある場合は同じパターンを繰り返す
  -- （exercise は同じ、set_count / target_reps_text を週ごとに変えることも可）

  raise notice 'Seed complete: program_id = %', prog_id;
end;
$$;

-- ============================================================
-- 確認クエリ（実行後に別タブで確認）
-- [PROGRAM_SLUG] を実際の slug に変えてから実行
-- ============================================================
--
-- SELECT
--   p.slug,
--   pw.week_number,
--   pd.day_number,
--   pde.order_index,
--   e.slug AS exercise_slug,
--   pde.exercise_type,
--   pde.set_count,
--   pde.target_reps_text
-- FROM public.programs p
-- JOIN public.program_weeks pw ON pw.program_id = p.id
-- JOIN public.program_days pd ON pd.program_week_id = pw.id
-- JOIN public.program_day_exercises pde ON pde.program_day_id = pd.id
-- JOIN public.exercises e ON e.id = pde.exercise_id
-- WHERE p.slug = '[PROGRAM_SLUG]'
-- ORDER BY pw.week_number, pd.day_number, pde.order_index;
