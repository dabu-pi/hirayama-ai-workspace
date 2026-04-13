# プログラム追加ガイド（seed 運用ルール）

作成: 2026-04-13 / 対象ブランチ: feature/auto-dev-phase3-loop

---

## 目的

このドキュメントを読めば、2本目以降のプログラムを迷わず追加できる状態にする。

- 既存プログラム（GZCLP Base）を壊さずに新しいプログラムを追加する
- Claude・人間どちらが書いても同じ構造になる

---

## ファイル配置

```
seed/
└── programs/
    ├── gzclp-base.sql          ← 既存（参考実装）
    ├── _template.sql           ← 新規作成時のテンプレート
    └── [program-slug].sql      ← 2本目以降はここに追加
```

**ルール:**
- ファイル名は `programs.slug` と一致させる（例: `starting-strength-base.sql`）
- `seed/programs/` 配下のみ。`supabase/migrations/` には入れない
- migration はスキーマ変更用。プログラムデータ追加はすべて `seed/programs/` に置く

---

## 追加順序（必ずこの順で INSERT する）

```
1. exercises          ← 種目（複数プログラム共有。on conflict do nothing で安全）
2. programs           ← プログラム本体（slug 重複チェックで idempotent に）
3. program_weeks      ← 週（program_id を使うため 2 の後）
4. program_days       ← 日（program_week_id を使うため 3 の後）
5. program_day_exercises ← 種目配置（program_day_id / exercise_id を使うため 4 の後）
```

外部キー制約があるため順序を変えると INSERT が失敗する。

---

## テーブル構造と制約（追加時に守る項目）

### `exercises`

| 列 | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() | 自動生成 |
| `slug` | text | UNIQUE NOT NULL | 識別子。`on conflict (slug) do nothing` で安全に共有 |
| `name_ja` | text | NOT NULL | 日本語名 |
| `name_en` | text | NOT NULL | 英語名 |
| `category` | text | NULL OK | `chest` / `legs` / `back` / `shoulders` など任意 |

→ exercises はプログラム間で共有される。新しいプログラムで同じ種目を使う場合は再 INSERT 不要（`on conflict do nothing` が安全に無視する）。

### `programs`

| 列 | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | uuid | PK, 自動生成 | |
| `slug` | text | UNIQUE NOT NULL | trigger `trg_programs_assign_slug` が title から自動生成。明示指定も可 |
| `title` | text | NOT NULL | 表示名 |
| `description` | text | NULL OK | 一覧・詳細のゴール文・概要として使われる |
| `duration_weeks` | integer | > 0 | program_weeks の数と一致させること |
| `days_per_week` | integer | > 0 | 各週の program_days 数と一致させること |
| `level` | text | NULL OK | `beginner` / `intermediate` / `advanced` |
| `is_public` | boolean | NOT NULL default false | **`true` にしないと `/programs` 一覧に表示されない** |

**slug の扱い:**
- INSERT 時に `slug` を省略（または空文字）すると、trigger が `title` から自動生成する
  - 例: `'Starting Strength Base'` → `starting-strength-base`
- slug を明示したい場合は INSERT に含める（trigger が一意性を保証する）
- **推奨: seed ファイルの idempotent チェックには slug を使う**

### `program_weeks`

| 列 | 型 | 制約 | 説明 |
|---|---|---|---|
| `program_id` | uuid | FK → programs.id ON DELETE CASCADE | |
| `week_number` | integer | > 0, UNIQUE(program_id, week_number) | 1, 2, 3 … |
| `label` | text | NULL OK | 表示用ラベル。`'Week 1'` など |

### `program_days`

| 列 | 型 | 制約 | 説明 |
|---|---|---|---|
| `program_week_id` | uuid | FK → program_weeks.id ON DELETE CASCADE | |
| `day_number` | integer | > 0, UNIQUE(program_week_id, day_number) | 1, 2, 3 … |
| `notes` | text | NULL OK | トレーニング画面の下部に表示されるノート |
| `progression_guide` | text | NULL OK | 重量進捗ガイド |

### `program_day_exercises`

| 列 | 型 | 制約 | 説明 |
|---|---|---|---|
| `program_day_id` | uuid | FK → program_days.id ON DELETE CASCADE | |
| `exercise_id` | uuid | FK → exercises.id ON DELETE RESTRICT | |
| `exercise_type` | text | `'T1'` / `'T2'` / `'T3'` のみ | T1=主種目, T2=補助, T3=アクセサリー |
| `set_count` | integer | > 0 | セット数（train 画面で初期 set を seed するのに使われる） |
| `target_reps_text` | text | NULL OK | `'5'` / `'5-8'` / `'AMRAP'` など文字列 |
| `order_index` | integer | > 0, UNIQUE(program_day_id, order_index) | 表示順。1 から始める。重複不可 |

---

## slug と UUID の参照方針

**UUID を seed ファイルにハードコードしない。**

代わりに PL/pgSQL の `do $$ ... $$` ブロックで変数に格納して参照する。

```sql
do $$
declare
  prog_id uuid;
  w1 uuid;
  w1d1 uuid;
begin
  -- prog_id は program INSERT 後に SELECT INTO で取得
  insert into public.programs (...) returning id into prog_id;

  -- w1 は week INSERT 後に SELECT INTO で取得
  insert into public.program_weeks (program_id, week_number, label)
  values (prog_id, 1, 'Week 1');
  select id into w1 from public.program_weeks
    where program_id = prog_id and week_number = 1;

  -- w1d1 は day INSERT 後に SELECT INTO で取得
  ...
end;
$$;
```

**理由:**
- UUID は環境ごとに異なる（ローカル ≠ live Supabase）
- slug / (program_id + week_number) / (week_id + day_number) の組み合わせは一意なので安全
- `RETURNING INTO` は1行 INSERT のみ対応。複数行 INSERT 後は `SELECT INTO` を使う

---

## exercises の共有ルール

exercises テーブルは複数プログラムで共有される。

```sql
-- 安全な書き方（既存があっても上書きしない）
insert into public.exercises (slug, name_ja, name_en, category)
values ('squat', 'スクワット', 'Squat', 'legs')
on conflict (slug) do nothing;

-- 既存 exercise を参照するには slug から SELECT する
select id into ex_squat from public.exercises where slug = 'squat';
```

**ルール:**
- exercises は追加のみ。既存 exercise のデータを変更しない
- 新種目を追加する場合は slug を事前に決めてから INSERT する

---

## Idempotent 設計（2回実行しても壊れない）

seed ファイルは Supabase SQL Editor に複数回貼り付けても安全でなければならない。

```sql
-- program が既存なら全体をスキップ
if exists (select 1 from public.programs where slug = 'my-program-slug') then
  raise notice 'my-program-slug already exists, skipping.';
  return;
end if;
```

**ポイント:**
- program の重複チェックは `slug` ベースで行う（UUID は使わない）
- exercises は `on conflict (slug) do nothing` で自動的に idempotent
- weeks / days / program_day_exercises は program が存在すれば同じプログラムの2重実行は上の return で防がれる
- 部分的に失敗した場合（program は作られたが weeks が未完成など）は、Supabase SQL Editor で手動削除してから再実行する

---

## ローカル反映手順（Supabase Dashboard）

```
1. Supabase Dashboard → SQL Editor を開く
2. seed/programs/[program-slug].sql の内容をコピー
3. SQL Editor に貼り付けて Run を押す
4. 「Seed complete: program_id = ...」の NOTICE メッセージを確認
5. 確認クエリ（下記）を別途実行して構造を確認する
```

**ローカル Supabase CLI 経由の場合（任意）:**
```bash
psql $DATABASE_URL -f seed/programs/[program-slug].sql
```

---

## 確認クエリ（適用後に必ず実行）

```sql
-- 1. プログラム一覧確認
select id, slug, title, level, is_public, duration_weeks, days_per_week
from public.programs
order by created_at desc;

-- 2. weeks / days 構造確認
select
  p.slug as program_slug,
  pw.week_number,
  pd.day_number,
  pd.id as day_id,
  pd.notes
from public.programs p
join public.program_weeks pw on pw.program_id = p.id
join public.program_days pd on pd.program_week_id = pw.id
where p.slug = 'YOUR-PROGRAM-SLUG'
order by pw.week_number, pd.day_number;

-- 3. program_day_exercises 確認
select
  p.slug as program_slug,
  pw.week_number,
  pd.day_number,
  pde.order_index,
  e.slug as exercise_slug,
  pde.exercise_type,
  pde.set_count,
  pde.target_reps_text
from public.programs p
join public.program_weeks pw on pw.program_id = p.id
join public.program_days pd on pd.program_week_id = pw.id
join public.program_day_exercises pde on pde.program_day_id = pd.id
join public.exercises e on e.id = pde.exercise_id
where p.slug = 'YOUR-PROGRAM-SLUG'
order by pw.week_number, pd.day_number, pde.order_index;
```

---

## アプリへの反映タイミング

seed を Supabase に適用した時点で、即座にアプリに反映される。

- `/programs` 一覧: `getProgramLibrary()` が `WHERE is_public = true ORDER BY created_at DESC` でクエリ。**新しいプログラムが先頭に表示される**
- `/programs/[slug]`: `findProgramBySlug()` が slug で検索。seed の slug と URL の slug が一致すること
- Train 導線: `findFirstProgramDayId()` が `week_number=1 AND day_number=1` の UUID を解決
- `lib/programs/program-catalog.ts` の mock catalog には追加不要（Supabase 接続時は無視される）

---

## 失敗しやすい点

| 症状 | 原因 | 対処 |
|---|---|---|
| `/programs` に表示されない | `is_public = false` のまま | `UPDATE programs SET is_public = true WHERE slug = '...'` |
| seed を再実行したら週・日が重複した | idempotent guard が効いていない | program の slug を先に確認。必要なら手動削除して再実行 |
| INSERT error: duplicate key on `order_index` | `program_day_exercises` の `order_index` が同じ日に重複 | 各日の order_index を 1, 2, 3 … で一意にする |
| 週・日の構造は正しいが train 画面で種目が出ない | `program_day_exercises` がない or `week_number=1/day_number=1` がない | 確認クエリ 3 で exercises の配置を確認 |
| slug が期待と違う | title に記号が含まれ trigger が変換した | seed の idempotent 条件で使う slug を `SELECT slug FROM programs WHERE title = '...'` で確認してから修正 |
| `SELECT id INTO` で UUID が null になる | 前のステップの INSERT が失敗または do nothing で無視された | SQL Editor の出力メッセージ・NOTICE を確認。上の INSERT を単独実行してデバッグ |

---

## 既存プログラムを壊さない更新方針

| 操作 | 方針 |
|---|---|
| 新プログラムを追加 | 別の slug で新規 seed。既存には触れない |
| 既存プログラムのタイトル・説明を変更 | SQL Editor で `UPDATE programs SET ... WHERE slug = '...'` を手動実行 |
| 既存プログラムの週・日・種目を変更 | **原則禁止**（進行中の enrollment が壊れる）。新プログラムとして追加が安全 |
| 既存プログラムを非公開にする | `UPDATE programs SET is_public = false WHERE slug = '...'` |
| 既存プログラムを削除する | ON DELETE CASCADE が効くため program を削除すると weeks/days/day_exercises も消える。enrollment・session には影響しない（ON DELETE SET NULL / RESTRICT）。**要注意** |

---

## 参照ファイル

| ファイル | 内容 |
|---|---|
| `seed/programs/gzclp-base.sql` | 参考実装（3週 × 3日 × T1種目のみ） |
| `seed/programs/_template.sql` | 新規追加用テンプレート |
| `supabase/migrations/20260411_000001_initial_schema.sql` | 全テーブル定義 |
| `supabase/migrations/20260412_000002_programs_slug_source_of_truth.sql` | slug trigger / 採番ロジック |
| `lib/programs/program-library.ts` | アプリの programs 読込ロジック |
| `lib/programs/program-catalog.ts` | mock catalog（Supabase 未接続時のフォールバック） |
