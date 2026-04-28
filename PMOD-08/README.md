# PMOD-08 整骨院物療機器学習・成功マニュアル

**プロジェクトID:** PMOD-08  
**正式名称:** 整骨院物療機器学習・成功マニュアル  
**正本:** ローカル（`workspace/PMOD-08/`）  
**ステータス:** Phase 1〜2 体系拡張中  
**最終更新:** 2026-04-10

---

## このプロジェクトが何のためのものか

整骨院・接骨院で使う**物療機器（物理療法機器）**を体系的に学び、  
「なぜこの機器を選ぶのか」を患者に説明できる水準まで知識を構造化するプロジェクト。

**このプロジェクトの核心:**  
「機器の比較表を作る」のが目的ではない。  
**「人体と病態を理解したうえで物療を選べる参考書」** を作ることが目的。

物療機器 × 解剖学 × 生理学 × 病理学 × 疼痛科学 × 症状・疾患 × 臨床判断  
これらが一本につながった知識体系を構築し、  
最終的には全国の治療家が使える参考書・有料教材へと発展させる。

---

## 誰のためのプロジェクトか

**第一義:** 平山克司（接骨院経営者・柔道整復師）自身の学習・実践記録  
**第二義:** 全国の柔整師・治療家が「物療を体系的に学ぶ」ための参考書  
**第三義:** 将来の有料教材・コンサルを購入するユーザー

---

## 何を作っていくのか

| 成果物 | 概要 |
|---|---|
| 人体×物療の知識体系 | 解剖・生理・病理・疼痛科学と機器選択を統合したドキュメント群 |
| 症状・疾患別マニュアル | 整骨院でよくみる症状ごとの「何をどう使うか」 |
| 症例データベース | 実際の症例を匿名化して蓄積（院内用） |
| プロトコルデータベース | 再現性のある治療プロトコルの標準化 |
| note 無料記事 | 全国の治療家向け教育コンテンツ |
| 有料コンテンツ | 症例集・選定ガイド・患者説明テンプレート等 |
| AIレビュー仕組み | 既存記事・知識の誤り・陳腐化を継続検証 |

---

## 知識体系の全体像

```
[人体の理解]
  解剖学 → 組織の種類・深さ・構造
  生理学 → 神経・筋・循環・炎症・温熱反応
  病理学 → 組織修復の3フェーズ・慢性化のパターン
  疼痛科学 → 侵害受容・末梢感作・中枢感作・防御反応
        ↓
[病態の把握]
  「今この患者に何が起きているか」を特定する
  急性炎症 / 組織修復 / 拘縮 / 廃用 / 神経症状 / 慢性疼痛
        ↓
[症状・疾患の整理]
  整骨院でよく見る疾患・症状の病態と物療の目的
        ↓
[物療の選択と設定]
  7ステップの臨床判断フレーム
  症状タイプ別ガイド（Type 1〜6）
  疾患×機器マトリクス
        ↓
[実施・反応・再評価]
  設定の記録 → 反応の確認 → プロトコルへの反映
```

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
│   ├── SCOPE.md                       # スコープ・対象機器・学習範囲
│   ├── LEARNING_GOALS.md              # 学習目標の定義
│   │
│   ├── ── 人体・生理学ドキュメント群 ──
│   ├── HUMAN_BIOLOGY_MAP.md           # 物療学習に必要な人体知識の全体地図 ★
│   ├── ANATOMY_AND_TARGET_TISSUES.md  # 物療ターゲット組織の特性
│   ├── PHYSIOLOGY_FOR_MODALITIES.md   # 物療と生理学のブリッジ
│   ├── PATHOLOGY_AND_HEALING.md       # 病理・組織治癒と物療フェーズ
│   ├── PAIN_SCIENCE_BASICS.md         # 疼痛科学の基礎（患者説明と選択に使う）
│   │
│   ├── ── 機器・選択ドキュメント群 ──
│   ├── KNOWLEDGE_MAP.md               # 物療学習の地図（機器・設定・生体反応）
│   ├── DEVICE_CLASSIFICATION.md       # 機器の分類と特性整理
│   ├── CLINICAL_DECISION_FRAMEWORK.md # 選択・設定の7ステップ思考手順
│   │
│   ├── ── 疾患・症状ドキュメント群 ──
│   ├── COMMON_CONDITIONS_MAP.md       # 整骨院でよくみる症状・疾患マップ ★
│   ├── SYMPTOM_BASED_DECISION_GUIDE.md # 症状から逆算する物療選択ガイド ★
│   ├── DISEASE_AND_MODALITY_MATRIX.md # 疾患×候補機器マトリクス ★
│   ├── RED_FLAGS_AND_REFERRAL.md      # レッドフラッグと医療連携基準 ★
│   │
│   ├── ── 方針・戦略ドキュメント群 ──
│   ├── EVIDENCE_POLICY.md             # エビデンスの扱い方針
│   ├── AI_VALIDATION_POLICY.md        # AI検証ループの方針
│   ├── DATA_POLICY.md                 # データ・個人情報管理方針
│   ├── NOTE_STRATEGY.md               # note公開戦略
│   └── MONETIZATION_MODEL.md          # 収益化モデル
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
├── templates/                         # 再利用テンプレート群
├── prompts/                           # AI活用プロンプト集
└── logs/                              # 作業ログ・更新記録
```

★ = 今回の拡張で追加した重要ドキュメント

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

- 記述した知識・記事は定期的に `prompts/` のプロンプトを使ってAIに検証させる
- 「現場で使えるが、言い過ぎていない」品質を維持する
- 更新履歴は `PROJECT_STATUS.md` に記録する

### データ保護の原則

- 症例データは必ず匿名化する（`docs/DATA_POLICY.md` 参照）
- 個人情報を含むデータは Git管理外で管理する
- note・商品化に使うデータは匿名化確認後に使用する

---

## 関連ドキュメント（最重要）

| ドキュメント | 内容 |
|---|---|
| [ROADMAP.md](./ROADMAP.md) | フェーズ別開発計画 |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | 現在地・次アクション |
| [docs/HUMAN_BIOLOGY_MAP.md](./docs/HUMAN_BIOLOGY_MAP.md) | 人体知識の全体地図（最初に読む）|
| [docs/KNOWLEDGE_MAP.md](./docs/KNOWLEDGE_MAP.md) | 物療学習の地図 |
| [docs/CLINICAL_DECISION_FRAMEWORK.md](./docs/CLINICAL_DECISION_FRAMEWORK.md) | 選択・設定の思考手順 |
| [docs/SYMPTOM_BASED_DECISION_GUIDE.md](./docs/SYMPTOM_BASED_DECISION_GUIDE.md) | 症状別の実践ガイド |
| [docs/DISEASE_AND_MODALITY_MATRIX.md](./docs/DISEASE_AND_MODALITY_MATRIX.md) | 疾患×機器マトリクス（速引き）|
| [docs/RED_FLAGS_AND_REFERRAL.md](./docs/RED_FLAGS_AND_REFERRAL.md) | レッドフラッグ（安全管理）|
| [docs/DATA_POLICY.md](./docs/DATA_POLICY.md) | データ管理方針 |
