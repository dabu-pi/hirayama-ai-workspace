-- 利用者向け日本語化: プログラム名・説明文の更新
-- 2026-04-28 日本語化対応
-- ⚠️ Supabase ダッシュボード SQL Editor で手動実行してください。
-- slug は変更しません。表示名・説明文のみ更新します。

-- BIG3 2-Day
UPDATE public.programs
SET
  title = 'BIG3 2日/週（4週）',
  description = 'スクワット・ベンチプレス・デッドリフトの3種目で構成するローテーション型の週2日プログラム。A/B/Cの3サイクルを順番に回し、各種目がT1・T2・T3を均等に担当します。'
WHERE slug = 'big3-2day';

-- BIG3 3-Day
UPDATE public.programs
SET
  title = 'BIG3 3日/週（4週）',
  description = 'スクワット・ベンチプレス・デッドリフトの3種目に集中し、基礎筋力を効率よく構築するローテーション型の週3日プログラム。T1・T2・T3を日替わりで割り当て、全種目を均等に強化します。'
WHERE slug = 'big3-3day';

-- BIG3 2-Day 6-Week
UPDATE public.programs
SET
  title = 'BIG3 2日/週（6週）',
  description = '6週間でBIG3の全順列（A〜F）を2周する完全対称設計の週2日プログラム。各種目がT1・T2・T3をそれぞれ4回ずつ均等に担当します。'
WHERE slug = 'big3-2day-6week';

-- GZCLP Base
UPDATE public.programs
SET
  title = 'GZCLP 基礎プログラム',
  description = 'Cody LefeverオリジナルのGZCLP基礎月。週3日でA1/B1/A2/B2を4週間循環し、T1/T2/T3の漸進モデルで筋力と筋量を伸ばします。バーベルトレーニング初心者に最適です。'
WHERE slug = 'gzclp-base';

-- GZCLP Base v2 4-Day
UPDATE public.programs
SET
  title = 'GZCLP 基礎 4日/週（4週）'
WHERE slug = 'gzclp-base-v2-4day';

-- Barbell 2-Day Full Body Base
UPDATE public.programs
SET
  title = 'バーベル全身 2日/週（4週）'
WHERE slug = 'barbell-2day-base';

-- Starting Strength Base
UPDATE public.programs
SET
  title = 'スターティングストレングス 基礎'
WHERE slug = 'starting-strength-base';

-- Upper Lower Base
UPDATE public.programs
SET
  title = 'アッパー/ロワー 基礎'
WHERE slug = 'upper-lower-base';

-- Dumbbell Full Body Base
UPDATE public.programs
SET
  title = 'ダンベル全身 基礎'
WHERE slug = 'dumbbell-full-body-base';

-- 確認クエリ
SELECT slug, title FROM public.programs WHERE is_public = true ORDER BY slug;
