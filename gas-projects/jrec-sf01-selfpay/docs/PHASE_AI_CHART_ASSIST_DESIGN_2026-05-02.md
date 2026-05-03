# AI補助判定設計書 — JREC-SF01 自費カルテ

**Phase AI-0 設計調査 / Phase AI-2 評価補助方針追記**
作成日: 2026-05-02（Phase AI-0）
更新日: 2026-05-03（Phase AI-2 評価補助方針追記）
対象プロジェクト: gas-projects/jrec-sf01-selfpay
ステータス: Phase AI-1 HEAD/dev PASS 済み・Phase AI-2 実装待ち

---

## 1. 目的

カルテ入力画面に「AI補助判定」を組み込み、施術者の臨床判断を補助する。

- 先生が通常のカルテ入力欄に記入
- AIがその入力内容（+ 患者マスター情報）を直接読み取る
- 同じカルテ画面内にAI補助判定を表示する

---

## 2. 対象範囲

- 自費カルテ（SelfPayChart / SelfPayVisits）の入力補助
- 患者マスター（Patients）への職業・既往歴追加
- visit-form.html への患者情報参照欄・受傷起点・今回追記欄の追加
- OpenAI API（または Claude API）との連携設計
- AI補助判定の保存（AI_Assessments シート新設設計）

---

## 3. 対象外（明示的除外）

以下の観点はこのAI補助判定から**完全に除外する**。

| 除外項目 | 理由 |
|---|---|
| 保険審査・返戻・査定 | 自費カルテのため関係しない |
| 療養費支給基準への適合判定 | 対象外（JREC-01 柔整保険の領域） |
| 診断確定 | AI は補助情報のみ提供。最終判断は施術者 |
| 手動プロンプト作成・コピー方式 | 既存入力欄との二重入力になるため不採用 |
| 保険算定妥当性 | 対象外 |

---

## 4. 現状シート構造

### 4-1. Patients シート（11列）

| col | キー | 内容 |
|---|---|---|
| 1 | patientId | P0001 形式 |
| 2 | 氏名 | |
| 3 | フリガナ | |
| 4 | 生年月日 | date型 |
| 5 | 性別 | 男性/女性/その他 |
| 6 | 電話番号 | |
| 7 | 住所 | |
| 8 | 備考 | アレルギー・注意事項等（自由記述） |
| 9 | jrecPatientId | 保険JREC側の同一患者ID |
| 10 | createdAt | |
| 11 | updatedAt | |

**欠如している項目:** 職業・既往歴（構造化フィールドなし）
**備考欄の現状:** 「高血圧既往あり」等が混在している可能性あり

---

### 4-2. SelfPayVisits シート（14列）

| col | キー | 内容 |
|---|---|---|
| 1 | selfPayVisitKey | SPV_YYYYMMDD_PatientId_001 形式 |
| 2 | patientId | |
| 3 | 来院日 | |
| 4 | 来院区分 | 初診/再診 |
| 5 | 担当者 | |
| 6 | 主訴 | テキスト（Phase 6-E で textarea 化済み） |
| 7 | VAS | 0〜10の整数 |
| 8 | 次回方針 | |
| 9 | 会計状態 | 未会計/会計済/未収 |
| 10 | createdAt | |
| 11 | updatedAt | |
| 12 | isDeleted | Phase 6-B 追加。checkbox |
| 13 | deletedAt | |
| 14 | deleteReason | |

**欠如している項目:** 受傷起点（injuryTrigger）・今回追記既往歴（relatedHistoryNote）

---

### 4-3. SelfPayChart シート（12列）

| col | キー | 内容 |
|---|---|---|
| 1 | chartId | SPC_... 形式 |
| 2 | selfPayVisitKey | SelfPayVisits.selfPayVisitKey への FK |
| 3 | 評価（assessment） | ROM・筋力テスト・姿勢評価など |
| 4 | 所見（findings） | 触診・筋緊張・圧痛部位など |
| 5 | 施術内容（treatment） | |
| 6 | 使用機器（equipment） | |
| 7 | 説明内容（explanation） | 患者への説明 |
| 8 | 禁忌確認（contraindication） | 確認済/該当なし |
| 9 | 生活指導（lifestyle） | |
| 10 | 次回予定（nextAppointment） | |
| 11 | createdAt | |
| 12 | updatedAt | |

---

### 4-4. その他シート（参照・影響確認）

| シート | 役割 | AI補助判定への影響 |
|---|---|---|
| Settings | 設定値 | 間接的。clinic_name 参照可能性あり |
| SelfPayItems | 会計明細 | 影響なし |
| Payments | 入金記録 | 影響なし |
| Receipts | 領収書 | 影響なし |
| MenuMaster | 自費メニュー定義 | 影響なし |
| DailySales | 日別売上集計 | 影響なし |
| Run_Log | 操作ログ | AI実行ログを追記候補 |

---

## 5. 現状画面構造

### 5-1. visit-form.html（カルテ入力画面）

**現在の入力フィールド:**

| セクション | フィールド | 種別 |
|---|---|---|
| 来院情報 | 来院日 | date |
| 来院情報 | 来院区分 | select (初診/再診) |
| 来院情報 | 担当者 | disabled input |
| 来院情報 | 主訴 | textarea (Phase 6-E 追加) |
| 来院情報 | VAS | number (0〜10) |
| 来院情報 | 次回方針 | text |
| カルテ記録 | 評価 | textarea |
| カルテ記録 | 所見 | textarea |
| カルテ記録 | 施術内容 | textarea + preset-btns |
| カルテ記録 | 使用機器 | textarea + preset-btns |
| カルテ記録 | 禁忌確認 | select |
| カルテ記録 | 説明内容 | text |
| カルテ記録 | 生活指導 | textarea |
| カルテ記録 | 次回予定 | text |

**現在ない表示・入力欄:**
- 患者情報参照欄（年齢・性別・職業・患者マスター既往歴）
- 受傷起点（injuryTrigger）
- 今回追記既往歴（relatedHistoryNote）
- AI補助判定セクション

**テンプレート変数（server-side）:**
- `patient`: patientId, name, kana, phone（住所・備考・dob・genderは現在渡されていない）
- `editVisit`: カルテ再編集時に渡される visit+chart 統合データ
- `appUrl`: WebApp URL

**注意点（GAS 固有制約）:**
- `google.script.run` が使える環境（WebApp iframe）でのみ動作
- ページ遷移は `window.top.location.href` を使用
- 自動遷移はせず、ユーザークリックに統一している（GAS iframe トラブル防止）

---

### 5-2. patient-form.html（患者登録・編集画面）

**現在の入力フィールド:**

| フィールド | 種別 |
|---|---|
| 氏名 | text (必須) |
| フリガナ | text |
| 生年月日 | date |
| 性別 | select |
| 電話番号 | tel |
| 住所 | text |
| 備考 | textarea（アレルギー・注意事項など） |
| JREC本体 患者ID | text |

**現在ない入力欄:**
- 職業
- 既往歴（構造化フィールド）

---

### 5-3. patient-detail.html（患者詳細画面）

患者基本情報 + 来院タイムライン + ゴミ箱を表示。
AI補助判定との接続点として、「カルテ入力へ進む」リンクがここから起動される。

---

### 5-4. JREC_SF01_Main.gs（ルーティング）

`visitForm` ページで `getPatientById(idParam)` を呼び出して `t.patient` に渡している。
**現在、patient オブジェクトに dob・gender・address・note は含まれている**（`getPatientById` の戻り値として取得済み）が、visit-form.html 側でテンプレート変数として渡していない。

> `t.patient = ptv;` → `getPatientById` の戻り値には `dob`, `gender`, `address`, `note` が含まれている

これは Phase AI-1 での「患者情報参照欄追加」時に活用できる（追加の GAS 変更不要の可能性がある）。

---

## 6. 追加候補項目まとめ

### 6-1. Patients シートへの追加案

| 追加位置 | キー | 内容 | 理由 |
|---|---|---|---|
| col 12 | occupation | 職業 | 身体負荷・反復動作・姿勢・作業環境との関連 |
| col 13 | medicalHistory | 既往歴（テキスト） | 現在症状との関連判断に必要 |

**安全性の評価:**
- `getPatients` は `.getRange(2, 1, n, 11)` → col 12以降は読まれない（影響なし）
- `getPatientById` は `.getRange(2, 1, n, 11)` → col 12以降は読まれない（影響なし）
- `createPatient` は `appendRow` で 11値固定 → 後ろに追加しても既存行は変わらない
- `updatePatient` は col 2-8, 11 のみ更新 → col 12-13 は触れない
- **既存データ行への影響なし。新規列として末尾追加が安全。**

---

### 6-2. SelfPayVisits シートへの追加案

| 追加位置 | キー | 内容 | 理由 |
|---|---|---|---|
| col 15 | injuryTrigger | 受傷起点 | 症状評価の基本情報 |
| col 16 | relatedHistoryNote | 今回追記既往歴 | 今回症状に関係する既往・補足 |

**安全性の評価:**
- `getVisitsByPatient` は `Math.min(sh.getLastColumn(), 14)` で最大14列読取 → col 15以降は読まれない（影響なし）
- `getVisitFormData` は `Math.min(visitSh.getLastColumn(), 14)` → 同上
- `createVisitWithChart` は `appendRow` で 11値（col 1-11）のみ → 後ろに追加しても既存行は変わらない
- `updateVisitWithChart` は col 3-8, 11 のみ更新
- **既存データ行への影響なし。新規列として末尾追加が安全。**

> **注意:** Phase AI-1 実装時は `getVisitsByPatient`・`getVisitFormData` の読取列数上限を 16 に増やし、フィールドを戻り値・復元処理に追加する必要がある。

---

### 6-3. SelfPayChart シートへの追加案

現状の SelfPayChart（12列）は「評価・所見・施術内容・機器・説明・禁忌・生活指導・次回予定」を格納。
受傷起点・今回追記既往歴は SelfPayVisits 側（来院情報）に持つ方が設計上自然。
SelfPayChart 側への追加は AI補助判定保存（AI_Assessments）の要否を確認してから判断する。

---

### 6-4. AI_Assessments シート（新規追加案）

| col | キー | 内容 |
|---|---|---|
| 1 | aiAssessmentKey | 採番キー（AIK_... 形式） |
| 2 | visitKey | 対象 selfPayVisitKey |
| 3 | patientId | 患者ID |
| 4 | inputSnapshotJson | AIに送った入力データのJSON |
| 5 | aiOutputJson | AIから返ってきた出力のJSON |
| 6 | riskLevel | 赤旗リスク判定（low/medium/high/unknown） |
| 7 | model | 使用モデル（gpt-4o-mini 等） |
| 8 | promptVersion | プロンプトバージョン（v1.0 等） |
| 9 | createdAt | 実行日時 |
| 10 | reviewStatus | 採用/一部採用/不採用/要確認/未レビュー |
| 11 | adoptedMemo | 先生のメモ（採用理由・修正点） |

**安全性の評価:**
- 既存シートへの影響なし（純粋な新規追加）
- Setup.gs の SHEET_NAMES に `AI_ASSESSMENTS: "AI_Assessments"` を追加する
- setupAll_ に `setupAIAssessments_(ss)` を追加する
- 既存データ・既存関数への影響ゼロ

---

## 7. 患者マスター追加案（Phase AI-1）

### 変更対象

| 対象 | 変更内容 |
|---|---|
| Patients シート | col 12: occupation（職業）/ col 13: medicalHistory（既往歴）を追加 |
| JREC_SF01_Setup.gs | `setupPatients_` のヘッダー・列幅に occupation / medicalHistory を追加 |
| JREC_SF01_Patient.gs | `getPatientById` の読取列数を 13 に拡張。戻り値に occupation / medicalHistory を追加 |
| JREC_SF01_Patient.gs | `createPatient` の `appendRow` に occupation / medicalHistory を追加（空文字デフォルト） |
| JREC_SF01_Patient.gs | `updatePatient` に occupation / medicalHistory の更新処理を追加 |
| patient-form.html | 職業入力欄（テキスト or select）/ 既往歴テキストエリアを追加 |

### 職業入力設計案

テキスト入力（自由記述）が最も柔軟。
または select（林業/介護職/建設業/デスクワーク/運送業/学生/主婦/スポーツ指導者/その他）を採用する案もある。
**推奨:** select + 「その他」で自由記述を許容する方式。ただし最終は先生の確認後に決定する。

### 既往歴入力設計案

テキストエリア（自由記述）が妥当。
構造化（checkbox や select）にすると入力が煩雑になる。フリーテキストで自然に記録させる。

---

## 8. カルテ入力画面追加案（Phase AI-1）

### 追加セクション: 患者情報参照欄（読み取り専用）

```
患者情報参照（患者マスターより）
- 年齢（生年月日から算出）
- 性別
- 職業（患者マスターより）
- 患者マスター既往歴（患者マスターより）
```

**実装メモ:**
- `t.patient` には現在すでに `dob`, `gender` が含まれている（`getPatientById` の戻り値）
- Phase AI-1 で occupation / medicalHistory を `getPatientById` 戻り値に追加すれば、Main.gs 側の変更不要で visit-form.html でそのまま参照可能
- 年齢は dob からテンプレート側で計算するか、GAS 側で計算して渡す（どちらでも可）

---

### 追加フィールド: 来院情報セクション内

| フィールド | キー | シート保存先 | 種別 |
|---|---|---|---|
| 受傷起点 | injuryTrigger | SelfPayVisits col 15 | textarea |
| 今回追記既往歴 | relatedHistoryNote | SelfPayVisits col 16 | textarea |

**受傷起点の入力ガイド:**
- いつから / 何をして / どの動作で / 急にか徐々にか
- 仕事中 / スポーツ中 / 日常生活か
- 繰り返し負荷か / 再発か初発か

---

### 追加セクション: AI補助判定（Phase AI-2 以降）

Phase AI-2 では「表示枠だけ作る」。OpenAI API連携は Phase AI-3 で実装。

```
AI補助判定（ベータ）
[ AI補助判定を実行する ] ← ボタン
─────────────────────────────
[ここにAI出力が入る]
─────────────────────────────
[ この判定を保存する ] ← Phase AI-4 で追加
```

---

## 9. AI入力データ設計

### 9-1. 送信データ構造

```json
{
  "patientContext": {
    "patientId": "P0001",
    "age": 54,
    "ageBand": "中年",
    "sex": "男性",
    "occupation": "林業",
    "medicalHistory": "過去の肩痛あり"
  },
  "visitContext": {
    "visitKey": "SPV_20260502_P0001_001",
    "visitDate": "2026-05-02",
    "visitType": "再診",
    "chiefComplaint": "左肩を動かすと痛い",
    "vas": 6,
    "injuryTrigger": "懸垂・腕立て・空手動作で誘発",
    "course": "1か月休むと軽減するが再開すると再発",
    "findings": "肩前方痛、重量物で悪化",
    "assessment": "肩屈曲120度、外転90度",
    "treatment": "干渉波10分・手技",
    "relatedHistoryNote": "林業でチェーンソー作業あり"
  }
}
```

### 9-2. 個人情報保護ルール（必須）

| 除外する情報 | 理由 |
|---|---|
| 氏名 | 個人特定リスク |
| 住所 | 個人特定リスク |
| 電話番号 | 個人特定リスク |
| 生年月日（生データ） | 年齢・年齢層に変換して送る |
| jrecPatientId | 不要 |
| メールアドレス | 不要 |

**年齢層の変換基準（案）:**

| 年齢 | 年齢層 |
|---|---|
| 0-5 | 幼児 |
| 6-14 | 小児 |
| 15-18 | 学生（中高） |
| 19-29 | 若年成人 |
| 30-44 | 壮年 |
| 45-64 | 中年 |
| 65-74 | 前期高齢者 |
| 75+ | 後期高齢者 |

---

## 10. AI出力データ設計

### 10-1. 出力JSON構造

```json
{
  "summary": "現在のカルテ内容から見た要約（1〜2文）",
  "missingQuestions": [
    "夜間痛の有無",
    "しびれ・脱力・感覚異常の有無"
  ],
  "suggestedExams": [
    "可動域検査（屈曲・外転・内旋）",
    "抵抗運動検査（棘上筋・棘下筋）",
    "圧痛部位確認（烏口突起・大結節）"
  ],
  "clinicalConsiderations": [
    "腱板由来の痛みを考慮",
    "上腕二頭筋長頭腱周囲の評価を検討"
  ],
  "ageOccupationNotes": [
    "中年かつ反復負荷の大きい職業のため、変性要素や作業負荷を確認"
  ],
  "redFlags": [
    "安静時痛・夜間痛・明らかな筋力低下があれば医科紹介を検討"
  ],
  "documentationGaps": [
    "受傷起点が不足（いつ・何をして・どの動作でを補記）",
    "疼痛誘発動作はあるが徒手検査所見が不足"
  ],
  "disclaimer": "AI出力は補助情報です。最終判断は施術者が行ってください。"
}
```

### 10-2. 表示設計方針

| セクション | 表示方法 |
|---|---|
| summary | テキスト（通常表示） |
| missingQuestions | 箇条書きリスト（未確認事項） |
| suggestedExams | 箇条書きリスト（検査提案） |
| clinicalConsiderations | 箇条書きリスト（臨床考察） |
| ageOccupationNotes | 黄色背景カード（患者固有の注意点） |
| redFlags | 赤/オレンジ背景カード（赤旗・要注意） |
| documentationGaps | グレー背景リスト（記録不足の補足促し） |
| disclaimer | 小テキスト（必ず表示） |

---

## 11. AI_Assessments 保存設計

### 11-1. 保存タイミングの検討

| 案 | タイミング | 長所 | 短所 |
|---|---|---|---|
| 案A | AI実行直後に自動保存 | 漏れなし | 不要な判定も保存される |
| 案B | 先生が「保存」ボタンをクリックした時のみ | 先生が必要な判定だけ保存 | 操作が増える |
| **推奨: 案B** | **先生クリック時のみ保存** | 余分なデータが残らない | UI上のボタン追加が必要 |

### 11-2. visitKey 未作成の場合の扱い

カルテ保存前にAI補助判定を実行した場合（新規カルテ）は visitKey が存在しない。

**方針（案）:**
- カルテ保存後に AI実行ボタンが有効化される（カルテ未保存時はAI実行不可）
- または: visitKey 未作成時は一時キー（TEMP_P0001_...）で仮保存し、カルテ保存後に正式 visitKey に紐付け直す

**推奨:** カルテ保存後のみAI実行を許可する（シンプル・安全）。
カルテ保存 → 「AI補助判定を実行する」ボタン有効化 → AI実行 → 判定表示 → 先生がレビュー後に保存判断。

### 11-3. 既存カルテ再編集時の扱い

- 再編集時（`editVisit` あり）は `visitKey` が確定している
- 過去の AI_Assessments レコードを visitKey で検索して表示できる
- 複数回AI実行した場合は最新のものを表示し、履歴は AI_Assessments 側に保持

### 11-4. reviewStatus 値

| 値 | 意味 |
|---|---|
| 未レビュー | AI実行直後の初期値 |
| 採用 | 先生が判定を採用 |
| 一部採用 | 一部の項目のみ参考にした |
| 不採用 | 今回は参考にしなかった |
| 要確認 | 後で見直す（保留） |

---

## 12. 個人情報・安全設計

| 設計原則 | 内容 |
|---|---|
| 氏名・住所・電話を送らない | AIへの送信データに含めない（API側でも処理しない） |
| 生年月日を年齢層に変換 | 実年齢・年齢層のみ送る |
| patientId のみ送る | 内部管理用。外部サービスでの個人特定に使えない |
| 診断確定の禁止 | AIシステム設計として「補助情報」に限定する |
| 最終判断は施術者 | disclaimer を必ず表示 |
| API Key の管理 | GAS の ScriptProperties（PropertiesService）に保管。コードに直書き禁止 |
| ログへの個人情報記録禁止 | Run_Log には visitKey + patientId のみ（名前・氏名を書かない） |

---

## 13. 実装ロードマップ

### Phase AI-0: 設計調査 ✅（2026-05-02 本ドキュメント）

現状構造確認、影響範囲確認、設計書作成。
コード実装なし・clasp push なし。

---

### Phase AI-1: 患者マスター・カルテ項目追加 ✅（HEAD /dev LiveCheck PASS 2026-05-03）

**目的:** AI補助判定が活用する入力情報の基盤を整備する

| タスク | 対象ファイル | 内容 |
|---|---|---|
| AI-1-1 | JREC_SF01_Setup.gs | Patients ヘッダーに occupation / medicalHistory を追加。setupPatients_ の col 12-13 |
| AI-1-2 | JREC_SF01_Patient.gs | `getPatientById` の読取列数を 13 へ拡張。戻り値に occupation / medicalHistory 追加 |
| AI-1-3 | JREC_SF01_Patient.gs | `createPatient` に occupation / medicalHistory を追加（appendRow 末尾） |
| AI-1-4 | JREC_SF01_Patient.gs | `updatePatient` に occupation / medicalHistory の更新処理を追加 |
| AI-1-5 | patient-form.html | 職業（select+その他）・既往歴（textarea）の入力欄を追加 |
| AI-1-6 | JREC_SF01_Setup.gs | SelfPayVisits ヘッダーに injuryTrigger / relatedHistoryNote を追加（col 15-16） |
| AI-1-7 | JREC_SF01_Visit.gs | `getVisitsByPatient` / `getVisitFormData` の読取列数を 16 へ拡張。戻り値に追加 |
| AI-1-8 | JREC_SF01_Visit.gs | `createVisitWithChart` / `updateVisitWithChart` に injuryTrigger / relatedHistoryNote を追加 |
| AI-1-9 | visit-form.html | 患者情報参照欄（年齢・性別・職業・患者マスター既往歴）を追加（読み取り専用） |
| AI-1-10 | visit-form.html | 受傷起点（textarea）・今回追記既往歴（textarea）の入力欄を追加 |
| AI-1-11 | JREC_SF01_Main.gs | `visitForm` ページの `t.patient` に `dob`/`gender`/`occupation`/`medicalHistory` が含まれているか確認 |

**注意:** setupPatients_ / setupSelfPayVisits_ の再実行は既存データ行に影響しない（ヘッダー書式のみ更新）。
ただし、新列への既存データ埋め込みは行わない（空のまま）。

---

### Phase AI-2: AI評価補助UI追加 ⏸

> **方針確定（2026-05-03）:**
> AI補助の対象は「カルテ文案生成」だけでなく「**評価補助**」も含む。
> 主訴・症状・患者情報をもとに、施術者が確認・判断するための観点を提示する。
> AI は診断を確定・断定しない。最終判断は常に施術者が行う。

**目的:** visit-form.html に AI評価補助セクションを追加する（API連携なし・UI枠のみ）

**AI が出力する候補:**

| 出力種別 | 内容 |
|---|---|
| 評価の観点整理 | 主訴・症状・年齢・職業・受傷起点から評価すべき視点を整理 |
| 鑑別の方向性 | 症状パターンから考慮すべき鑑別を提示（断定しない） |
| 危険サイン確認 | red flags / 受診勧奨が必要な所見の確認促し |
| 追加問診候補 | 情報不足時に有効な追加問診の提案 |
| 施術方針案 | 既往歴・職業・受傷起点を踏まえた施術アプローチ案 |
| 受診勧奨の目安 | 医療機関紹介が適切なケースの目安 |
| カルテ下書き | 所見・施術内容の文章化候補（施術者が確認・修正） |

**AI への入力情報（送信する情報）:**

| 情報 | 送信方法 |
|---|---|
| 主訴・症状・所見・施術内容 | そのまま送信 |
| 年齢・性別 | 年齢（または年代）に変換して送信 |
| 職業 | そのまま送信 |
| 既往歴・受傷起点・今回追記既往歴 | そのまま送信 |
| 氏名・住所・電話番号 | **送信しない**（外販前提・個人情報保護） |
| 生年月日 | **送信しない**（年齢/年代に変換） |

**画面上の表記方針:**
- セクション名: 「AI評価補助」
- 補足表記: 「参考情報 — 施術者が確認・判断してください」
- 免責: 「AIは診断を行いません。最終判断は施術者が行ってください。」（毎回表示）

| タスク | 対象ファイル | 内容 |
|---|---|---|
| AI-2-1 | visit-form.html | AI評価補助セクション追加（カルテ保存後に有効化されるボタン＋表示枠） |
| AI-2-2 | visit-form.html | カルテ保存前はAIボタンを disabled 制御（visitKey 未確定のため） |
| AI-2-3 | visit-form.html | AI出力表示枠（評価観点 / 鑑別方向 / 危険サイン / 追加問診 / 施術方針案 / 受診勧奨 / カルテ下書き / disclaimer） |
| AI-2-4 | styles.html | AI評価補助セクション用スタイル追加（危険サイン=赤カード、注意=黄カード等） |

---

### Phase AI-3: OpenAI API連携 ⏸

**目的:** カルテ入力内容と患者マスター情報をAIに送り、補助判定を取得する

| タスク | 対象ファイル | 内容 |
|---|---|---|
| AI-3-1 | JREC_SF01_Main.gs | `runAIAssessment(visitKey)` の GAS 関数を新規追加 |
| AI-3-2 | JREC_SF01_Main.gs | API Key は `PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY')` で取得 |
| AI-3-3 | JREC_SF01_Main.gs | 入力データ収集（visitKey → visit + chart + patient 結合）|
| AI-3-4 | JREC_SF01_Main.gs | 年齢層変換処理（dob → ageBand）|
| AI-3-5 | JREC_SF01_Main.gs | 個人情報除去（氏名・住所・電話を inputSnapshot から除外）|
| AI-3-6 | JREC_SF01_Main.gs | UrlFetchApp で OpenAI Chat Completion API を呼び出す |
| AI-3-7 | JREC_SF01_Main.gs | JSON レスポンスをパースして戻す |
| AI-3-8 | visit-form.html | `google.script.run.runAIAssessment(visitKey)` を呼び出す |
| AI-3-9 | visit-form.html | AI出力を各セクションに表示する JS を実装 |

**API選択肢:**

| 候補 | 特徴 |
|---|---|
| OpenAI (gpt-4o-mini) | 高速・低コスト・日本語対応良好 |
| OpenAI (gpt-4o) | 精度高いが高コスト |
| Claude API (claude-sonnet-4-6) | Anthropic製。構造化出力が得意 |

**推奨:** 初期は gpt-4o-mini（速度・コストバランス）。精度不足なら gpt-4o へ切替。
API選択はユーザー確認後に確定する。

---

### Phase AI-4: AI補助判定保存・レビュー ⏸

**目的:** AI判定を AI_Assessments シートに保存し、先生がレビューできるようにする

| タスク | 対象ファイル | 内容 |
|---|---|---|
| AI-4-1 | JREC_SF01_Setup.gs | AI_Assessments シートを新規追加（setupAIAssessments_ 関数） |
| AI-4-2 | JREC_SF01_Main.gs | `saveAIAssessment(visitKey, inputSnapshot, aiOutput)` 関数を追加 |
| AI-4-3 | JREC_SF01_Main.gs | `getAIAssessmentsByVisitKey(visitKey)` 関数を追加（カルテ再編集時の履歴表示用） |
| AI-4-4 | visit-form.html | 「この判定を保存する」ボタンと reviewStatus select を追加 |
| AI-4-5 | visit-form.html | adoptedMemo テキストエリアを追加（先生のメモ欄） |
| AI-4-6 | visit-form.html | カルテ再編集時に過去の AI判定を表示する処理を追加 |

---

### Phase AI-5: 運用改善 ⏸

**目的:** 実際の運用から得られたフィードバックでプロンプト・UI を改善する

| タスク | 内容 |
|---|---|
| AI-5-1 | よくある不足問診テンプレート化（部位別プリセット） |
| AI-5-2 | 部位別プロンプト調整（肩・腰・膝・首・肘・足首） |
| AI-5-3 | 年齢層・職業別の注意点強化 |
| AI-5-4 | 赤旗チェックリストの精度向上 |
| AI-5-5 | 過去カルテとの比較（同患者の前回 AI判定との差分） |
| AI-5-6 | 院内標準パッケージ化の検討（他の接骨院への展開） |

---

## 14. 影響範囲まとめ

| 影響を受けるファイル | Phase | 変更の性質 |
|---|---|---|
| JREC_SF01_Setup.gs | AI-1 | ヘッダー追加のみ（既存データ不変） |
| JREC_SF01_Patient.gs | AI-1 | 読取列拡張・戻り値追加・appendRow 追加 |
| JREC_SF01_Visit.gs | AI-1 | 読取列拡張・戻り値追加・appendRow / update 追加 |
| patient-form.html | AI-1 | 入力欄追加 |
| visit-form.html | AI-1 〜 AI-4 | 段階的に拡張 |
| JREC_SF01_Main.gs | AI-3 〜 AI-4 | AI 関数追加 |
| styles.html | AI-2 | スタイル追加 |
| JREC_SF01_Billing.gs | 影響なし | — |
| Payments / Receipts / DailySales | 影響なし | — |
| 会計・領収書・月次集計 | 影響なし | — |
| 未収管理 | 影響なし | — |

---

## 15. リスク

| リスク | レベル | 対策 |
|---|---|---|
| Patients 列追加時の `getPatients` 読取漏れ | 低 | `getPatients` は col 1-11 のみ読むため影響なし。ただし将来的に拡張する場合は要確認 |
| SelfPayVisits 列追加後の `getVisitsByPatient` 列数上限 | 中 | `Math.min(sh.getLastColumn(), 14)` を 16 に変更する必要あり。変更し忘れると新列が返らない |
| OpenAI API Key の流出 | 高 | ScriptProperties に保管。コミット禁止。GASの実行ログにも出力しない |
| AI実行時の GAS タイムアウト（6秒） | 中 | OpenAI API の応答は通常 2-5秒以内。タイムアウト発生時はユーザー向けに再試行メッセージを表示 |
| AI補助判定を「診断」と誤認されるリスク | 高 | disclaimer を必ず画面表示。AIボタン周囲に「施術者の最終判断を要します」を明記 |
| visitKey 未確定でのAI実行 | 低 | カルテ保存後のみAIボタンを有効化する設計で回避 |
| 過去の備考欄（note）に既往歴が混在している場合 | 低 | 患者登録時に medicalHistory へ移行するか、note を参照して転記するかはユーザー判断 |

---

## 16. 未決事項

| 番号 | 未決事項 | 確認先 |
|---|---|---|
| U-1 | 職業入力はフリーテキストか select か | 先生に確認 |
| U-2 | 既往歴の入力粒度（完全自由文か、チェックリスト+メモか） | 先生に確認 |
| U-3 | AI 実行後に自動保存するか、手動保存ボタンにするか | 先生に確認 |
| U-4 | API は OpenAI か Claude API か | 先生に確認（コスト・精度比較表を別途作成可） |
| U-5 | 既存患者の備考（note）に書かれた既往歴の移行方法 | 移行スクリプトが必要か、手動更新で対応か |
| U-6 | カルテ再編集時に過去AI判定を表示するか | 先生の運用方針 |
| U-7 | 受傷起点は必須項目か任意か | 先生に確認 |
| U-8 | AI補助判定の保存を先生が行う場合、reviewStatus のデフォルト値 | 設計で決定可能だが要確認 |
| U-9 | gpt-4o-mini 使用時のプロンプト日本語 vs 英語 | 日本語推奨（解釈の精度と先生による出力レビューのしやすさ） |
| U-10 | riskLevel（赤旗リスク）の判定はAIに委ねるか、redFlags の内容から派生させるか | 設計で決定可能 |

---

## 17. 次回実装候補

**最優先:** Phase AI-1（患者マスター・カルテ項目追加）

### Phase AI-1 実装プロンプト作成時の注意点

1. `setupPatients_` の再実行は既存データ行に影響しない（ヘッダー書式のみ更新）
2. `setupSelfPayVisits_` の再実行も同様
3. `getPatientById` の読取列拡張時は既存の `getPatients`（col 1-11 固定読取）との差分に注意
4. `createPatient` の `appendRow` は末尾に追加するだけ。既存行は変わらない
5. `updatePatient` は `col 2-8, 11` のみ更新中。col 12-13 の更新処理を追加する
6. visit-form.html の患者情報参照欄は Main.gs 側で `t.patient` に既に dob / gender が渡っているため、GAS側変更なしで参照可能（occupation / medicalHistory は Patients 拡張後に追加）
7. `getVisitsByPatient` の `Math.min(sh.getLastColumn(), 14)` を 16 に変更するのを忘れずに

---

*設計書作成: Claude Code（claude-sonnet-4-6）*
*Phase AI-0 完了 — 実装は Phase AI-1 プロンプトから開始*
