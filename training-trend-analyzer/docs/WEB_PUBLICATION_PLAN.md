# WEB_PUBLICATION_PLAN.md

最終更新: 2026-04-09

## 1. 目的

この文書は、`training-trend-analyzer` の外部向け目的を明文化するための補助文書です。

このプロジェクトの外部向け目的は、ジムオーナー、トレーニー、業界関係者が市場トレンドや注目マシン動向を把握できるよう、Web で継続発信できる情報基盤を作ることです。

ここでいう「公開」は、内部の ranking / compare / review 結果をそのまま出すことではありません。review 済みで source health が確認された結果だけを、公開向けに再構成して出すことを意味します。

## 2. 公開対象

- ジムオーナー
  導入・更新候補の市場感や注目カテゴリを把握したい人
- トレーニー
  どのマシン系統が注目されているか、どのカテゴリが伸びているかを知りたい人
- 業界関係者
  週次の市場変化、注目カテゴリ、機種群の動向を俯瞰したい人

## 3. 何を公開する想定か

- 注目カテゴリ
  週次で伸びているカテゴリや関心が集まっている分野
- 伸びているマシン系統
  具体機種名の羅列ではなく、どの系統が伸びているか
- 比較トレンド
  GT / GS / YT の比較から見える傾向を、公開向けの言葉に翻訳したもの
- 週次の変化要因
  `top drivers` や review 補助を元にした説明的要約

## 4. 何は公開しないか

- raw JSON や raw collector 出力そのもの
- 実験中の暫定値や source health 未確認の結果
- `review only` / `blocked` の run を通常品質として見せること
- 内部仕入れ判断ロジックの全文や、内部向けの細かい weight / threshold 調整ロジックの丸出し
- DB 内の行データそのもの

## 5. 公開品質を担保するために必要なもの

- source health
  どの source が使えたか、欠落が無いかを確認する
- review-only 判定
  内部では見せてよくても、公開には回さない run を分ける
- fallback 時の注意表示
  mock fallback や source 欠落があった週を通常品質扱いしない
- fixture / regression による再現性
  同じ週次結果や表示契約を再現できるようにする
- compare / review 補助
  変化要因を公開向け要約へ変換するための材料にする

## 6. 内部向けと外部向けの接続

公開レイヤは、内部の次のレイヤを順に通った結果だけを使う。

1. collectors
2. ranking
3. compare
4. review 補助
5. source health / fallback 判定
6. publish-ready artifact
7. Web 公開

原則:

- public layer は internal layer の上に乗る
- raw collector 出力から直接公開しない
- review 済みで health を通った結果だけを公開候補にする

## 7. 内部向け出力と公開向け出力の差

### 内部向け

- ranking table
- compare table
- raw delta
- Impact / Hint / rank path
- source health の詳細
- tuning や仕入れ判断に使う詳細情報

### 公開向け

- 注目カテゴリ
- 伸びているマシン系統
- 比較トレンドの解説
- 週次の変化要因の要約
- 注意表示付きの公開可否判定

## 8. fallback と公開品質の関係

fallback 設計は、内部向けの運用安定化だけでなく、外部向け公開品質にも直結する。

公開時の原則:

- `ok`:
  review 後に公開候補にできる
- `review_only`:
  内部 review には使えるが、通常公開しない
- `blocked`:
  公開しない

fallback が使われた週に公開する場合でも、通常品質と同じ見せ方はしない。必要なら注意表示付きの限定的な公開か、公開見送りにする。

## 9. 現段階の非ゴール

- Web サイトそのものの実装を急ぐこと
- collector の raw data を公開すること
- degraded 状態を隠して公開運用だけ先に始めること

## 10. 次に整理すべきこと

1. publish-ready artifact の最小形式を決める
2. `review only` / `blocked` を public layer にどう伝えるか決める
3. 公開向けに出す週次 summary の最小テンプレートを設計する
