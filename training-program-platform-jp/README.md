# training-program-platform-jp

## 目的

日本語で使いやすい「プログラム配布型トレーニングアプリ」の土台を作る。
Boostcamp的な体験を参考にしつつ、ブランド・文言・情報設計は独自設計とし、初期は Web 寄り・スマホ優先で立ち上げる。

この企画で最初に目指す体験は次の 3 つ。

- プログラムライブラリから自分に合うメニューを探せる
- 当日のワークアウトを迷わず実行できる
- 記録を残し、前回との比較を見ながら継続できる

## 想定ユーザー

- 初心者から中級者のトレーニー
- 海外由来の有名プログラムを日本語で理解して取り組みたい人
- スマホ中心で日々の実行と記録を行いたい人
- 初期運用では管理者 1 名がプログラム登録と整備を担う

## MVP 範囲

初期 MVP では、次の 3 レイヤを成立させる。

1. プログラムライブラリ
2. ワークアウト実行 UI
3. 記録管理

MVP で優先する機能:

- プログラム一覧、絞り込み、詳細
- プログラム開始と当日ワークアウト表示
- セット / 回数 / 重量 / RPE / メモの記録
- 前回記録の参照
- 履歴表示
- 管理者によるプログラム / 種目 / 作成者の登録管理

MVP では重くしないもの:

- 一般ユーザー投稿
- SNS / コミュニティ
- 課金
- 高度なソーシャル機能

## 初期技術方針

- 初期は Web アプリを軸に進める
- UI はスマホ優先で設計し、PC は管理・登録補助を主用途とする
- 将来の PWA 化を見据え、画面遷移・状態管理・オフライン対応余地を意識する
- 管理 UI と利用 UI は役割分離しやすい構造で設計する
- データモデルは単一管理者運用から始めつつ、将来の複数ユーザー対応で破綻しない前提を置く

## 運用前提

- 初期運用は管理者 1 名
- 初期収録は有名既存プログラム中心
- 初期は一般ユーザー投稿機能を入れない
- 将来は複数ユーザー登録・利用に対応する予定
- ただし初期 MVP では複数ユーザー本実装を急がず、土台だけを意識する

## 主要ドキュメント

- [ROADMAP.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/ROADMAP.md)
- [concept.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/concept.md)
- [requirements.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/requirements.md)
- [user-stories.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/user-stories.md)
- [screens.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/screens.md)
- [data-model.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/data-model.md)
- [feature-scope.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/feature-scope.md)
- [glossary.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/glossary.md)
- [tech-decision.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/tech-decision.md)
- [initial-program-library.md](/C:/hirayama-ai-workspace/workspace/training-program-platform-jp/docs/initial-program-library.md)

## 初期ディレクトリ

```text
training-program-platform-jp/
├─ README.md
├─ ROADMAP.md
├─ docs/
├─ app/
├─ web/
├─ admin/
├─ assets/
└─ seed/
   ├─ programs/
   ├─ exercises/
   └─ creators/
```

## 現時点の注意

- 今回はプロジェクト立ち上げと設計文書の初期整備まで
- 実装方針の細部、採用技術の確定、権利確認は今後の検討対象
- 仕様を広げすぎず、未確定事項は別管理する
