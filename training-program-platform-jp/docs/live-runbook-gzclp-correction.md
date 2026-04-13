# Live Runbook — GZCLP Base Correction

作成: 2026-04-13  
対象 DB: Supabase (production)  
目的: 既存 `gzclp-base` を原典準拠の 4-week / 3-day base month 構成へ安全に移行する

---

## 背景

監査結果:

| slug | source_fidelity | 備考 |
|---|---|---|
| `gzclp-base` | `original` | 4-week / 3-day base month (12週版ではない) |
| `starting-strength-base` | `original` | Phase 2 snapshot |
| `upper-lower-base` | `custom` | 内製 MVP テンプレート |

`gzclp-base.sql`（初回 seed）は早期終了ガード付きのため、program が既存の場合は構造を更新しない。  
本 runbook の `gzclp-base-live-correction.sql` は **既存 row を対象に構造を上書き** する。

---

## 実行前チェックリスト

- [ ] Supabase Dashboard > SQL Editor を開いている
- [ ] 対象プロジェクトが production であることを確認した
- [ ] `migration 000010` (program_source_metadata) が適用済みであることを確認した
  - 確認 SQL: `select column_name from information_schema.columns where table_name = 'programs' and column_name = 'source_fidelity';`
  - 結果: `source_fidelity` が返ること
- [ ] GitHub `feature/auto-dev-phase3-loop` の最新をローカルに pull した
- [ ] SQL ファイルのパスを確認した: `seed/programs/gzclp-base-live-correction.sql`

---

## 実行順序

### 手順 1: STEP 0 — Pre-check を実行（読み取り専用）

`gzclp-base-live-correction.sql` の `STEP 0` ブロック内のコメントを外して実行する。

```
-- コメントアウト部分（/* ... */）を SQL Editor に貼り付けて実行
-- 期待: gzclp_exists = true
```

**確認ポイント:**

| 項目 | 期待値 | 実際の値 |
|---|---|---|
| `gzclp_exists` | `true` | 記入 |
| `weeks_count` | 任意（修正前の状態） | 記入 |
| `days_count` | 任意 | 記入 |
| `exercises_count` | 任意 | 記入 |
| `active_enrollments` | 理想は `0`（あっても続行可） | 記入 |

`gzclp_exists = false` の場合は **STOP**。まず `gzclp-base.sql` を先に実行する。

---

### 手順 2: pending migrations を適用（未適用の場合のみ）

以下が未適用の場合、この順で適用する。

| ファイル | 内容 | 確認 |
|---|---|---|
| `20260413_000009_program_metadata_foundation.sql` | program_tags / program_tag_assignments テーブル作成 | [ ] |
| `20260413_000010_program_source_metadata.sql` | source_fidelity 列追加 | [ ] |

---

### 手順 3: STEP 1 — Correction Block を実行

`gzclp-base-live-correction.sql` の `begin;` ～ `commit;` ブロックをまるごと SQL Editor に貼り付けて実行する。

**期待する出力（NOTICE）:**

```
NOTICE: GZCLP Base correction complete. program_id = <uuid>
```

アクティブ enrollment がある場合は追加の NOTICE も出る。エラーが出た場合は自動でロールバックされる。

---

### 手順 4: STEP 2 — Post-check を実行（読み取り専用）

`STEP 2` ブロック内のコメントを外して実行する。

**期待値:**

| 項目 | 期待値 |
|---|---|
| `duration_weeks` | 4 |
| `days_per_week` | 3 |
| `level` | beginner |
| `source_fidelity` | original |
| `weeks_count` | 4 |
| `days_count` | 12 |
| `exercises_count` | 36 |

**Rotation 確認:**

| Week | Day | 想定ワークアウト | T1 種目 |
|---|---|---|---|
| 1 | 1 | A1 | Squat |
| 1 | 2 | B1 | Overhead Press |
| 1 | 3 | A2 | Bench Press |
| 2 | 1 | B2 | Deadlift |
| 2 | 2 | A1 | Squat |
| 2 | 3 | B1 | Overhead Press |
| 3 | 1 | A2 | Bench Press |
| 3 | 2 | B2 | Deadlift |
| 3 | 3 | A1 | Squat |
| 4 | 1 | B1 | Overhead Press |
| 4 | 2 | A2 | Bench Press |
| 4 | 3 | B2 | Deadlift |

---

### 手順 5: program-metadata.sql を実行

`seed/programs/program-metadata.sql` を実行する（tags / assignments の upsert）。

**期待する出力（NOTICE）:**

```
NOTICE: Seed complete: program metadata assigned for gzclp-base, starting-strength-base, upper-lower-base.
```

---

### 手順 6: upper-lower-base.sql を実行（upper-lower-base が未作成の場合のみ）

`seed/programs/upper-lower-base.sql` を実行する。

既に作成済みの場合は `NOTICE: upper-lower-base already exists, skipping.` が出て終了する（正常）。

---

### 手順 7: starting-strength-base が存在しない場合

`seed/programs/starting-strength-base.sql` を実行する（初回 seed 未実施の場合のみ）。

---

## ブラウザ確認（live）

手順 1〜6 完了後に https://training-program-platform-jp.vercel.app/programs を確認する。

| 確認項目 | 期待値 |
|---|---|
| GZCLP Base が表示される | ✅ |
| Beginner バッジが表示される | ✅ |
| `Strength / Barbell / Full Body` タグが表示される | ✅ |
| Starting Strength Phase 2 Base が表示される | ✅ |
| `Squat Focus / Explosive` タグが表示される | ✅ |
| Upper Lower Base が表示される | ✅ |
| Intermediate バッジ + `Upper / Lower` タグが表示される | ✅ |
| Level フィルター: Beginner（2件）/ Intermediate（1件）で絞り込める | ✅ |

---

## ロールバック観点

| 失敗箇所 | 影響 | 対処 |
|---|---|---|
| STEP 1 でエラー | トランザクションが自動ロールバック。DB は変更なし | エラーメッセージを確認してから再実行 |
| STEP 1 は成功、program-metadata.sql でエラー | gzclp の構造は正しい状態。tags/assignments が不整合の可能性 | program-metadata.sql を単独で再実行（upsert / delete-reinsert のため安全） |
| 全手順完了後に表示が崩れる | — | Pre/Post-check の内容をもとに手動確認し、Supabase Dashboard で直接 SELECT して切り分ける |

---

## 全体 SQL 実行順まとめ

```
1. gzclp-base-live-correction.sql   STEP 0（pre-check、読み取り専用）
2. gzclp-base-live-correction.sql   STEP 1（correction、トランザクション）
3. gzclp-base-live-correction.sql   STEP 2（post-check、読み取り専用）
4. program-metadata.sql             （tags / assignments upsert）
5. upper-lower-base.sql             （上位 lower-base が未作成の場合のみ）
   ※ starting-strength-base は既存なら不要
```

> `starting-strength-base.sql` は初回 seed 済みであれば skip。  
> migration (000009 / 000010) が未適用の場合は手順 2 で先に流す。
