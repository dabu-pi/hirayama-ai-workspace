-- migrate: 20260429_000034
-- purpose: programs テーブルの description（goal/overview の元データ）を日本語化する
-- 対象: gzclp-base-v2, gzclp-base-v2-4day
--   gzclp-base は update-program-titles-jp.sql で既に更新済み
--   gzclp-base-live-correction.sql にも同内容を含む
-- 方針: slug + 旧英語テキストに完全一致する行のみ UPDATE（全件上書きしない）

-- ── gzclp-base-v2 ─────────────────────────────────────────────────────────

update public.programs
set
  title       = 'GZCLP 基礎プログラム（改良版）',
  description = '週3日で全身をしっかり鍛える改良版GZCLPプログラムです。T1のメイン種目で重さを伸ばし、T2の補助種目でフォームと基礎筋力を高め、T3のアクセサリー種目で弱点補強や筋肉量アップを狙います。種目の入れ替えに対応しており、バリエーションを持たせながら継続できます。'
where slug = 'gzclp-base-v2'
  and description = 'GZCLP base month extended to 5 exercises per session. The original A1/B1/A2/B2 rotation and T1/T2/T3 tier structure are preserved; each session adds a T1-support and T2-support T3 accessory alongside the fixed pull slot.';

-- ── gzclp-base-v2-4day ───────────────────────────────────────────────────

update public.programs
set
  title       = 'GZCLP 基礎 4日/週（4週）',
  description = '週4回で全身をしっかり鍛えるGZCLPプログラムです。T1のメイン種目で重さを伸ばし、T2の補助種目でフォームと基礎筋力を高め、T3のアクセサリー種目で弱点補強や筋肉量アップを狙います。無理に重量を上げるのではなく、決められた回数を丁寧にこなしながら、少しずつ成長していく内容です。'
where slug = 'gzclp-base-v2-4day'
  and description = 'Full A1/B1/A2/B2 cycle completed every week at 4 days per week. Each session has 5 exercises: T1 main lift, T2 practice, fixed back pull, and two movement-family T3 accessories selectable from 3 focused candidates.';

-- 確認クエリ（コメントアウト。必要時に手動実行）
-- select slug, title, left(description, 60) as description_head
-- from public.programs
-- where slug in ('gzclp-base', 'gzclp-base-v2', 'gzclp-base-v2-4day')
-- order by slug;
