# JBIZ 価格設定シート C列 menu_id 移動 — 横断影響チェック記録

実施日: 2026-03-23
対象変更: JBIZ「価格設定」シート C列を `小区分` → `menu_id` に転用（旧 O列から移動）

---

## 変更内容

| 項目 | 変更前 | 変更後 |
|---|---|---|
| 価格設定 C列ヘッダ | 小区分 | menu_id |
| 価格設定 O列 | menu_id（識別キー） | 廃止（未使用）|
| JBIZ_COL.menuId | 14（O列） | 2（C列） |
| JBIZ_COL.subCategory | 2（C列） | 廃止（キー削除）|

---

## 横断影響チェック結果

### 1. JBIZ スプレッドシート内の他シート（KPI数式）

| シート | C列参照 | 影響 | 根拠 |
|---|---|---|---|
| KPI逆算 | なし | **影響なし** | 価格設定参照は `K列`(主力手技フラグ)・`G列`(一般料金)・`D列`(メニュー名)のみ |
| KPI目標 | なし | **影響なし** | 上記と同じ参照先のみ |
| 数値前提 | なし | **影響なし** | 価格設定参照なし |
| 保険・来院前提 | なし | **影響なし** | 価格設定参照なし |
| ダッシュボード系 | なし | **影響なし** | 価格設定参照なし |

KPI数式が参照する価格設定列（確認済み）:
- `=IF(COUNTIF('価格設定'!K4:K15,TRUE)=1, INDEX(FILTER('価格設定'!G4:G15,...),1), 5000)` → K・G列
- `=COUNTIF('価格設定'!K4:K15,TRUE)` → K列
- `=IFERROR(INDEX('価格設定'!G:G,MATCH("月会員",'価格設定'!D:D,0)),0)` → G・D列

**C列は1件も参照されていない。KPI数式は完全に安全。**

---

### 2. JREC-01 コード（Ver3_core.js）

| 箇所 | 変更前 | 変更後 | 種別 |
|---|---|---|---|
| `JBIZ_COL.menuId` | 14（O列） | 2（C列）| ✅ 修正済み（前セッション） |
| `JBIZ_COL.subCategory` | 2（C列） | 廃止 | ✅ 修正済み（前セッション） |
| 関数コメント L3291-3293 | 「O列」と記載 | 「C列」に修正 | ✅ 修正済み（本セッション） |
| 関数コメント L3311 | 「O1 ヘッダ設定」 | 「C1 ヘッダ設定」に修正 | ✅ 修正済み（本セッション） |
| **ダイアログメッセージ L3331** | **「O列（menu_id）を確認し…」** | **「C列（menu_id）を確認し…」** | ✅ 修正済み（本セッション） |
| `getSelfPayMenuMaster_V3` | `row[JBIZ_COL.menuId]` | 同じキー・新インデックス 2 | ✅ 自動適用 |
| `setupJBIZMenuMasterId_V3` | `JBIZ_COL.menuId + 1 = 15` | `JBIZ_COL.menuId + 1 = 3` | ✅ 自動適用 |
| `migrateJBIZMemberRules_V3` | `row[JBIZ_COL.menuId]` | 同じキー・新インデックス 2 | ✅ 自動適用 |

**subCategory のコード内参照: 0件（定義のみ・削除済み）**

---

### 3. JBIZ 初期化スクリプト（gas_spreadsheet_setup.js）

| 箇所 | 変更前 | 変更後 | 種別 |
|---|---|---|---|
| L512 コメント | `小区分` | `menu_id` | ✅ 修正済み（本セッション） |
| L518 ヘッダ配列 | `'小区分'` | `'menu_id'` | ✅ 修正済み（本セッション） |
| L535 コメント | `小区分` | `menu_id` | ✅ 修正済み（本セッション） |
| L588 コメント | `// 小区分（3列）` | `// menu_id（3列 = C列）` | ✅ 修正済み（本セッション） |

> **注意**: このスクリプトは `ss.insertSheet(SHEET.PRICING)` を使うため、**シートが既存の場合はエラーで止まる（上書きされない）**。
> ランタイム影響なし。ただし将来の再セットアップ時に正しい定義が適用されるよう修正済み。

---

### 4. ドキュメント

| ファイル | 箇所 | 変更前 | 変更後 | 種別 |
|---|---|---|---|---|
| `SHEET_DESIGN.md` | L62 | `C \| 小区分` | `C \| menu_id（JREC参照キー）` + O列廃止行追加 | ✅ 修正済み |
| `SELF_PAY_DETAIL_DESIGN.md` | L506 | `JBIZ O列 menu_id 初回設定` | `JBIZ C列 menu_id 初回設定` | ✅ 修正済み |
| `SELF_PAY_DETAIL_DESIGN.md` | L516 | `menu_id 列追加` | `C列 menu_id 設定（O列→C列移動済み注記）` | ✅ 修正済み |
| `PROJECT_STATUS.md`（JREC） | 列定義表 | C=小区分・O=menu_id | C=menu_id・O=廃止 | ✅ 前セッション修正済み |

---

### 5. 他プロジェクト

| プロジェクト | 影響 | 根拠 |
|---|---|---|
| freee-automation | **影響なし** | 価格設定シート参照なし |
| patient-management | **影響なし** | 価格設定シート参照なし |
| 慢性疼痛_管理表 | **影響なし** | 別スプレッドシート・列依存なし |
| ai-invest | **影響なし** | 価格設定シート参照なし |

---

### 6. 「小区分」廃止の業務影響確認

| 観点 | 評価 |
|---|---|
| 現運用での使用 | 全行が空文字列（`''`）。分類用途として実際には使われていなかった |
| 将来の業務分類ニーズ | 大区分（B列）で区分管理を継続。小区分追加が必要な場合は N列(備考)または新列で対応可 |
| KPI集計への影響 | なし（KPI集計はD列メニュー名・G列料金・K列フラグで完結）|
| JREC自費明細シートへの影響 | なし（menu_id・メニュー名・単価で記録されており小区分は非保存）|

---

## 影響なしの根拠サマリー

1. **KPI数式は K・G・D列のみ参照** — C列はゼロ件の参照
2. **JBIZ他シートは価格設定C列を一切参照しない** — 数式依存なし
3. **gas_spreadsheet_setup.js は再初期化時のみ実行** — 既存シートには無影響（insertSheet がエラー）
4. **「小区分」は全行空文字列だった** — 機能的な変更なし、ヘッダ転用のみ

---

## 修正ファイル一覧

| ファイル | 修正内容 | セッション |
|---|---|---|
| `gas-projects/jyu-gas-ver3.1/Ver3_core.js` | JBIZ_COL.menuId=2、subCategory廃止、コメント・ダイアログ修正 | 本日 |
| `gas-projects/jyu-gas-ver3.1/PROJECT_STATUS.md` | 列定義表更新 | 本日 |
| `gas-projects/jyu-gas-ver3.1/SELF_PAY_DETAIL_DESIGN.md` | O列→C列参照更新 | 本日 |
| `hirayama-jyusei-strategy/SHEET_DESIGN.md` | C=menu_id に更新・O列廃止行追加 | 本日 |
| `hirayama-jyusei-strategy/gas_spreadsheet_setup.js` | コメント・ヘッダ文字列を 小区分→menu_id に更新 | 本日 |
| `gas-projects/jyu-gas-ver3.1/COLUMN_MIGRATION_C_MENUID.md` | 本ファイル（横断チェック記録）| 本日 |

---

---

## menu_id 運用ポリシー（2026-03-23 確定）

> **この方針はメニュー改定のたびに参照すること。**

| ケース | menu_id の扱い |
|---|---|
| **価格のみ変更**（同じサービス内容） | **menu_id 維持**。JBIZ G列の単価だけ更新する。過去の自費明細データとの集計が継続できる |
| **サービス内容・時間・名称が変わる** | **新 menu_id を採番**（`大区分_詳細` 形式）。旧は廃止記録に残す |
| **廃止メニュー** | JBIZのM列「確定状況」を「廃止」に変更。C列 menu_id は削除しない（過去データキーが壊れる）|
| **テスト期間中のメニュー** | 内容が変わっても「テスト中」と明示された期間内は menu_id を変えてよい（まだ運用実績がないため）|

### 命名規則早見表

| 大区分 | プレフィックス | 例 |
|---|---|---|
| 保険基本 | `INS_BASE` | `INS_BASE` |
| 保険オプション | `INS_OPTION_` | `INS_OPTION_EXTEND10` |
| 自費施術 | `SELF_` | `SELF_CHRONIC50` |
| トレーニング | `TRAINING_` | `TRAINING_PERSONAL60` |
| ジム | `GYM_` | `GYM_MONTHLY` |

---

## メニュー変更履歴（2026-03-23）

| 行 | 変更前 | 変更後 | menu_id変更 | 理由 |
|---|---|---|---|---|
| 3 | 筋膜リリース（マッサージガン）880円 | ストレッチ（20分）2,200円 | 廃止→新設 | サービス内容変更のため |
| 4 | 温熱追加 550円 | 電療追加（15分）1,200円 | 廃止→新設 | サービス内容変更のため |

---

## 残タスク（次の人間確認）

- [ ] JBIZ `価格設定` シートを手動更新（下記の手順で実施）
  - 行3: メニュー名「ストレッチ（20分）」/ 一般料金 2200 / C列 `INS_OPTION_STRETCH20` / 確定状況「確定」
  - 行4: メニュー名「電療追加（15分）」/ 一般料金 1200 / C列 `INS_OPTION_ELECTRO15` / 確定状況「確定」
  - 旧メニュー（筋膜リリース・温熱追加）の M列確定状況を「廃止」に変更（C列 menu_id はそのまま）
- [ ] GASメニュー「【初回1回】JBIZ menu_id 列追加」を実行してC列の既知menu_idを自動設定
- [ ] T2-3a 実機確認（自費ダイアログで新メニューが表示されることを確認）

---

## 2026-04-18 追記: 価格設定_v2 受け入れ準備（読み取りは v1 のまま）

### 目的

価格設定_v2（SELFPAY_* 命名・17列構造）は既に live に転記済み（A4:Q21）。
本ターンでは **v1 動作を維持したまま** v2 を受け入れ可能な状態まで Ver3_core.js を準備する。
実際の v1 → v2 読み取り切替は次ターン。

### Ver3_core.js 変更内容

| 項目 | 変更 |
|---|---|
| `JBIZ_MENU_SHEET_CANDIDATES` | 未変更。コメントで「v2 は次ターンで先頭昇格」と明記 |
| `JBIZ_COL` | 既存（v1 用・14列構造）として維持 |
| `JBIZ_COL_V2` | **新設**（v2 用・17列構造）|
| `pickJbizCol_(sheetName)` | **新設**。シート名が `価格設定_v2` なら `JBIZ_COL_V2`、それ以外は `JBIZ_COL` |
| `getSelfPayMenuMaster_V3` | `pickJbizCol_(sh.getName())` 経由に置換。v2 の `有効フラグ=FALSE` 除外処理も追加 |
| `setupJBIZMenuMasterId_V3` | 同上 |
| `migrateJBIZMemberRules_V3` | 同上 |
| `JBIZ_MENU_ID_MAP` | `SELFPAY_*` 命名へ更新。初回評価3分割・物療3種追加 |
| `JBIZ_MENU_ID_LEGACY_ALIAS` | **新設**。SELF_* → SELFPAY_* マップ（過去データ保護）|
| `normalizeMenuId_()` | **新設**。legacy ID を現行 ID へ正規化（未知はそのまま）|
| fallback 配列 | `SELFPAY_*` 命名 + 物療3種 + 初回評価3種に更新 |

### JBIZ_COL と JBIZ_COL_V2 の対応表

| キー | v1 index (列) | v2 index (列) |
|---|---|---|
| displayOrder | 0 (A) | 0 (A) |
| category | 1 (B) | 1 (B) |
| subcategory | — | 2 (C) **v2 新設** |
| menuId | 2 (C) | 3 (D) |
| menuName | 3 (D) | 4 (E) |
| patientName | — | 5 (F) **v2 新設** |
| description | 4 (E) | 6 (G) |
| duration | 5 (F) | 7 (H) |
| price | 6 (G) | 8 (I) |
| memberPrice | 7 (H) | 9 (J) |
| insurance | 8 (I) | 10 (K) |
| unit | 9 (J) | 11 (L) |
| isMain | 10 (K) | 12 (M) |
| isKpi | 11 (L) | 13 (N) |
| status | 12 (M) | 14 (O) |
| isActive | — | 15 (P) **v2 新設** |
| note | 13 (N) | 16 (Q) |

### fallback / alias 新旧対応

| 旧 menu_id（SELF_*）| 新 menu_id（SELFPAY_*）|
|---|---|
| SELF_CHRONIC50 | SELFPAY_CHRONIC50 |
| SELF_EVAL_LOWBACK30 | SELFPAY_EVAL_LOWBACK30 |
| SELF_EVAL_NECKSHOULDER30 | SELFPAY_EVAL_NECKSHOULDER30 |
| SELF_EVAL_KNEE30 | SELFPAY_EVAL_KNEE30 |
| SELF_INITIAL_EVAL（1件）| 3分割のため個別エイリアス不可（要手動判定）|

fallback に新規追加された正式メニュー:
- SELFPAY_MICROCURRENT / SELFPAY_HIGHVOLTAGE / SELFPAY_ULTRASOUND（物療3種）

### v1 動作が維持される理由

1. `JBIZ_MENU_SHEET_CANDIDATES` が `["メニューマスタ（価格設定）", "価格設定"]` のままで、v2 を含まない
2. `getJBIZMenuSheet_` は先頭から順に検索するため、必ず v1「価格設定」を見つけて返す
3. `pickJbizCol_` は v1 シート名に対して `JBIZ_COL`（旧定義）を返すため、列位置が従来通り
4. `JBIZ_MENU_ID_MAP` の変更は `setupJBIZMenuMasterId_V3` を実行した場合のみ波及するが、既に C列に値がある既存行は上書きしないため影響なし
5. fallback 配列の変更は「JBIZ 不達時のみ」発火。通常運用（JBIZ 到達）では従来通り v1 行を返す
6. `JBIZ_MENU_ID_LEGACY_ALIAS` / `normalizeMenuId_` は新規関数で、既存の呼び出し経路にはまだ繋がっていない

### 残タスク

- [ ] v1 → v2 シートスイッチ（`JBIZ_MENU_SHEET_CANDIDATES` 先頭に `価格設定_v2` を追加）
- [ ] 自費明細シートの過去データに SELF_* が保存されているか live 確認
- [ ] 過去データ保護方針の確定（rename vs alias 層で吸収 vs ハイブリッド）
- [ ] KPI逆算 C5/C6/C9 の v2 参照式への切替

---

## 2026-04-18 追記: 自費明細 legacy menu_id 監査（read-only）

### 目的

v1 → v2 シートスイッチ前に、JREC 自費明細シートに残存している
`SELF_*` 系 legacy menu_id の実数・分布・`SELF_INITIAL_EVAL` 特殊ケースの有無を
live データから把握する。**完全 read-only。書き込みは一切行わない。**

### 実行手順（人間が手動で実施）

1. JREC live スプレッドシートを開く:
   https://docs.google.com/spreadsheets/d/1rXWkfAc_ppOfMV5Dxmb3maX9ORVrZbpSOX2Lz7RouZM
2. 拡張機能 → Apps Script でエディタを開く
3. 関数選択ドロップダウンから `auditLegacyMenuIds_V3` を選択
4. ▶ 実行
5. 「実行ログ」パネルの出力を全選択コピー
6. 本ファイルの「監査結果」セクションへ貼り付けて commit

GAS メニューから実行する場合:
`管理者用 → 【監査】自費明細 legacy menu_id`

### 監査先 ID 修正履歴（2026-04-18）

| 項目 | 内容 |
|---|---|
| 旧 ID（誤り） | `121BkW7jEnKUjmU_NNVAPyJRs_UVmmoqkHDPMHL-RJeA`（運用ポータル側であり自費明細は存在しない）|
| 新 ID（正） | `1rXWkfAc_ppOfMV5Dxmb3maX9ORVrZbpSOX2Lz7RouZM`（JREC live ブック・`menu_id` / `メニュー名` / `単価` を保持）|
| シート探索 | まず `自費明細` を探し、見つからない場合は `自費明細一覧` / `自費売上` / `売上明細` / `明細` の順で候補探索 |
| 見つからない場合 | 実在シート一覧を Logger に出力して abort |
| Read-only 維持 | `setValue` / `appendRow` / `delete` 不使用（監査目的のため） |

### 監査項目

| 項目 | 内容 |
|---|---|
| a | menu_id ごとの件数（降順） |
| b | `SELF_*` 系のみの内訳 |
| c | `SELFPAY_*` 系の件数 |
| d | その他（空白 / M001 / 未知ID）の件数 |
| e | `SELF_INITIAL_EVAL` 該当行の `{施術日, 患者ID, メニュー名, 単価}` 全件ダンプ |
| f | menu_id とメニュー名の不一致ペア |
| g | `SELF_*` 系の最古・最新日付 |

### 監査結果（記入欄）

実行日: `_______________`

#### サマリ

| 項目 | 件数 |
|---|---|
| 総データ行数 | |
| SELF_* 系合計 | |
| SELFPAY_* 系合計 | |
| その他合計 | |

#### a) menu_id 内訳

```
（ここに Logger 出力を貼る）
```

#### b) SELF_* 内訳

```

```

#### c) SELFPAY_* 内訳

```

```

#### d) その他

| 種別 | 件数 |
|---|---|
| 空白 | |
| M001系 | |
| 未知 | |

#### e) SELF_INITIAL_EVAL 該当行（あれば全件）

```

```

#### f) menu_id ↔ メニュー名 不一致

```

```

#### g) SELF_* 日付範囲

- 最古: `______-__-__`
- 最新: `______-__-__`

### 判断ルール

| 結果 | 次アクション |
|---|---|
| SELF_* 合計 = 0 | alias 層不要。`normalizeMenuId_` はコメントを残して保留 |
| SELF_* 存在・`SELF_INITIAL_EVAL` なし | `normalizeMenuId_` を読み出し経路に接続。rename は保留可 |
| `SELF_INITIAL_EVAL` あり | 該当行のメニュー名・患者カルテから 3ID のどれかを手動割当 |
| menu_id ↔ 名前不一致あり | 個別に原因調査（メニュー名変更 or 手動誤入力）|

---

## 2026-04-18 追記: 監査結果と normalizeMenuId_ の読み出し経路接続

### 監査結果（JREC live 実行）

| 項目 | 件数 |
|---|---|
| 総データ行数 | 1 |
| SELF_* 系合計 | 0 |
| SELFPAY_* 系合計 | 0 |
| その他合計 | 1 |
| SELF_INITIAL_EVAL | 0 |
| menu_id ↔ メニュー名 不一致 | 0 |

legacy 履歴マイグレーションの必要性は現時点で低い（将来の混入に備えた保険として alias 層を接続）。

### normalizeMenuId_ を接続した関数

| 関数 | 接続箇所 | 効果 |
|---|---|---|
| `readSelfPayDetailsForVisit_V3_` | `menuId:` フィールド生成時 | 自費明細シートの C列（menu_id）に legacy SELF_* が保存されていた場合、画面返却時に SELFPAY_* に統一される |
| `getSelfPayMenuMaster_V3` | `result.push` の menuId | JBIZ 価格マスタ C列（menu_id）に legacy SELF_* が残存していた場合、ダイアログ表示時に SELFPAY_* に統一される |

### SELF_* → SELFPAY_* の実変換表（`JBIZ_MENU_ID_LEGACY_ALIAS`）

| 旧 ID | 新 ID |
|---|---|
| `SELF_CHRONIC50` | `SELFPAY_CHRONIC50` |
| `SELF_EVAL_LOWBACK30` | `SELFPAY_EVAL_LOWBACK30` |
| `SELF_EVAL_NECKSHOULDER30` | `SELFPAY_EVAL_NECKSHOULDER30` |
| `SELF_EVAL_KNEE30` | `SELFPAY_EVAL_KNEE30` |
| `SELF_INITIAL_EVAL` | **alias 未登録**（3分割不可のため手動判断対象）|
| その他（未知 ID） | 現行値維持 |

### v1 動作が維持される理由

1. **シート正本は無変更** — `normalizeMenuId_` は戻り値のみ変換し、`setValue` / `appendRow` / `delete` は一切実行しない
2. **`JBIZ_MENU_SHEET_CANDIDATES` は未変更** — 先頭が `"メニューマスタ（価格設定）" → "価格設定"` のままで、`getJBIZMenuSheet_` は v1 を返す
3. **`pickJbizCol_` は v1 シート名に対し `JBIZ_COL`（旧定義）を返す** — 列位置は従来通り
4. **監査結果で SELF_* / SELFPAY_* 共に 0件** — 現 live データでは alias が作用しない = 従来挙動と同一
5. **書き込み経路（`saveSelfPayDetails_V3_` / `appendSelfPayDetailRow_V3_`）は未変更** — 画面で選択された現行 menu_id をそのまま保存
6. **KPI逆算 / シート式 / 価格設定シートは未変更** — 集計式・参照先に影響なし

### 次ターンで安全にやれる v2 スイッチ内容

- [x] `JBIZ_MENU_SHEET_CANDIDATES` の先頭に `"価格設定_v2"` を追加（昇格）— 2026-04-18 完了
  - 期待通り `getJBIZMenuSheet_` が v2 を返し、`pickJbizCol_` が v2 マップを返した
- [x] v2 切替後にダイアログで物療3種・初回評価3分割が表示されることを確認 — 2026-04-18 完了（live 12 件取得）
- [x] v2 安定動作を確認後、v1 シート rename + 候補配列除外 — 2026-04-18 完了

### 本ターンで意図的に触らないもの

| 項目 | 理由 |
|---|---|
| KPI逆算 C5/C6/C9 の式 | 単価抽出ロジックに依存。v2 切替と同時に見直し |
| 価格設定シート（live） | 書き換え禁止。v1/v2 共に live 修正は別タスク |
| `appendSelfPayDetailRow_V3_` 内の menuId | 画面選択値が既に現行。書き込み時 normalize は逆に保守性低下 |
| 自費明細シートの過去データ（rename） | 監査で SELF_* 0件のため rename 対象が存在しない |

---

## 2026-04-18 追記: v2 切替 live 完了と v1 archive

### live 確認結果

| 項目 | 結果 |
|---|---|
| `getJBIZMenuSheet_` の解決シート名 | `価格設定_v2` |
| 使用列マップ | `JBIZ_COL_V2` (v2 / 17列) |
| `getSelfPayMenuMaster_V3` 取得件数 | **12 件** |
| 物療3種（MICROCURRENT / HIGHVOLTAGE / ULTRASOUND） | 3/3 OK |
| 初回評価3分割（LOWBACK30 / NECKSHOULDER30 / KNEE30） | 3/3 OK |

### 初回評価3分割 MISS の原因と対応

- **原因**: `価格設定_v2` 側の該当3行で **確定状況 = `仮`** になっていたため、`getSelfPayMenuMaster_V3` の `status !== "確定"` フィルタで除外されていた。
- **対応**: シート側で該当3行の確定状況を `確定` に更新（ユーザー手動）。
- **コード修正は不要だった**（`JBIZ_COL_V2` の列マップ・`pickJbizCol_` 共に正しく動作していた）。

### `setupJBIZMenuMasterId_V3` 実行は不要と判断

- 初回評価3分割の 3 行は v2 シートに既に `menu_id` が入っていた（問題は `確定状況` のみ）
- `setupJBIZMenuMasterId_V3` は「未設定行のみ補完」のため、実行しても補完対象 0 件で無害だが、**今ターンは live 書き込み判断を避けて実行しない**
- 今後 v2 に新規メニューを追加する際は、メニュー名が `JBIZ_MENU_ID_MAP` に登録済みなら実行してよい

### v1 archive 操作

- 旧 v1 シート `価格設定` を `価格設定_v1_archive` に rename する一回限り関数 `archiveJbizV1Sheet_V3()` を追加
- GAS メニュー `柔整ツール → 管理者用 → 【1回限り】JBIZ v1 シートを archive` から実行
- 実行前に confirm ダイアログ + 重複実行防止チェック（既に archive 存在 / v2 不在 / v1 不在 のいずれでも中止）
- rename のみ。セル書き換え・削除は一切行わない

### `JBIZ_MENU_SHEET_CANDIDATES` の最終形

```js
const JBIZ_MENU_SHEET_CANDIDATES = [
  "価格設定_v2",  // 正（v2: 17列構造・SELFPAY_* 命名）
];
```

- 旧 `"価格設定"` を除外（archive 後は参照されないため）
- 設計時想定名 `"メニューマスタ（価格設定）"` も除外（実在したことがないため）

### 残タスク（次ターン以降）

- [x] KPI逆算 C5/C6/C9 の v2 参照式への切替 — **GAS実装完了（2026-04-18）。実行待ち**
- [ ] `verifyJbizV2Switch_V3` / `diagnoseEvalMiss_V3` / `archiveJbizV1Sheet_V3` の扱い（当面残置、運用が安定したら削除検討）
- [ ] 自費明細シートの過去データ migrate は引き続き不要（read path の `normalizeMenuId_` で read-only 統一済み）

---

## 2026-04-18 追記: KPI逆算式 v2 移行 GAS 実装

### 列シフト対応表

v2 は v1 に対して C列（中区分）・F列（患者向け表示名）・P列（有効フラグ）が追加されたため、
以下の通り列位置がシフトする。

| v1 列 | 意味 | v2 列 | 変換 |
|---|---|---|---|
| K（index 10） | 主力手技フラグ | M（index 12） | K → M |
| G（index 6） | 一般料金 | I（index 8） | G → I |
| D（index 3） | メニュー名 | E（index 4） | D → E |

### 対象 KPI 式のパターン（v1 参照）

| セル | 式パターン | v1 参照列 |
|---|---|---|
| C5（想定） | `=IF(COUNTIF('価格設定'!K4:K15,TRUE)=1, INDEX(FILTER('価格設定'!G4:G15,...),1), 5000)` | K・G |
| C6（想定） | `=COUNTIF('価格設定'!K4:K15,TRUE)` | K |
| C9（想定） | `=IFERROR(INDEX('価格設定'!G:G,MATCH("月会員",'価格設定'!D:D,0)),0)` | G・D |

### 実装内容（Ver3_core.js 2026-04-18 追加）

| 関数 | 役割 |
|---|---|
| `updateKpiReverseFormulas_V3()` | KPI逆算 C5/C6/C9 の式を v2 参照へ更新（confirm あり・書き込みは setFormula のみ） |
| `convertKpiFormulaToV2_(formula)` | '価格設定'!XX → '価格設定_v2'!YY に変換するヘルパー |

**メニュー:** `柔整ツール → 管理者用 → 【1回限り】KPI逆算式を v2 対応に更新`

### 実行後に確認すること

1. C5/C6/C9 の式が `'価格設定_v2'!M...` / `'価格設定_v2'!I...` / `'価格設定_v2'!E...` になっていること
2. 行範囲（例: `M4:M15`）が v2 の実データ行数（18 件）をカバーしているか確認。不足なら手動で `M4:M25` 等に拡張
3. C5/C6/C9 の計算結果が想定通りか確認

### 実行記録

- [ ] 実行日: 未実施
- [ ] 実行結果: 未確認
