# program-metadata-design

最終更新: 2026-04-13

## 目的

- `/programs` 一覧で複数プログラムを比較しやすくする
- 3本目以降の追加前に `level` と tag の正本方針を固定する
- 実装時に「DB とコードのどちらを正本にするか」でぶれない状態を作る

## 現状の課題

- 現在の `/programs` card は `title / level / goal / frequency / duration` だけで、同系統プログラムが増えると差分が見えにくい
- `programs.level` は free text に近く、UI 側では先頭大文字化しているだけで語彙が固定されていない
- `goal` は description 先頭文の切り出しに依存しており、比較軸というより説明文の代用になっている
- `days_per_week` と `duration_weeks` はすでに DB にあるため、同じ情報を tag として重複管理するとノイズになる
- mock catalog 側にもメタ情報があるため、今後 metadata をコード側だけで増やすと live DB と乖離しやすい

## level 方針

### 結論

- DB 正本の canonical value は `beginner / intermediate / advanced` の 3 段階に固定する
- UI 表示は `Beginner / Intermediate / Advanced` の chip 表示を基本にする
- 現在の `Beginner` 表示は継続してよいが、今後は seed 追加時に canonical value 以外を入れない

### `novice` を今は採用しない理由

- `beginner` と `novice` の境界が実装者にも利用者にも伝わりにくい
- 現在の live program 2 本はどちらも「初心者向け linear progression」であり、無理に分けると説明コストだけが増える
- 比較しやすさは level の細分化より tag と説明文の整理で補うほうが自然

### level の定義

| 値 | 意味 |
|---|---|
| `beginner` | 初回の構造化プログラム導入向け。種目数・判断負荷が低く、進行ルールが単純 |
| `intermediate` | 基本種目経験があり、負荷調整や週内の役割分担を理解して進められる |
| `advanced` | 回復管理や長期周期化を前提にし、自己調整の比重が高い |

### UI ルール

- list card では level を短い chip で表示する
- detail でも同じ表記を使い、別名を増やさない
- 不明値は暫定で raw 表示せず、実装時に canonical value へ正規化してから表示する

## tag 軸の素案

### 設計原則

- tag は「比較に効く軸」だけに絞る
- `level / days_per_week / duration_weeks` と重複する情報は tag にしない
- list card に出す tag は 2〜3 個までに制限する
- 1 program あたり required 3 軸 + optional 0〜2 個を上限にする

### 採用する tag 軸

| 軸 | 必須/任意 | 形式 | 候補 |
|---|---|---|---|
| goal | 必須 | 単一選択 | `strength`, `hypertrophy`, `general-fitness` |
| equipment | 必須 | 単一選択 | `barbell`, `dumbbell`, `bodyweight`, `machine`, `mixed` |
| split | 必須 | 単一選択 | `full-body`, `upper-lower`, `push-pull-legs`, `custom` |
| focus | 任意 | 複数選択 | `explosive`, `squat-focus`, `time-efficient`, `technique-demanding` |

### 採用しない tag

- `beginner-friendly`
  - `level` と重複するため
- `3 days / week`, `4 days / week`
  - `days_per_week` と重複するため
- `3 weeks`, `12 weeks`
  - `duration_weeks` と重複するため
- 種目ごとの細かすぎる tag
  - 例: `bench-twice`, `deadlift-once`, `press-rotation`
  - 現段階では一覧比較より説明文の仕事

## DB で持つか、コードで持つか

### 結論

- `level` は引き続き `programs.level` を正本にする
- tag は最終的に DB 正本で持つ
- code 側の mock catalog は fallback 用であり、metadata の正本にしない

### 推奨実装形

- `program_tags`
  - `id`, `slug`, `label`, `tag_group`, `sort_order`, `is_active`
- `program_tag_assignments`
  - `program_id`, `tag_id`

### この形を推す理由

- seed と一緒に別環境へ再投入しやすい
- `/programs` 一覧、詳細、将来の filter で同じ正本を参照できる
- 3本目以降を追加してもコード側の分散管理を避けられる

## 既存 2 本への仮割り当て

| program | level | required tags | optional tags | 比較メモ |
|---|---|---|---|---|
| `gzclp-base` | `beginner` | `strength`, `barbell`, `full-body` | なし | ベンチ/プレス/デッドリフトを回しながら進める基礎導入枠 |
| `starting-strength-base` | `beginner` | `strength`, `barbell`, `full-body` | `squat-focus`, `explosive` | スクワット毎回、A/B 交互、Power Clean を含むクラシック寄り構成 |

## 実装優先順位

1. `programs.level` の canonical value を UI で明示的に map する
2. tag schema を追加し、`gzclp-base` と `starting-strength-base` に metadata を投入する
3. `/programs` list card に required tags から 2 個 + optional tag 1 個まで表示する
4. detail page に full tag 表示を追加する
5. filter / sort は program 本数が増えてから検討する

## 実装メモ

- `/programs` 一覧の比較は `level + frequency + duration + tags` を主軸にする
- 説明文は tag で表現しきれない差分を補う用途に残す
- 現在の 2 本は level も required tags も重なるため、差分は description と optional tag で補助する
- 実装時は `program-library.ts` の `toDisplayLevel()` を単純 capitalize から明示 map に切り替える
