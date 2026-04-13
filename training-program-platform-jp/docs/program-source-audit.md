# Program Source Audit

最終更新: 2026-04-14（live 反映済み・hold 解除）

## 目的

- 有名プログラムは、まず原典準拠版を正本にする
- 派生版は別 slug / 別 title / 別 metadata で分離する
- live DB 反映は監査完了後に判断し、手動 SQL はこの時点では保留する

## 監査基準

- 元ネタがある場合、期間・頻度・日割り・種目順・セット回数・進行ロジック・リセット条件を勝手に変えない
- 原典の一部フェーズだけを切り出す場合は、title と source metadata で phase を明示する
- 単なる generic split は `custom`
- 元ネタはあるが、内容を意図的に変えている場合は `adapted`

## 監査結果

| slug | title | source_program_name | source_fidelity | 判定 |
|---|---|---|---|---|
| `gzclp-base` | `GZCLP Base` | `GZCLP` | `original` | 原典準拠に修正 |
| `starting-strength-base` | `Starting Strength Phase 2 Base` | `Starting Strength Novice Program - Phase 2` | `original` | Phase 2 原典準拠として明示 |
| `upper-lower-base` | `Upper Lower Base` | `null` | `custom` | 単一原典なしの内部テンプレート |

## Program Notes

### `gzclp-base`

- 元ネタ:
  Cody Lefever, `The GZCL Method` 内の `GZCLP` セクション
- 一致している点:
  - 3 days / week
  - A1 / B1 / A2 / B2 の 4 ワークアウト回転
  - T1 / T2 / T3 の役割分離
  - T1 = 5x3+, T2 = 3x10, T3 = 3x15+
  - T1 fail protocol = `5x3+ -> 6x2+ -> 10x1+ -> 5RM retest`
  - T2 fail protocol = `3x10 -> 3x8 -> 3x6`
- 原典との差分:
  - accessory の選択肢は原典説明より固定化している
  - original article の「その後の個別発展」までは seed に含めていない
- 判定理由:
  上の差分は「初期ベース月間を seed 化するための固定化」で、元の進行ルール自体は変えていないため `original`

### `starting-strength-base`

- 元ネタ:
  Starting Strength Novice Program の Phase 2
- 一致している点:
  - 3 days / week
  - squat every session
  - A / B 交互
  - Day A = deadlift, Day B = power clean
  - novice linear progression 前提
- 原典との差分:
  - program 全体ではなく Phase 2 の切り出し
  - route 互換のため slug は `starting-strength-base` のまま
  - internal implementation 上は `exercise_type` を付けている
- 判定理由:
  内容自体は Phase 2 に合わせ、title と source metadata で phase を明示したため `original`

### `upper-lower-base`

- 元ネタ:
  特定の単一原典なし
- 一致している点:
  - なし。generic upper/lower split の設計慣習を参考にした内部 seed
- 原典との差分:
  - progression / reset / exercise order に対応する canonical source がない
- 判定理由:
  明確な元ネタを持たないため `custom`

## Naming Guidance

- `GZCLP Base`:
  現状のままで可
- `Starting Strength Base`:
  誤解を招くため `Starting Strength Phase 2 Base` に修正
  slug は live route 互換のため現段階では維持
- `Upper Lower Base`:
  title は維持してよいが、必ず `source_fidelity = custom` と `source_notes` を持たせる

## Source Links

- Starting Strength official program page:
  [Starting Strength Training Programs](https://startingstrength.com/article/programs)
- Starting Strength philosophy / NLP context:
  [What is “Starting Strength”?](https://startingstrength.com/contentfiles/what_is_starting_strength.pdf)
- Cody Lefever original GZCL article:
  [The GZCL Method - GZCLP section](https://swoleateveryheight.blogspot.com/2016_02_01_archive.html)
- Boostcamp partnered GZCLP app page:
  [GZCL Program (GZCLP)](https://www.boostcamp.app/coaches/cody-lefever/gzcl-program-gzclp)

## Live Apply Policy

- **live 反映済み（2026-04-14）— hold 解除**
- C-4 / C-5 の live pass を 2026-04-14 に確認し、hold を解除した

### live 反映結果

| slug | live title | Level / Freq / Duration | tags | live 状態 |
|---|---|---|---|---|
| `gzclp-base` | `GZCLP Base` | Beginner / 3 days/week / 4 weeks | Strength / Barbell / Full Body | **pass ✅** |
| `starting-strength-base` | `Starting Strength Phase 2 Base` | Beginner / 3 days/week / 3 weeks | Strength / Barbell / Full Body / Squat Focus | **pass ✅** |
| `upper-lower-base` | `Upper Lower Base` | Intermediate / 4 days/week / 4 weeks | （tags 未表示 — 要確認） | pass（tags 軽微未反映） |

### 軽微な残課題

- `upper-lower-base` の tags バッジが `/programs` 一覧で非表示。program-metadata.sql の upper-lower-base 分の live 適用を次セッションで確認すること
