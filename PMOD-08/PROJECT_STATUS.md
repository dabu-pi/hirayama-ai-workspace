# PROJECT_STATUS — PMOD-08 整骨院物療機器学習・成功マニュアル

**最終更新:** 2026-04-10  
**更新者:** Claude Code（体系拡張・改訂）  
**現在ブランチ:** feature/auto-dev-phase3-loop

---

## 現在の目的

Phase 1 の「物療機器理解」に加え、  
**「人体・病態・症状・疾患」の知識体系を統合**し、  
「機器 × 人体 × 病態 × 症状・疾患 × 臨床判断」がつながる構造を構築した。

---

## 現在の状態（2026-04-10 時点）

### 完成済みドキュメント群

**人体・生理学ドキュメント（今回新規）**

| ファイル | 内容 | 状態 |
|---|---|---|
| `docs/HUMAN_BIOLOGY_MAP.md` | 物療に必要な人体知識の全体地図 | 初版完成 |
| `docs/ANATOMY_AND_TARGET_TISSUES.md` | ターゲット組織の特性・物療との関係 | 初版完成 |
| `docs/PHYSIOLOGY_FOR_MODALITIES.md` | 物療と生理学のブリッジ | 初版完成 |
| `docs/PATHOLOGY_AND_HEALING.md` | 病態・組織治癒と物療方針 | 初版完成 |
| `docs/PAIN_SCIENCE_BASICS.md` | 疼痛科学の基礎と患者説明 | 初版完成 |

**疾患・症状ドキュメント（今回新規）**

| ファイル | 内容 | 状態 |
|---|---|---|
| `docs/COMMON_CONDITIONS_MAP.md` | 整骨院でよくみる症状・疾患マップ | 初版完成 |
| `docs/SYMPTOM_BASED_DECISION_GUIDE.md` | 症状タイプ別（6タイプ）物療選択ガイド | 初版完成 |
| `docs/DISEASE_AND_MODALITY_MATRIX.md` | 疾患×候補機器マトリクス | 初版完成（主要7疾患）|
| `docs/RED_FLAGS_AND_REFERRAL.md` | レッドフラッグと医療連携基準 | 初版完成 |

**既存ドキュメント（今回改訂）**

| ファイル | 改訂内容 |
|---|---|
| `README.md` | 統合参考書プロジェクトとしての全体像を明示 |
| `ROADMAP.md` | 人体理解・病態理解フェーズを統合 |
| `docs/KNOWLEDGE_MAP.md` | 学習の全体構造（Step 0〜4）を追加 |
| `docs/CLINICAL_DECISION_FRAMEWORK.md` | Step 0（レッドフラッグ）・病態分析3軸・運動療法連携を追加 |
| `docs/LEARNING_GOALS.md` | 人体理解・安全管理の学習目標を追加 |
| `docs/SCOPE.md` | 学習優先順序と疾患スコープを追加 |
| `note/series_plan.md` | 人体・病態・疾患別のシリーズ構成に拡充 |

---

## 直近の着手範囲

### 今やること（Phase 1 残タスク）

- [ ] **自院保有機器の一覧を `data/device_database/device_master_template.csv` に記入**  
  → これが決まると Phase 1 の学習順序が確定する
- [ ] `docs/KNOWLEDGE_MAP.md` の「自院の保有機器」欄を埋める
- [ ] `docs/HUMAN_BIOLOGY_MAP.md` に自院での臨床経験を踏まえた追記
- [ ] `docs/DISEASE_AND_MODALITY_MATRIX.md` に未登録の疾患（肘痛・手関節等）を追加

### 今やらないこと

- note の記事作成（Phase 5 以降）
- 有料コンテンツの設計（Phase 6 以降）
- 症例の本格入力（Phase 4 以降）

---

## 優先順位

| 優先度 | タスク |
|---|---|
| ★★★ | 自院保有機器の一覧化（現実に即した学習の確定）|
| ★★★ | `RED_FLAGS_AND_REFERRAL.md` の問診フォーム作成（安全管理）|
| ★★☆ | `DISEASE_AND_MODALITY_MATRIX.md` への未登録疾患追加 |
| ★★☆ | Phase 2 の臨床判断フレームの実運用での検証 |
| ★☆☆ | `data/protocol_database/` への最初のプロトコル作成 |

---

## 次アクション（次回再開時に最初にやること）

1. `data/device_database/device_master_template.csv` を開いて自院保有機器を記入する
2. `docs/KNOWLEDGE_MAP.md` の「自院の保有機器」欄（Section 6）を埋める
3. `docs/DISEASE_AND_MODALITY_MATRIX.md` に肘痛（テニス肘）を追加する

---

## 現在の数値前提・記録基準

| 項目 | 現状 |
|---|---|
| 整備済み主要ドキュメント | 20ファイル以上（Phase 1〜2 骨格）|
| 登録症例数 | 0件（Phase 4 から着手予定）|
| 整備済みプロトコル | 0件（Phase 2〜3 から着手予定）|
| note 公開記事 | 0本（Phase 5 から着手予定）|

---

## 今回決めた主要方針（2026-04-10 追加）

| 方針 | 内容 |
|---|---|
| 人体知識なしに物療は選ばない | 解剖・生理・病理・疼痛科学を学習基盤に統合 |
| 組織治癒フェーズで物療を変える | 炎症期・増殖期・リモデリング期で方針が変わる |
| 疾患名より病態で考える | 「腰痛」ではなく「今何が起きているか」で判断 |
| レッドフラッグを物療の前に確認 | CLINICAL_DECISION_FRAMEWORKにStep 0として統合 |
| 物療と運動療法・生活指導を統合 | 物療単独での完結を目指さない |
| 中枢性感作への理解を持つ | 慢性疼痛で物療の限界を患者に説明できる |
| 「言い切りすぎない」エビデンス運用 | EVIDENCE_POLICYの4段階評価を徹底 |

---

## 未解決論点

- 自院で保有している機器の全リストが未整理（最優先で確認が必要）
- 症例記録をいつから開始するか（Phase 2 完了後か早めに始めるか）
- note のシリーズ開始タイミング（Phase 3 完了後が理想だが、Phase 1 完了後から始める選択肢もある）

---

## 更新履歴

| 日付 | 更新内容 | 更新者 |
|---|---|---|
| 2026-04-10 | 初回作成・プロジェクト立ち上げ（Phase 1 骨格）| Claude Code |
| 2026-04-10 | 人体・病態・疾患・症状ドキュメント群を追加。体系拡張 | Claude Code |
