-- Phase 2.5b: プログラムタグ表示名の日本語化
-- 2026-04-28
-- ⚠️ Supabase ダッシュボード SQL Editor で手動実行してください。
-- slug は変更しません。label（表示名）と description のみ更新します。

UPDATE public.program_tags SET
  label = '筋力アップ',
  description = 'メインリフトの絶対的な筋力向上を主目的とするプログラム。'
WHERE slug = 'strength';

UPDATE public.program_tags SET
  label = '総合フィットネス',
  description = '筋力特化ではなく、全体的な体力・動作品質の向上を目的とするプログラム。'
WHERE slug = 'general-fitness';

UPDATE public.program_tags SET
  label = 'バーベル',
  description = 'バーベル中心の設備を前提とするプログラム。'
WHERE slug = 'barbell';

UPDATE public.program_tags SET
  label = 'ダンベル',
  description = 'ダンベルを主な器具として使用するプログラム。'
WHERE slug = 'dumbbell';

UPDATE public.program_tags SET
  label = '全身',
  description = '各セッションで全身をトレーニングする構成。部位別分割ではない。'
WHERE slug = 'full-body';

UPDATE public.program_tags SET
  label = '上半身 / 下半身',
  description = 'セッションを上半身と下半身に交互に分けた構成。'
WHERE slug = 'upper-lower';

UPDATE public.program_tags SET
  label = 'スクワット重視',
  description = 'スクワットの頻度と量が通常より多いプログラム。'
WHERE slug = 'squat-focus';

UPDATE public.program_tags SET
  label = '爆発系',
  description = 'パワークリーンなど、スピード・パワー系の動作を含むプログラム。'
WHERE slug = 'explosive';

-- 確認クエリ
SELECT slug, label, axis FROM public.program_tags ORDER BY axis, sort_order;
