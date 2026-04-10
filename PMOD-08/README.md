# PMOD-08 整骨院物療機器学習・成功マニュアル

**プロジェクトID:** PMOD-08  
**正式名称:** 整骨院物療機器学習・成功マニュアル  
**正本:** ローカル（`workspace/PMOD-08/`）  
**ステータス:** Phase 1 着手中  
**最終更新:** 2026-04-10

---

## このプロジェクトが何のためのものか

整骨院・接骨院で使う**物療機器（物理療法機器）**を体系的に学び、
「なぜこの機器を選ぶのか」を患者に説明できる水準まで知識を構造化するプロジェクト。

最終的には、自院の治療効率向上 → note での知識公開 → 有料教材・コンサルへの展開を目指す。

---

## 誰のためのプロジェクトか

**第一義:** 平山克司（接骨院経営者・柔道整復師）自身の学習・実践記録  
**第二義:** 全国の柔整師・治療家が「物療を体系的に学ぶ」ための参考書  
**第三義:** 将来の有料教材・コンサルを購入するユーザー

---

## 何を作っていくのか

| 成果物 | 概要 |
|---|---|
| 知識体系ドキュメント | 物療機器の分類・選択基準・設定方針の体系化 |
| 症例データベース | 実際の症例を匿名化して蓄積（院内用） |
| プロトコルデータベース | 再現性のある治療プロトコルの標準化 |
| note 無料記事 | 全国の治療家向け教育コンテンツ |
| 有料コンテンツ | 症例集・選定ガイド・患者説明テンプレート等 |
| AIレビュー仕組み | 既存記事・知識の誤り・陳腐化を継続検証 |

---

## フォルダ構成

```
PMOD-08/
├── README.md                          # このファイル
├── ROADMAP.md                         # フェーズ別開発計画
├── PROJECT_STATUS.md                  # 現在地・着手範囲・次アクション
│
├── docs/                              # 設計・方針・知識体系ドキュメント
│   ├── VISION.md                      # プロジェクトビジョン
│   ├── SCOPE.md                       # スコープ・対象機器
│   ├── LEARNING_GOALS.md              # 学習目標の定義
│   ├── KNOWLEDGE_MAP.md               # 物療学習の地図（重要）
│   ├── DEVICE_CLASSIFICATION.md       # 機器の分類と特性整理
│   ├── CLINICAL_DECISION_FRAMEWORK.md # 選択・設定の思考手順
│   ├── EVIDENCE_POLICY.md             # エビデンスの扱い方針
│   ├── AI_VALIDATION_POLICY.md        # AI検証ループの方針
│   ├── NOTE_STRATEGY.md               # note公開戦略
│   ├── MONETIZATION_MODEL.md          # 収益化モデル
│   └── DATA_POLICY.md                 # データ・個人情報管理方針
│
├── data/                              # 蓄積データ
│   ├── cases/                         # 症例データ（匿名化）
│   ├── device_database/               # 機器マスターデータ
│   ├── protocol_database/             # プロトコルデータ
│   └── evidence/                      # 文献・エビデンス記録
│
├── note/                              # note 公開コンテンツ
│   ├── free/                          # 無料記事
│   ├── paid/                          # 有料記事
│   └── drafts/                        # 下書き
│
├── product/                           # 商品・コンテンツ設計
│
├── templates/                         # 再利用テンプレート群
│
├── prompts/                           # AI活用プロンプト集
│
└── logs/                              # 作業ログ・更新記録
```

---

## 運用ルール

### 正本はローカル

- **このリポジトリ（`workspace/PMOD-08/`）が唯一の正本**
- 作業は必ず `feature/auto-dev-phase3-loop` ブランチで行う
- 変更後は commit & push まで実施する

### Markdown に残す原則

- 重要な判断・設計・方針はすべて Markdown に記録する
- 実機確認で気づいた修正も、必ずローカル側のファイルに反映してから終了する
- 「頭の中だけにある知識」はプロジェクト資産にならない

### AIで継続検証する原則

- 記述した知識・記事は定期的に `prompts/` のプロンプトを使って AI に検証させる
- 「現場で使えるが、言い過ぎていない」品質を維持する
- 更新履歴は `PROJECT_STATUS.md` に記録する

### データ保護の原則

- 症例データは必ず匿名化する（`docs/DATA_POLICY.md` 参照）
- 個人情報を含むデータは `data/cases/anonymized/` に格納し、Git管理外にする
- note・商品化に使うデータは匿名化確認後に使用する

---

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [ROADMAP.md](./ROADMAP.md) | フェーズ別開発計画 |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | 現在地・次アクション |
| [docs/KNOWLEDGE_MAP.md](./docs/KNOWLEDGE_MAP.md) | 物療学習の全体地図 |
| [docs/CLINICAL_DECISION_FRAMEWORK.md](./docs/CLINICAL_DECISION_FRAMEWORK.md) | 選択・設定の思考手順 |
| [docs/DATA_POLICY.md](./docs/DATA_POLICY.md) | データ管理方針 |
