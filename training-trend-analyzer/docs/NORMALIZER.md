# NORMALIZER.md

最終更新: 2026-04-08

## 目的

raw text を brand / model / category の canonical へ寄せ、`source_metrics` へ安全に取り込むためのルールを管理します。

最重要方針:

- 推測しすぎない
- 短い alias は慎重に扱う
- ブランド依存の alias は brand hint を残す
- 低信頼 alias は自動ロードしない

## 参照ファイル

- `data/master/brands.json`
- `data/master/categories.json`
- `data/master/models.json`
- `data/master/aliases.json`
- `data/master/aliases_low_confidence.json`

`aliases_low_confidence.json` は保留用メモです。現行 engine はこのファイルを自動ロードしません。

## 現行フロー

1. `normalize_text()` で全角半角・空白・大文字小文字を揃える
2. brand を alias / canonical / prefix で解決する
3. category を alias / canonical / 部分一致で解決する
4. brand hint を使って model を補助解決する
5. confidence と `certainty_label` を計算する
6. unresolved / low confidence は review へ送る

## alias 拡充ルール

追加してよいもの:

- 明確に同義で、誤ヒットしにくい表記ゆれ
- brand を含む model alias
- collector seed として必要な英語 / 日本語のカテゴリ表現

保留するもの:

- 1語でブランドとカテゴリの両方になりうるもの
- 一般名詞として広すぎるもの
- 1回しか出ていないノイズっぽい入力
- discontinued モデルに引っ張られるもの

## review から alias を育てる簡易フロー

1. `python scripts/review_alias_candidates.py` を実行する
2. `data/review/alias_candidates_summary.csv` を確認する
3. `suggested_action=inspect_alias_candidate` だけを候補として再確認する
4. brand scope が必要なら `aliases.json` の model alias に `brand` を付ける
5. 自信が低いものは `aliases_low_confidence.json` に記録して保留する
6. `tests/test_normalizer.py` を再実行する

## 2026-04-08 の判断

### 追加した alias

`data/master/aliases.json`:

- category: `LEG PRESS`, `LEGPRESS`
- category: `HACK SQUAT`, `HACKSQUAT`, `ハックスクワット`
- category: `BELT SQUAT`, `BELTSQUAT`, `ベルトスクワット`
- category: `STAIR CLIMBER`, `STAIRCLIMBER`
- model with brand scope: `CONCEPT2 SKI ERG`, `C2 SKI ERG`

### 追加した category

`data/master/categories.json`:

- `hack_squat`
- `belt_squat`

### 低信頼として分離したもの

`data/master/aliases_low_confidence.json`:

- `STAIRMASTER`
- `STAIR MASTER`

理由:

- StairMaster はブランド名としても使われる
- category alias として自動投入すると brand/category 混同を起こしやすい

### 見送り / 保留

- `XYZ FITNESS PRO 3000`
  理由: unknown brand + 単発モデルの可能性が高く、即 alias 化は危険
- `謎のランニングマシンX`
  理由: ノイズの可能性が高く、再出現待ち
- `TECHNOGYM ARTIS RUN`
  理由: discontinued review を維持
- `スピンバイク`
  理由: category 側で拾えても model 解決には直結しないため、今回の alias 拡充対象とは分離

## 誤判定を防ぐ観点

- `RUN`, `T5`, `IC7` のような短い model token は brand なしで alias を増やさない
- brand 名そのものを category alias として流用しない
- category compare 用 seed から得た raw 観測は、そのまま ranking に入れない
- `certainty_label=LOW / UNKNOWN` の行は review 優先とし、自動 import を増やさない

## 確認ポイント

- alias 追加後に `tests/test_normalizer.py` が通るか
- `review_alias_candidates.py` の summary で保留対象が混ざっていないか
- collector seed 用 alias が DB import 時に unintended remap を起こしていないか
