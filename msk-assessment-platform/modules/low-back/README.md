# 腰痛評価モジュール仕様 — modules/low-back/

**位置づけ:** JASSESS-01 運動器初期評価システム の Phase 1 実装モジュール
**最終更新:** 2026-03-23

---

## このファイルの役割

このドキュメントは腰痛モジュール（Phase 1）固有の仕様をまとめる。
共通基盤（赤旗・NRS・PSFS・患者マスタ・評価履歴）の仕様は SPEC.md / SHEET_DESIGN.md を参照。

将来モジュールを追加する際は `modules/<module-name>/README.md` を同様に作成する。

---

## 1. 腰痛モジュールの評価項目

### 腰痛固有の評価ツール

| ツール | 略称 | 評価対象 | 参照先（全列定義） |
|---|---|---|---|
| Roland Morris Disability Questionnaire 短縮版 | RMDQ-10 | 機能障害の程度 | SHEET_DESIGN.md セクションE |
| STarT Back Screening Tool 簡易版（9項目） | STarT簡易版 | 慢性化リスク（心理社会的因子含む） | SHEET_DESIGN.md セクションF |
| 腰部動作評価（前後屈・側屈） | — | 可動域・制限パターン | SHEET_DESIGN.md セクションH |
| 神経症状評価（SLR・デルマトーム・筋力） | — | 神経根障害・馬尾症候群 | SHEET_DESIGN.md セクションC |
| 移乗動作評価 | — | ADL・転倒リスク | SHEET_DESIGN.md セクションI |

---

## 2. 腰痛固有のルールベース判定フラグ

LOGIC.md に詳細記述。腰痛モジュール固有のフラグ一覧：

| フラグ | 条件 | 判定の意味 |
|---|---|---|
| FLAG_NERVE_SEVERE | SLR両側陽性 / 下肢筋力低下あり | 神経障害重度 → 医療連携検討 |
| FLAG_NERVE_MOD | SLR片側陽性 | 神経根障害中等度 → 施術方針に反映 |
| FLAG_START_HIGH | STarT ≥ 6 | 慢性化リスク高 → 行動変容介入優先 |
| FLAG_START_MID | STarT ≥ 4 | 慢性化リスク中 → 心理社会的因子に注意 |
| FLAG_RMDQ_SEVERE | RMDQ ≥ 8 | 機能障害重度 → ADL・機能改善優先 |
| FLAG_MOTION_ALL | 前後屈ともに著明制限 | 全方向制限型 → 動作改善優先 |
| FLAG_CHRONIC | 発症3か月以上 | 慢性期管理 → セルフケア習慣化 |
| FLAG_RECURRENT | 既往複数回以上 | 再燃しやすい → 再発予防設計を強化 |

共通フラグ（FLAG_CAUDA / FLAG_REDFLAG / FLAG_NRS_HIGH / FLAG_FALL_HIGH / FLAG_PSFS_IMPROVED）は全モジュール共通。

---

## 3. 腰痛固有のコメントセット

COMMENT_DESIGN.md に詳細記述。腰痛モジュール固有のコメントカテゴリ：

- 評価まとめ（腰痛版）: NRS・RMDQ・STarT・動作パターンを統合
- 腰痛の説明方向性: STarTリスク・発症期間・既往に応じた説明スクリプト
- 腰痛施術の優先順位: 疼痛管理 / 神経根対応 / 機能改善 / 行動変容 の選択根拠
- 腰痛向けセルフケア: 発症期・機能改善期・慢性期それぞれの指導内容
- 腰痛患者向け説明文: 専門用語なし・150字以内の患者向け要約

---

## 4. 腰痛モジュール専用シート

| シート | 内容 |
|---|---|
| 腰痛評価入力 | セクションC（神経症状）/ E（RMDQ）/ F（STarT）/ H（動作評価）/ I（移乗動作） |
| 判定ロジック | 腰痛ルールベース中間計算（通常非表示） |

---

## 5. 将来モジュールとの比較（参考）

| 評価項目 | 腰痛（Phase 1） | 頸肩（Phase 2 予定） | 膝（Phase 3 予定） |
|---|---|---|---|
| 機能障害評価 | RMDQ-10 | NDI / NPQ | KOOS / LEFS |
| 慢性化リスク | STarT簡易版 | STarT頸部調整版 | TBD |
| 主な動作評価 | 前後屈・側屈 | 頸部ROM 6方向 | 膝屈伸・スクワット |
| 神経症状 | SLR・L/S デルマトーム | 上肢放散・腕神経叢 | 大腿神経・閉鎖神経 |
| 移乗動作 | 腰部起因の困難 | 少（腰より少ない） | 膝起因の困難 |

---

## 6. 再開手順（Phase 1 実装着手時）

1. `PROJECT_STATUS.md` で現在フェーズ確認
2. `gas/setup_sheets.js` を Apps Script エディタに貼り付け、`setupAllSheets()` を実行
3. 生成されたスプレッドシートIDを `PROJECT_STATUS.md` に記録
4. 基本動作確認（プルダウン・赤旗アラート・NRS/RMDQ/STarT自動計算）
5. Phase 2: ルールベース判定ロジックの実装（LOGIC.md 腰痛固有ロジック準拠）
