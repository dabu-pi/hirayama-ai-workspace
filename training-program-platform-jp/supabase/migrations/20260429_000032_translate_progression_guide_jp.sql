-- migrate: 20260429_000032
-- purpose: progression_guide / notes の英語表記を日本語に置換する
-- 対象: gzclp-base, gzclp-base-v2, gzclp-base-v2-4day, gzclp-base-live-correction, starting-strength-base
-- 方針: program slug を経由して program_days を特定し、英語テキストに完全一致する行のみ更新する

do $$
declare
  rows_updated integer := 0;
begin

  -- =========================================================================
  -- 1. gzclp-base-live-correction / gzclp-base-v2 / gzclp-base-v2-4day
  --    共通パターン: "A1 — T1 Squat: 5×3+ → ..." 形式
  -- =========================================================================

  -- スクワット中心の日 (A1 pattern)
  update public.program_days pd
  set
    progression_guide = 'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug in ('gzclp-base-v2', 'gzclp-base-v2-4day', 'gzclp-base-live-correction')
    and pd.progression_guide = 'A1 — T1 Squat: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Bench: 3×10 → 3×8 → 3×6. T3: add weight when final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp A1 progression_guide updated: % rows', rows_updated;

  -- gzclp-base-live-correction 専用: T3 Lat Pulldown 付き
  update public.program_days pd
  set
    progression_guide = 'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base-live-correction'
    and pd.progression_guide = 'A1 — T1 Squat: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Bench: 3×10 → 3×8 → 3×6. T3 Lat Pulldown: add weight when final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp-live A1 (Lat Pulldown) progression_guide updated: % rows', rows_updated;

  -- プレス中心の日 (B1 pattern)
  update public.program_days pd
  set
    progression_guide = 'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug in ('gzclp-base-v2', 'gzclp-base-v2-4day', 'gzclp-base-live-correction')
    and pd.progression_guide = 'B1 — T1 Press: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Deadlift: 3×10 → 3×8 → 3×6. T3: add weight when final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp B1 progression_guide updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base-live-correction'
    and pd.progression_guide = 'B1 — T1 Press: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Deadlift: 3×10 → 3×8 → 3×6. T3 DB Row: add weight when final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp-live B1 (DB Row) progression_guide updated: % rows', rows_updated;

  -- ベンチプレス中心の日 (A2 pattern)
  update public.program_days pd
  set
    progression_guide = 'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug in ('gzclp-base-v2', 'gzclp-base-v2-4day', 'gzclp-base-live-correction')
    and pd.progression_guide = 'A2 — T1 Bench: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Squat: 3×10 → 3×8 → 3×6. T3: add weight when final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp A2 progression_guide updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base-live-correction'
    and pd.progression_guide = 'A2 — T1 Bench: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Squat: 3×10 → 3×8 → 3×6. T3 Lat Pulldown: add weight when final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp-live A2 (Lat Pulldown) progression_guide updated: % rows', rows_updated;

  -- デッドリフト中心の日 (B2 pattern)
  update public.program_days pd
  set
    progression_guide = 'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug in ('gzclp-base-v2', 'gzclp-base-v2-4day', 'gzclp-base-live-correction')
    and pd.progression_guide = 'B2 — T1 Deadlift: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Press: 3×10 → 3×8 → 3×6. T3: add weight when final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp B2 progression_guide updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base-live-correction'
    and pd.progression_guide = 'B2 — T1 Deadlift: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Press: 3×10 → 3×8 → 3×6. T3 DB Row: add weight when final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp-live B2 (DB Row) progression_guide updated: % rows', rows_updated;

  -- =========================================================================
  -- 2. gzclp-base (旧フォーマット: "->" 形式)
  -- =========================================================================

  update public.program_days pd
  set
    progression_guide = 'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3 ラットプルダウンは最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base'
    and pd.progression_guide = 'A1 progression: T1 squat 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 bench 3x10 -> 3x8 -> 3x6. T3 lat pulldown adds weight when the final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp-base A1 (old format) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3 ダンベルローは最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base'
    and pd.progression_guide = 'B1 progression: T1 press 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 deadlift 3x10 -> 3x8 -> 3x6. T3 dumbbell row adds weight when the final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp-base B1 (old format) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3 ラットプルダウンは最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base'
    and pd.progression_guide = 'A2 progression: T1 bench 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 squat 3x10 -> 3x8 -> 3x6. T3 lat pulldown adds weight when the final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp-base A2 (old format) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3 ダンベルローは最終セットが25回できたら次回から重量を増やします。'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base'
    and pd.progression_guide = 'B2 progression: T1 deadlift 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 press 3x10 -> 3x8 -> 3x6. T3 dumbbell row adds weight when the final set reaches 25 reps.';
  get diagnostics rows_updated = row_count;
  raise notice 'gzclp-base B2 (old format) updated: % rows', rows_updated;

  -- =========================================================================
  -- 3. gzclp-base / gzclp-base-v2 / gzclp-base-v2-4day / gzclp-base-live-correction
  --    notes カラムの英語表記を日本語に置換
  -- =========================================================================

  -- gzclp-base の notes (旧フォーマット)
  update public.program_days pd
  set notes = 'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン 3×15+'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base'
    and pd.notes = 'A1: T1 Squat 5x3+, T2 Bench Press 3x10, T3 Lat Pulldown 3x15+';

  update public.program_days pd
  set notes = 'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 ダンベルロー 3×15+'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base'
    and pd.notes = 'B1: T1 Overhead Press 5x3+, T2 Deadlift 3x10, T3 Dumbbell Row 3x15+';

  update public.program_days pd
  set notes = 'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン 3×15+'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base'
    and pd.notes = 'A2: T1 Bench Press 5x3+, T2 Squat 3x10, T3 Lat Pulldown 3x15+';

  update public.program_days pd
  set notes = 'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 ダンベルロー 3×15+'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base'
    and pd.notes = 'B2: T1 Deadlift 5x3+, T2 Overhead Press 3x10, T3 Dumbbell Row 3x15+';

  -- gzclp-base-live-correction の notes
  update public.program_days pd
  set notes = 'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン 3×15+'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base-live-correction'
    and pd.notes = 'A1: T1 Squat 5×3+, T2 Bench Press 3×10, T3 Lat Pulldown 3×15+';

  update public.program_days pd
  set notes = 'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 ダンベルロー 3×15+'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base-live-correction'
    and pd.notes = 'B1: T1 Overhead Press 5×3+, T2 Deadlift 3×10, T3 Dumbbell Row 3×15+';

  update public.program_days pd
  set notes = 'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン 3×15+'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base-live-correction'
    and pd.notes = 'A2: T1 Bench Press 5×3+, T2 Squat 3×10, T3 Lat Pulldown 3×15+';

  update public.program_days pd
  set notes = 'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 ダンベルロー 3×15+'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'gzclp-base-live-correction'
    and pd.notes = 'B2: T1 Deadlift 5×3+, T2 Overhead Press 3×10, T3 Dumbbell Row 3×15+';

  -- =========================================================================
  -- 4. starting-strength-base の progression_guide + notes
  -- =========================================================================

  update public.program_days pd
  set
    progression_guide = 'Day A — 各セッションでフォームを保てる範囲で重量を増やすことを目標にします。スクワットとベンチプレスは2.5kg、デッドリフトは5kg刻みで増やします。回数が安定して達成できているうちは毎回重量を上げ続けます。',
    notes             = 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Day A progression: add weight every workout while 3x5 squat and bench stay solid. Deadlift adds 5-10 lb while 1x5 remains technically sound.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength Day A (first) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'Day B — スクワットは毎回行い、オーバーヘッドプレスも正しいフォームを保ちながら少しずつ重量を増やします。パワークリーンはバーのスピードとフォームが維持できている間だけ重量を増やします。',
    notes             = 'Day B: スクワット 3×5、オーバーヘッドプレス 3×5、パワークリーン 5×3'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Day B progression: add weight every workout while 3x5 squat and press stay solid. Power clean adds weight only while bar speed and technique stay crisp.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength Day B (first) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'Day A（繰り返し）— スクワット・ベンチプレス・デッドリフトの3種目を引き続き行います。A/Bを交互に繰り返すことで、ベンチプレスとオーバーヘッドプレスが均等に強化されます。',
    notes             = 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Repeat Day A. This seed captures the official Phase 2 A/B cadence, not the earlier Phase 1 deadlift-every-session setup.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength repeat Day A (Phase2 note) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'Day B（繰り返し）— スクワットは毎回行い、上半身のプレス種目をベンチとオーバーヘッドで交互に担当します。無理なく記録を伸ばしていきましょう。',
    notes             = 'Day B: スクワット 3×5、オーバーヘッドプレス 3×5、パワークリーン 5×3'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Repeat Day B. Keep the squat every session and alternate the upper-body press between bench and overhead press.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength repeat Day B (alternate) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'Day A（繰り返し）— ベンチプレスの重量増加幅が大きく感じたら、プレートを細かく分けてマイクロロードを使うことも選択肢のひとつです。',
    notes             = 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Repeat Day A. Microload bench if 5 lb jumps become too large.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength repeat Day A (microload) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'Day B（繰り返し）— スクワットは引き続き毎回行います。フェーズ2ではパワークリーンをデッドリフトの代わりに使い、全身の連動性を高めます。',
    notes             = 'Day B: スクワット 3×5、オーバーヘッドプレス 3×5、パワークリーン 5×3'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Repeat Day B. Power clean is used here because deadlifting three times per week is no longer the Phase 2 standard.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength repeat Day B (power clean) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'Day A（繰り返し）— 回復ができている間は毎回重量を増やし続けます。フォームが崩れてきたら重量を少し落として立て直しましょう。',
    notes             = 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Repeat Day A. Continue linear progression workout to workout while recovery supports it.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength repeat Day A (linear) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'Day B（繰り返し）— プレスやパワークリーンの伸びが鈍くなってきたら、増加幅を小さくして継続します。焦らず積み上げることが大切です。',
    notes             = 'Day B: スクワット 3×5、オーバーヘッドプレス 3×5、パワークリーン 5×3'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Repeat Day B. Use smaller jumps on the press or power clean as needed.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength repeat Day B (smaller jumps) updated: % rows', rows_updated;

  update public.program_days pd
  set
    progression_guide = 'Day A（繰り返し）— この3週間のプログラムは線形漸進フェーズの基礎スナップショットです。ここで培った土台をもとに次のフェーズへと進みます。',
    notes             = 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'
  from public.program_weeks pw
  join public.programs p on p.id = pw.program_id
  where pd.program_week_id = pw.id
    and p.slug = 'starting-strength-base'
    and pd.progression_guide = 'Repeat Day A. This 3-week seed is a reusable base snapshot of Phase 2, not the entire novice lifecycle.';
  get diagnostics rows_updated = row_count;
  raise notice 'starting-strength repeat Day A (snapshot) updated: % rows', rows_updated;

end $$;
