# PROJECT_STATUS.md — 柔整GAS Ver3.1

最終更新: 2026-03-21（結合セル分割廃止・テンプレ結合完全維持・Revision 00016 deploy）

---

## 現在地（2026-03-20 確定）

- プロジェクト: 柔整毎日記録システム Ver3.1
- ディレクトリ: `gas-projects/jyu-gas-ver3.1/`
- 状態: 稼働中（B案確認完了。D2/U5後期高齢者対応確定済み。残課題: D5/U2/U6暫定運用欄公式確認）
- 優先度: 最優先
- ブランチ: `feature/auto-dev-phase3-loop`
- 最新コミット: `8941b19`

### 到達点スナップショット（2026-03-20 更新）

| 項目 | 状態 |
|---|---|
| Cloud Run `jrec-appgen-server` デプロイ | ✅ **Revision 00016 deploy（2026-03-21）** — 選択肢セル分割廃止・テンプレ結合完全維持・SELECTION_OVAL_MAP を full_merge 値に戻す（根本原因修正）|
| `/health` 200 OK 確認済み | ✅ 確認済み（2026-03-21 Revision 00015-g96）。Revision 00016 deploy完了後に再確認要 |
| GAS Script Properties（APPGEN_ENDPOINT / APPGEN_SECRET） | ✅ 設定済み |
| `Ver3_smokeTest.js`（V3TR_smokeHealth / V3TR_smokeGenerate） | ✅ commit 済み |
| `clasp push`（最新 GAS を反映） | ✅ 2026-03-20 済み（7ファイル）|
| GAS → Cloud Run 疎通確認 | ✅ `/health` 200 OK（Revision 00010-h77）。`/generate` は B案実行で確認要 |
| 本番メニュー「【B案】申請書を生成して Drive に保存」 | ⚠️ **B案目視確認が残り** — 結合セル分割廃止（Revision 00016）後の楕円位置・罫線消滅を実帳票で確認要 |
| 申請書上段欄（U1〜U7）実装 | ✅ 全欄実装済み（○専用画像方式 Revision 00012-7mn）|
| 下段 登録記号番号 分割欄書込 | ✅ 修正済み（CR51/DK51/DR51 分割書込、2026-03-20）|
| U6 給付割合 | ✅ **画像方式＋形状微調整済み（2026-03-21）** — KYUFU_OVAL_MAP を4列幅（DS-DV/DQ-DT）に拡張。style="kyufu"（margin_emu=9525）で横長楕円。|
| D4 負傷原因欄 | ✅ **書込先修正（本コミット）** BR20ラベル保持・BR21コンテンツ行書込 |
| B案プリフライト hard error | ✅ 実シート確認済み（2026-03-20）— mineo「患者氏名空欄」で除外ダイアログ表示 OK |
| B案プリフライト warning | ✅ 実シート確認済み（2026-03-20）— mineo「一部負担金割合0 / 窓口負担額0」で警告ダイアログ表示 OK |
| B案 2026-02 申請書生成 3件完了 | ✅ 実シート確認済み（2026-03-20）— 生成3件 / エラー0件 |
| B案高速化 P1（二重build除去） | ✅ 実装完了（2026-03-20）— `V3TR_exportTransferJson_` に `skipBuild` 引数追加、B案ループで `true` 渡し |
| mineo 患者マスタ直接確認（共有復旧後）| ✅ 確認済み（2026-03-20）— `負担割合=0.1`（正値）/ `一部負担金割合`列なし / `保険種別`空欄（Python自動判定で補完）|
| **U5保険種別文字列バグ修正・Revision 00007-vwf** | ✅ **完了（2026-03-20）** — 保険種別が文字列"後期高齢"で格納されるのにNumber("後期高齢")=0になり家族fallbackに落ちていた。名称→数値マップ追加+detectフォールバックで修正。GAS/Python両側修正・clasp push・Cloud Build・Revision 00007-vwf deploy済み |
| **B案最終確認（全患者クリーン）** | ✅ **完了（2026-03-20 人間実行）** — 3件生成 / エラー0件 / mineo warning なし / 目視確認OK / P1（二重build除去）出力不変確認済み |

> **別PC引継ぎ手順:** `docs/JREC-01_別PC再開手順.md` を参照
> **clasp 復旧手順（新PC用）:** `SETUP.md` §8章を参照

---

## ⚠️ 中断前記録（2026-03-20 最終更新）— 次回再開時は必ずここを読む

### 再開の合図

> **「JREC-01 再開：次タスク確認から開始」**

### 現在のプロジェクト状態

**英語日付Python側正規化追加・Revision 00011-24p deploy済み・/health OK。次の必須作業: B案再生成で帳票目視確認（旧ファイルを開き直さず必ず再生成すること）。**

| カテゴリ | 状態 | 詳細 |
|---|---|---|
| B案申請書生成 | ✅ **本番稼働可能** | 3件生成/エラー0件/全患者クリーン（2026-03-20確認済み）|
| 申請書上段欄 U1〜U7 | ✅ 全欄実装済み | U2/U5/U6 は暫定運用（制度公式確認が残課題）|
| D2 継続月数・頻回 | ✅ **設計確定・内部実装済み** | 正本=摘要欄+長期欄（手動）。M31空欄許容。A16:B20院内メモ（請求正本外）。clasp push / Cloud Run rev.00004-kc9 / ロジックテスト6ケースPASS（2026-03-20）|
| D5 施術証明欄 | ❌ 未実装 | 手書き運用継続。優先度低 |
| U5 後期高齢者本家区分 | ✅ **確定・実装済み** | 保険種別=6 or 75歳以上 → 高一（DH8）基本 / 7割給付（負担3割）のみ高7（DH12）。本人/家族区分は不使用（2026-03-20）|

### 再開時に最初に読むべきファイル

1. **このファイル（PROJECT_STATUS.md）** → 「今回完了したこと」と「まだ残っていること」を確認
2. `docs/JREC-01_申請書様式運用メモ.md` → 各欄の詳細・暫定運用注記・制度定義
3. `SPEC.md §22` → 申請書欄 実装状況テーブル・残課題リスト

### 今回の実ファイル確認（B案再生成）で確定した値

| 項目 | 確定値 | セル | 備考 |
|---|---|---|---|
| 都道府県番号 | **28** | CI2 | 兵庫県。設定シート固定値 |
| 施術機関コード | **2804440-0-0** | CZ2 | 登録記号番号から先頭「契」除去・ハイフン保持（暫定）|
| 単併区分 | **①.単独** | CT8 | 固定値 |
| 登録記号番号（左欄） | **契2804440** | CR51 | ハイフン前の部分（先頭「契」含む）|
| 登録記号番号（中欄） | **0** | DK51 | 1つ目ハイフン後 |
| 登録記号番号（右欄） | **0** | DR51 | 2つ目ハイフン後 |
| U6 9割給付（割合=1） | **10・⑨** | DP8 | '９'のみ丸付け（片側）|
| U6 8割給付（割合=2） | **⑧・７** | DP11 | '８'のみ丸付け（片側）|
| U6 7割給付（割合=3） | **８・⑦** | DP11 | '７'のみ丸付け（片側）|
| 後期高齢者 保険種別 | **⑥.後期** | CJ11 | 保険種別=6 |
| 後期高齢者 U5 本家区分 | **⑧高一**（期待値） | — | 保険種別文字列バグ修正済み（00007-vwf）。B案再生成で確認要 |
| 後期高齢者 U6 給付割合 | **10・⑨** | DP8 | 一部負担金割合=1（後期一般）|

### 実ファイル確認対象患者

| 患者ID | 概要 | 確認内容 |
|---|---|---|
| hirayamaka | 一般患者 | U1/U2/U4/U5/U6/U7/下段登録記号番号 全欄確認 |
| touji | 一般患者 | 主要欄確認 |
| mineo | 後期高齢者（保険種別=6） | 保険種別⑥・U5空欄・U6=10・⑨ 確認 |

> **総評:** 概ねうまくいっている。制度未確定領域（後期高齢者U5、高7表示）はまだ残る。

### 実シート確認結果（2026-03-20）

#### ✅ 確認済み（全項目）

| 確認内容 | 結果 | 備考 |
|---|---|---|
| B案で 2026-02 申請書生成（初回）| ✅ 3件生成 / エラー0件 | hirayamaka / touji / mineo |
| hard error ダイアログ表示 | ✅ 正常表示 | mineo「必須項目「患者氏名」が空」で除外確認ダイアログ表示 |
| hard error 除外後の他患者生成 | ✅ 確認済み | 問題患者を除外して他患者のみ生成が動作 |
| warning ダイアログ表示（検知テスト）| ✅ 正常表示 | mineo に一部負担金割合0 / 窓口負担額0 の warning が表示された |
| hard error / warning の画面文言 | ✅ 読める | 患者ごとに箇条書き・日本語文言で確認 |
| **B案最終確認（全患者クリーン）** | ✅ **3件生成 / エラー0件** | 2026-03-20 人間実行。mineo warning なし。目視確認OK |
| **mineo warning W1 消滅確認** | ✅ **出ないことを確認** | `負担割合=0.1` → `一部負担金割合=1` 自動導出 → warning 不発火 |
| **P1（二重build除去）後の出力不変確認** | ✅ **変化なし確認** | ファイル生成数・内容が従来と同じ |
| **生成ファイル目視確認** | ✅ **OK** | 氏名・保険者番号・金額・各欄いずれも問題なし |

#### 🔍 mineo 患者マスタ直接確認結果（2026-03-20 共有復旧後）

**確認方法:** サービスアカウント `id-719@e-carte-448107.iam.gserviceaccount.com` → スプレッドシート共有復旧 → gspread で 患者マスタ シートを直接取得（2026-03-20）。

**スプレッドシートID（確定）:** `1rXWkfAc_ppOfMV5Dxmb3maX9ORVrZbpSOX2Lz7RouZM`

**患者マスタ構造の判明事項:**

| col | 列名 | mineo の値 |
|---|---|---|
| 10 | 負担割合 | **0.1**（= 1割負担 = 10%） |
| 11 | 保険種別 | **空欄** |
| 12 | 保険者番号 | **39282256**（法別番号 39 = 後期高齢者） |

> **重要:** `一部負担金割合` という列は患者マスタに存在しない（45列を全確認）。

**制度上の根拠とシステムの判定ロジック:**

| 項目 | 内容 |
|---|---|
| 後期高齢者一般の負担割合 | 1割（0.1）|
| システム設定値（一部負担金割合桁）| 1 = 1割 / 2 = 2割 / 3 = 3割 |
| 自動導出ロジック | `V3TR_pickBurdenDigit_`: `負担割合=0.1` → `Math.round(0.1×10)=1` → 桁=1 |
| 期待 U6 | DP8 '10・⑨'（割合=1 → '９'→'⑨'置換）|

**保険種別の自動判定（Python側）:**

| 項目 | 内容 |
|---|---|
| 保険者番号 | 39282256（8桁）→ 先頭2桁 = 39 = 後期高齢者医療の法別番号 |
| `detect_insurance_type("39282256")` | → 6（後期高齢） |
| 申請書出力 | INSURANCE_TYPE_CELLS[6] → CJ11 '⑥.後期'（確認済み）|
| GAS側の年齢チェック | 昭和20年4月24日 = 1945年生 → 2026年時点81歳 ≥ 75歳 → 後期高齢者 ✓ |

**結論: 修正前値 / 修正後値 / 対応:**

| 項目 | 確認前想定 | 実際の値（直接確認）| 対応 |
|---|---|---|---|
| 一部負担金割合（列） | 0 または空欄（列あり想定）| **列が存在しない** | 対応不要（列を追加する設計ではない）|
| 負担割合 | 不明 | **0.1**（正しい。1割負担）| 修正不要 — 既に正値 |
| 保険種別 | 不明 | **空欄** | 修正不要 — Python が保険者番号から自動判定 |

> **前セッション warning の根本原因（推定）:** B案実行時点で `負担割合` が 0 または空欄だった可能性、もしくは転記データシートにキャッシュされた古い行が `一部負担金割合=""` を持っていた可能性。現在の `負担割合=0.1` であれば次回B案実行時は warning W1 は発火しない。

**B案最終確認（実行可否）:**
- GAS実行（スプレッドシートのメニュー操作）は Claude Code から不可
- **次回確認手順:** スプレッドシートを開く → 「柔整ツール」>「【B案】申請書を生成して Drive に保存」→ 2026-03（または2026-02）を指定 → プリフライト warning W1 が mineo で出なくなることを確認

### 今回修正して解消した不具合

| 不具合 | 原因 | 対応 | コミット |
|---|---|---|---|
| U6 が両方丸になっていた | `⑧・⑦` 固定文字列全体を書き込んでいた（セル置換方式が誤り）| KYUFU_CHAR_MAP で片側1文字のみ置換する方式に修正（U5と同方式）| b6a7c79 |
| 登録記号番号をラベル行（CR49）へ上書きしていた | テンプレート CR49:DV50 がラベル行であることを未確認のまま書込していた | openpyxlスキャンで入力欄（CR51/DK51/DR51）を確定し分割書込に修正 | b6a7c79 |
| B案再生成が最新実装を反映しない | clasp push は GAS のみ更新。Python（write_application.py）は Docker イメージに焼き込まれており Cloud Run 未再デプロイだと旧コードが動く | Docker rebuild（Cloud Build） + Cloud Run redeploy（Revision 00003-9mh）実施 | — |
| **B案で特定患者がスキップされると全員失敗する** | `patientCount` をループ前に `patientIds.length` で確定 → スキップ発生時に Python `validate_batch_safe` が patientCount不一致を検出 → `ValueError` → HTTP 400 → 全患者失敗 | ① patientCount後補正（A案・B案両方）: ループ後に `ndjsonLines.length - 1` で上書き。② B案プリフライト追加: Cloud Run POST前にcase1必須キーを GAS側検証、問題患者を除外して続行可能に | bed4550 |
| **負担割合0や金額不整合でも検知なしに POST していた** | プリフライトが「空かどうか」しか見ておらず、0値・金額合計不一致を見逃していた | ③ B案プリフライト第2段（warning）追加: 当月合計>0 の場合に 一部負担金割合0 / 窓口負担額0 / 請求金額0 / 合計不一致 を `preflightWarnings` として収集。除外なし・確認ダイアログのみ表示（ok→続行 / いいえ→中断）| ce9cda7 |
| **B案で1患者あたり build が2回実行されていた** | `V3TR_exportTransferJson_` 内が `V3TR_buildTransferDataForMonth_` を内部呼出していたためループ内で build が二重実行 | P1 二重build除去: `V3TR_exportTransferJson_` に `skipBuild` オプション引数を追加。B案ループ側で `build` 後に `skipBuild=true` で呼ぶことで 1患者1回に削減。他の呼び出し元（A案・A案個別）には影響なし | 2600dcb |
| **mineo U5=⑥家族 誤表示（保険種別文字列バグ）** | `保険種別` がGASマスタで `"後期高齢"` 等の名称文字列で保存されているのに、`V3TR_deriveHonkeku_`/`derive_honkeku_cell` が `Number("後期高齢")` = 0 に変換し後期高齢判定をスキップ → 続柄空白 → "家族" fallback | GAS: `INS_TYPE_NAME_MAP_` 追加（名称→数値変換）。Python: `_INS_TYPE_NAME_MAP` + `detect_insurance_type` fallback 追加。両側 clasp push / Cloud Build / Revision 00007-vwf 反映済み | 9d0e398 |
| **英語日付混入（"Mon Feb 02 2026..."）** | `V3TR_loadInitInfo_` の `get()` が `String(dateObj)` で英語Date文字列化。「負傷の日時」列がDate型セルの場合に発生。Python側では`put_wareki_ymd`をスキップするが、D4の`injury_text`に混入する | GAS: `get()` で `instanceof Date` チェック→`Utilities.formatDate("yyyy/MM/dd")` 変換 | （本コミット）|
| **「負傷の原因」D4書込先ずれ（再修正）** | `BR20:DV24`はラベル＋内容が同一結合セル。旧修正（E44/摘要欄）は暫定対応で意味的に誤り | Python: `BR20:DV24`をoutputファイル内のみ分割→BR20:DV20ラベル行（"負傷の原因"保持）＋BR21:DV24コンテンツ行。`D4_INJURY_CONTENT_CELL = "BR21"` に書込 | （本コミット）|
| **丸付けレイアウト崩れ（性別/保険種別/単独区分/本家区分）** | 文字置換方式（"1"→"①"等）がセルの文字縮小・位置ずれを引き起こしていた。テンプレートの固定ラベル文字も置換対象になりレイアウトが崩壊 | Python: `SELECTION_SPLIT_MAP`で各選択肢の結合セルをラベル行＋マーカー行に分割。テンプレート文字は保持し、マーカー行に"○"のみ書込む○専用セル方式に全面切替（`_apply_selection_splits` / `_write_selection_marker`）| c039ff7 |
| **テンプレート xlsx 日本語名 Cloud Build 失敗** | `療養費支給申請書.xlsx` の日本語ファイル名が Cloud Build 環境で文字化けし `COPY` ステップでファイル未検出 | `application_template.xlsx` に英数字リネーム。Dockerfile・write_application.py `TEMPLATE_FILE` を同名に修正 | ce29f9f |
| **英語日付文字列が D4 負傷の日時に混入** | GAS String型セル（`"Mon Feb 02 2026..."`）は `instanceof Date` チェックをすり抜け Python に英語日付文字列として渡る | Python側: `_normalize_date_str()` 追加。`_build_injury_text` 内で英語日付→YYYY/MM/DD正規化。GAS側修正の安全網 | 8941b19 |
| **旧ファイル（00008-8rx出力）が問題の出所** | 14:05 UTC に 00008-8rx でB案実行 → 14:13 UTC に 00010-h77 deploy。ユーザーは deploy 前のファイルを参照していた | 旧経路ではない。同一 URL でも deploy 前後でリビジョンが変わる。ファイル再生成で解消 | — |

### 今回完了したこと（2026-03-20）

| 項目 | 完了内容 |
|---|---|
| B案最終確認 | 3件生成 / エラー0件。プリフライト warning なし（全患者クリーン）|
| mineo warning W1 解消確認 | 負担割合=0.1 → 一部負担金割合=1 自動導出。warning 発火なし |
| P1（二重build除去）動作確認 | 出力ファイル数・内容が変わらないことを確認 |
| 申請書目視確認 | 氏名・保険者番号・金額・各申請書欄 いずれも OK |
| mineo 患者マスタ直接確認 | 共有復旧後 gspread 経由で確認。修正不要（負担割合=0.1 は正値）|
| JREC-01スプレッドシートID確定 | `1rXWkfAc_ppOfMV5Dxmb3maX9ORVrZbpSOX2Lz7RouZM` |
| **U5保険種別文字列バグ修正** | 根本原因: 保険種別の名称文字列("後期高齢")→数値変換漏れ。GAS/Python両側にINS_TYPE_NAME_MAPを追加。Revision 00007-vwf deploy済み |
| **○専用セル方式 全面実装** | 性別/保険種別/単独区分/本家区分の4項目を`SELECTION_SPLIT_MAP`方式に切替。テンプレート固定ラベル保持＋マーカー行"○"書込。openpyxlコードのみ変更（Cloud Run 再デプロイで反映）|
| **D4 書込先再修正（BR21）** | BR20:DV24を出力ファイル内で分割→BR20ラベル行保持・BR21コンテンツ行書込。E44摘要汚染なし。動作テスト確認済み（c039ff7）|
| **テンプレ英数字リネーム** | `療養費支給申請書.xlsx` → `application_template.xlsx`。Dockerfile・TEMPLATE_FILE修正。Cloud Build 文字化け問題を解消（ce29f9f）|
| **Cloud Run Revision 00011-24p deploy** | 英語日付正規化追加・全修正を反映。`/health` 200 OK 確認済み（2026-03-20）|

### まだ残っていること（次の作業候補）

| 優先 | タスク | 種別 | 理由 |
|---|---|---|---|
| **0** | **B案再生成で帳票目視確認** | **必須・次の作業** | **Revision 00010-h77 deploy済み。スプレッドシートから B案を実行し、○専用セル方式（4項目）・D4 BR21書込が帳票上で正しく表示されるか目視確認** |
| 1 | D5 施術証明欄・委任欄 | 未実装（低優先）| 手書き運用で当面は問題なし |
| 3 | ~~U5 後期高齢者の本家区分~~ | ✅ **確定済み（2026-03-20）**| 高一（DH8）基本 / 7割給付（負担3割）のみ高7（DH12）|
| 4 | U2 施術機関コード | 暫定運用 | 先頭「協/契」除去・ハイフン保持の公式根拠未確認。現行値は実務上OK |
| 6 | U6 給付割合 | 暫定運用 | 一部負担金割合からの逆算方式。公式要領での直接確認未完了 |
| 5 | 高7 の "⓪" 表示確認 | 未確認 | Unicode U+24EA が帳票上で正しく表示されるか実機確認が必要 |
| 7 | D4 3部位ケースの実案件確認 | 要確認 | row2["部位1_計"]>0 の判定が実案件で正しく動くか確認 |

### Dashboard反映状況

| 対象 | 状態 | 詳細 |
|---|---|---|
| Run_Log シート | ✅ 反映済み | `Run_Log!A48:J48`（D2/M31整合化完了 2026-03-20）|
| Projects シート | ✅ 反映済み | `Projects!A4:M4` 次アクション・最終更新日更新済み |
| GitHub（コード） | ✅ 反映済み | commit ce29f9f（feature/auto-dev-phase3-loop）|
| Cloud Run Revision | ✅ **反映済み** | **00011-24p**（英語日付Python正規化・○専用セル方式・D4 BR21書込・テンプレ英数字リネーム 2026-03-20）|
| JREC-01スプレッドシート（患者マスタ） | ✅ 読取アクセス可能 | 共有復旧済み（2026-03-20）。gspread で患者マスタ確認済み。**スプレッドシートID: `1rXWkfAc_ppOfMV5Dxmb3maX9ORVrZbpSOX2Lz7RouZM`** |
| JREC-01スプレッドシート（患者マスタ書込） | ⚠️ 未実施 | 今回確認の結果、修正不要と判明。書込権限は共有設定次第 |

> **次回 de 実行時に Run_Log / Projects も自動更新される。今回は手動同期スキップ。**

---

## 概要

接骨院の患者管理・保険算定・申請書作成を支援する Google Apps Script システム。
スプレッドシートをUIとして、来院登録から療養費支給申請書作成までを扱う。

---

## 完了済み

- `Ver3_core.js` に来院登録・区分判定・算定中枢ロジックを実装
- `Ver3_amounts.js` に金額計算を実装
- `Ver3_transferData.js` に申請書転記処理を実装
- `Ver3_patientPicker.js` に患者選択UIを実装
- `write_application.py` に申請書生成処理を実装
- `SPEC.md`、`PLAN.md`、`TESTCASES.md` を整備
- JBIZ-04 との役割分担を整理し、毎日記録ブックを日次入力の正本に固定
- 来院ヘッダの最小列追加について、追加位置・正式列名・選択肢マスタ案・月次KPI対応・リスク整理を文書化
- 来院ヘッダに `会計区分 / 自費メニュー区分 / 自費売上額 / 慢性候補フラグ / 次回予約あり / 新規区分` を末尾追加できる実装を反映
- `設定` シート `E:I` に選択肢マスタを持てるようにし、来院ヘッダの入力候補設定まで連動させた
- service account 経由で live スプレッドシートの現状を確認し、`設定` は実質 `A:D` 使用中・`E:I` 未使用、`来院ヘッダ` の現行末尾は `caseIndex` であることを確認

---

## 次アクション

> 最終更新: 2026-03-17（168ecfc — exportHeaderFromCases_V3 新3列配線完了）
> 次: 下記「次タスク候補」参照。

### ✅ exportHeaderFromCases_V3 新3列配線 完了（2026-03-17）

- `Ver3_core.js` に事前集計パス追加（visitKey → kubun1/kubun2 マップ）
- `Mixed区分 / case1要約 / case2要約` の3列をkubunから生成して書き込み
- `算定区分 / 課金理由要約` は空のまま維持（金額計算・保存で上書きされる）
- `case2要約` の初検抑制表現は近似（`"case2:初検"`）。金額計算後に正確値で上書きされる
- 確認状況: 既存ヘッダ全件が出力済みのため export 新規追加でのlive確認は省略。コードレビュー確認完了扱い
- **live 再確認予定: 来院ヘッダ再構築時（リセット→一括 export するタイミング）**
- commit: `168ecfc`

### ✅ transferData 表示列 正式仕様整合 完了（2026-03-18）

- `Ver3_transferData.js` の Mixed区分 / case1要約 / case2要約 / 算定区分 / 課金理由要約 を header 側正式仕様に整合
- **case2:初検(抑制)** 判定を追加: `case1.endDate < case2.startDate`（厳密）= [B] 治癒後 → 抑制なし / それ以外 = [A] 施術継続中 → 抑制
- **算定区分** を transferCols に追加: 初検/再検/後療/算定なし（`_effInitFee` で抑制フラグを反映、金額計算は変えない）
- **課金理由要約** を transferCols に追加: header 側と同一7パターンルール
- commit: （本 commit）

#### 整合確認観点（M01〜M03 / TC03）

| ケース | Mixed区分 | case1要約 | case2要約 | 算定区分 | 課金理由要約 |
|---|---|---|---|---|---|
| M01（case1=再検 / case2=初検抑制）| Mixed | case1:再検 | case2:初検(抑制) | 再検 | 初検抑制のため再検採用 |
| M02（case1=再検 / case2=初検算定可）| Mixed | case1:再検 | case2:初検 | 初検 | 算定可能な初検ありのため初検採用 |
| M03（case1=後療 / case2=初検抑制）| Mixed | case1:後療 | case2:初検(抑制) | 後療 | 初検抑制かつ再検対象なし |
| M05（case1=後療 / case2=再検）| Mixed | case1:後療 | case2:再検 | 再検 | 再検ありのため再検採用 |
| TC03（case1=後療のみ）| 通常 | case1:後療 | case2:なし | 後療 | 後療のみ |

#### 未解決論点（引き続き保留）

- M01 のケース: case1=再検(継続中)、case2=初検(抑制) のとき `V3TR_countKubunInCases_` は initCount=1 を返す（case2の初検を金額計算に含める）が、amounts.js は initFee=0 を算定する。金額不整合が残る。今回は「金額計算の正本は変えない」方針のため未修正。算定区分 display 列は `_initSuppressed` フラグで正しく表示できる。
- live 確認は次回転記再生成時（clasp push → 転記データ再生成）で実施する

### ✅ transferData 表示列 実シート確認 完了（2026-03-18）

| パターン | 実例 | 算定区分 | Mixed区分 | case1要約 | case2要約 | 課金理由要約 | 判定 |
|---|---|---|---|---|---|---|---|
| M01 | hirayamaka_2026-03-09 | 再検 | Mixed | case1:再検 | case2:初検(抑制) | 初検抑制のため再検採用 | ✅ OK |
| M03 | touji_2026-03-10 | 後療 | Mixed | case1:後療 | case2:初検(抑制) | 初検抑制かつ再検対象なし | ✅ OK |
| TC03 | mineo_2026-03-03 | 後療 | 通常 | case1:後療 | case2:なし | 後療のみ | ✅ OK |

- clasp push（707e3d1）→ 転記データ再生成 → 3パターン全て正式仕様と整合確認済み
- case2:初検(抑制) が M01 / M03 で正しく出力されることを実シートで確認

### ✅ M06b fixture 追加 完了（2026-03-18）

- `Ver3_test.js` に `M06b` fixture & expected を追加（JREC01_FIXTURES_ / JREC01_EXPECTED_）
- `tests/jrec01/fixtures/M06b_治癒後別負傷_case2初検.json` / `expected/` 追加
- `runFixtureM06b()` ラッパー関数追加
- `TESTCASES.md` の M06b セクションに fixture 仕様・金額不整合の確認箇所を追記
- fixture カウント: 46 → 47 件（PASS 確認は clasp push → runFixtureSuite() で実施すること）

**fixture 設計の要点:**

| 項目 | 設計判断 |
|---|---|
| テスト対象レイヤー | per-visit 計算（computeAmountsFromFixture_V3_）|
| treatDate | 2026-02-15（case1は2/10治癒済、case2新規初検）|
| initBilled=false | isCaseEndedBefore_ が確定した状態を monthlyStatus に直接設定 |
| reBilled=true | case1の再検(2/04)算定済・月内グローバルフラグ |
| reFee=0 | per-visit グローバル reBilled=true による抑制 |
| reBilled=true 影響 | M06b は hasReexam=false（case2=初検）のため reBilled は reFee に無関係。[A] 抑制は TC09b 参照。 |

### ✅ [A]施術継続中 再検料抑制バグ修正 完了（2026-03-18）

**問題:** [A] 施術継続中シナリオで case2=再検の来院日に reFee=410 が誤算定されていた。
**根本原因:** `calcHeaderAmountsByVisitKey_V3_` の reFee 判定に `!monthlyStatus.reBilled` チェックが欠落。`getMonthlyBilledStatus_` も reBilled に `isCaseEndedBefore_` を適用していなかった。

| ファイル | 対象関数 | 変更内容 |
|---|---|---|
| Ver3_amounts.js | `getMonthlyBilledStatus_` | reBilled 立てる前に `isCaseEndedBefore_` で [B] 判定 → suppressReBilled 時は reBilled=false を維持 |
| Ver3_amounts.js | `calcHeaderAmountsByVisitKey_V3_` | reFee 条件に `!monthlyStatus.reBilled` を追加 |
| Ver3_test.js | `computeAmountsFromFixture_V3_` | reFee 条件に `!ms.reBilled` を追加（production と同期） |
| Ver3_test.js | JREC01_FIXTURES_ | TC09b fixture 追加（[A] case1後療 / case2再検 / reBilled=true → reFee=0） |
| Ver3_test.js | JREC01_EXPECTED_ | TC09b expected 追加（reFee=0, visitTotal=1010） |

**修正後の[A]/[B]挙動整理:**

| シナリオ | isCaseEndedBefore_ | reBilled | reFee（case2再検来院日） |
|---|---|---|---|
| [A] 施術継続中 | false | true | 0（抑制）✅ |
| [B] 治癒後別負傷 | true | false（suppressReBilled） | 410（許可）✅ |

- fixture カウント: 47 → **48 件**（TC09b 追加）
- M06b fixture note の誤記（"per-visit reFee=0 だが V3TR=820"）を修正済み

### ✅ B-3: SPEC.md §14 実装整合更新 完了（2026-03-19）

- 施術明細列数を 23 → 27 に修正（metalChk / exerciseChk / metalOut / exerciseOut 追加）
- 列テーブルに §18.3 対応の4列を追記
- 行合計_確定の式に `+ metalOut + exerciseOut` を追加
- データフローの戻り値に metalOut / exerciseOut / metalChk / exerciseChk を追記
- fixture 48/48 PASS・TC09b 実シート確認を反映

**JREC-01 テストフェーズ（B-1〜B-3）完全クローズ**

### ✅ 特殊骨折制限 fixture 実装完了（2026-03-19）

- fixture/expected JSON（TC23a〜TC25b 9件）作成
- Ver3_test.js: `JREC01_FIXTURES_` / `JREC01_EXPECTED_` / wrapper関数 追加
- Ver3_amounts.js: §20 継続理由書アラートを骨折/不全骨折除外に修正
- Ver3_test.js: TEST_SETTINGS_._rawMap に 整復料_骨折_*/固定料_* 単価 14件追加
- fixture 件数: 48 → 57（TC23a〜TC25b 9件追加）
- clasp push 済み（2026-03-19）
- **✅ 57/57 PASS 確認済み（2026-03-19 GAS エディタ runFixtureSuite()）**

**実装済み fixture:**

| TC | 傷病 | 部位 / 条件 | ポイント |
|---|---|---|---|
| TC23a | 骨折 | 膝蓋骨（未定義部位） | base=0 + 要確認 |
| TC23b | 骨折 | 腰椎（脊椎） | base=0 + 要確認 |
| TC23c | 骨折 | 胸骨 | base=0 + 要確認 |
| TC23d | 骨折 | 大腿（定義済み） | base=11800 正常算定 |
| TC24a | 不全骨折 | 肩甲骨（未定義部位） | base=0 + 要確認 |
| TC24b | 骨折 | 後療 monthsElapsed=14 | ltCoef=1.0（長期減額対象外） |
| TC24c | 不全骨折 | 後療 monthsElapsed=14 | ltCoef=1.0（同上） |
| TC25a | 脱臼 | 後療 monthsElapsed=5 | ltCoef=0.75 + 継続理由書アラート |
| TC25b | 骨折 | 後療 monthsElapsed=3 | ltCoef=1.0 + アラートなし（§20 骨折対象外） |

### ✅ 特殊骨折制限 制度整理・fixture 設計 完了（2026-03-19）

- `FRACTURE_RESTRICTION.md` 作成（同ディレクトリ）
- 骨折/不全骨折/脱臼 の算定可否ルールを令和6年改正通知根拠で整理
- 現行実装の安全弁（mapBuiToSettingKey_ 未登録 → base=0）を確認・文書化
- TC23a〜TC25b 合計 9 件の fixture 境界ケース設計完了（実装も同日完了）
- 未実装事項（医師同意制御・特殊骨折医師依頼後療特例）を記録

### ✅ B案 帳票整合 設計方針確定（2026-03-19）

> 公式様式差分の対応方針を確定。実装前にドキュメント先行で記録。
> 詳細仕様は SPEC.md §22（差分修正方針）・§23（負傷名UI分割入力 設計案）を参照。

#### 確定方針

| # | 方針 | 対象差分 | 実装フェーズ |
|---|---|---|---|
| P1 | 施術継続中でも「施術終了年月日」は対象月の当該部位の最終施術日を入れる | D1 | ✅ **部位別maxDate対応済み（2026-03-19）** |
| P2 | 転帰は治癒・中止・転医のみ記載。継続中は空欄運用 | D1 | ✅ 現行実装で対応済み（setupTenkiValidation_ / H12,13,36,37）|
| P3 | 負傷名UIを「完成文字列選択」から「部位マスタ＋左右/上下＋傷病名」の分割入力へ移行 | D3 | 次フェーズ（設計完了後に実装） |
| P4 | 左右/上下は部位マスタの属性で条件表示する | D3 | 次フェーズ（P3と同時） |
| P5 | case別受傷日UIの見直しは保留 | — | 保留 |

#### コード調査結果（確認済み）

| 箇所 | 現行実装 | P1の変更必要性 |
|---|---|---|
| `Ver3_transferData.js:476` | `cs.endDate1 \|\| ""` （終了時のみ） | `cs.endDate1 \|\| aggDates.maxDate \|\| ""` に変更 |
| `Ver3_transferData.js:485` | `cs.endDate2 \|\| ""` （終了時のみ） | 同上 |
| `readRowNewUI_:657` | H列 = 転帰（治癒/中止/転医）読み込み済み | 変更不要（P2対応済み） |
| `ensureSettingsRows_V3` D列 | `右足関節`/`左足関節` 等の展開済み完成文字列を登録 | P3で部位マスタ方式に置き換え |

#### 実装インパクト概要

| 方針 | 変更ファイル | 変更規模 | リスク |
|---|---|---|---|
| P1 | `Ver3_transferData.js` 2行 | 最小（2行） | 転記データの施術終了欄が毎月入るようになる。意図通り |
| P2 | なし | ゼロ | なし |
| P3/P4 | `Ver3_core.js`（UI/validation/write）・`Ver3_transferData.js`（label生成） | 大（列構成変更）| 既存来院ケースデータとの互換性確認が必要 |

---

### ✅ B案 公式様式差分 整理完了（2026-03-19）

> B案メニュー実行・Drive出力OK後、実際の申請書と公式様式を照合して確認済みの差分を記録。
> 実装前に docs への記録を先行させる方針（SPEC.md §22 / TESTCASES.md TC-B01〜TC-B05 参照）。

#### 確認済み差分一覧（公式様式照合）

| No | 差分項目 | 現状 | 影響レイヤー | 優先度 |
|---|---|---|---|---|
| D1 | 施術終了年月日が未転記 | ✅ **実ファイル確認済み・クローズ（2026-03-19）** — 部位別maxDate二次fix + 実日数も確認済み | `Ver3_transferData.js:469-485` 修正・確認完了 | ~~高~~ **DONE** |
| D2 | 継続月数・頻回欄が未対応 | ✅ **設計確定・内部実装完了（2026-03-20）**— `V3TR_calcD2Keizoku_` 新設。正本=摘要欄（継続月数手動記入）＋長期欄（頻回→0.5・長期のみ→0.75、手動記入）。M31は空欄許容（補助表示扱い）。A16:B20（患者画面経過手入力）は院内メモ・請求正本外。clasp push + Cloud Run rev.00004-kc9 デプロイ済み | `Ver3_transferData.js` + `write_application.py` | ~~高~~ **DONE** |
| D3 | 負傷名の左右表記粒度 | `V3TR_buildInjuryLabel_` は `bui + byomei` 単純結合。左右が部位名に含まれる前提か不明 | `Ver3_transferData.js` ラベル生成 | **中** |

#### 申請書上段・31行目 未点検欄 点検タスク（2026-03-20 新設）

> **方針**: 「毎月必ず触る欄」で記載漏れになっていないかを整理。コード変更は今回なし。

| No | 欄名 | セル（✅=確定）| GAS側 | Python側 | 正本候補 | 優先度 |
|---|---|---|---|---|---|---|
| U1 | 都道府県番号 | ✅ **CI2**（CI2:CL3）| ✅ 設定シート「都道府県番号」→CI2 | ✅ clinic_info["prefectureNo"]→CI2 | 設定シート固定値（施術機関所在都道府県、2桁） | ~~中~~ **DONE** |
| U2 | 施術機関コード | ✅ **CZ2**（CZ2:DV3）| ✅ 登録記号番号から先頭協/契除去（ハイフン保持）→CZ2（暫定）| ✅ derive_clinic_code()→CZ2（暫定）| 設定「登録記号番号」の先頭協/契除去値（暫定: ハイフン保持）| ~~中~~ **DONE** |
| U3 | 保険種別 | ✅ CB8〜CJ11（○付）| ✅ `master.insuranceType` | ✅ `INSURANCE_TYPE_CELLS` で○付 | 保険者番号から自動判定 or 患者マスタ | **DONE** |
| U4 | 単併区分 | ✅ **CT8**（単独）/ CT10（2併）/ CT12（3併）| ✅ CT8 "1.単独"→"①.単独" 書込 | ✅ put_era_circle(ws,"CT8",1) | 固定「単独」→CT8 / 将来: 患者マスタ「公費区分」 | ~~中~~ **DONE** |
| U5 | 本家区分 | ✅ **DB8**（本人）/ DB10（六歳）/ DB12（家族）/ DH8（高一）/ DH12（高7）| ✅ `V3TR_deriveHonkeku_()` 後期高齢対応確定 | ✅ `derive_honkeku_cell()` 後期高齢対応確定 | 後期高齢者（保険種別=6 or 75歳以上）→ 高一基本 / 7割給付のみ高7。本人/家族は70歳未満のみ | ~~中~~ **DONE** |
| U6 | 給付割合 | ✅ **DP8**（10・9割）/ **DP11**（8・7割）| ✅ `KYUFU_CHAR_MAP` 片側丸付け（修正2026-03-20）| ✅ `KYUFU_CHAR_MAP` 片側丸付け（修正2026-03-20）| 割合1→DP8('⑨')/2→DP11('⑧')/3→DP11('⑦')| ~~中~~ **DONE** |
| U7 | 請求区分（新規・継続） | ✅ **DH31**（DH31:DV31）| ✅ `row["請求区分"]`生成済み | ✅ `put(CELL_MAP["請求区分"], ...)`実装済み | 初検月=対象月→新規 / 前月以前→継続 / 同月内治癒再発→両方○（将来対応） | ~~高~~ **DONE** |

#### 各欄の詳細（2026-03-20 制度定義整理後）

**U1: 都道府県番号** — ✅ 実装済み（2026-03-20）★★☆
- 施術機関の所在都道府県コード（2桁）。保険者の都道府県ではない
- 設定シートキー: `都道府県番号` → CI2 に書込
- GAS: `V3TR_loadClinicInfo_()` で読み込み → `V3TR_writeToApplication_` で CI2 書込 / A案・B案 meta に付加
- Python: `clinic_info["prefectureNo"]` → `CELL_MAP["都道府県番号"]` (CI2) に書込

**U2: 施術機関コード** — ✅ 実装済み（2026-03-20、修正2026-03-20）★★☆（★暫定運用★）
- 国保連が受領委任届出後に付番する施術所固有コード
- **暫定ルール**: 設定シート「登録記号番号」から先頭「協/契」の1文字のみ除去。ハイフンはそのまま保持して CZ2 に書込
  - 例: `契2804440-0-0` → `2804440-0-0`
  - ★ 公式一次資料での確認未完了。正式な施術機関コード体系が確認できた時点で要見直し
- GAS: `V3TR_deriveClinicCode_()` / Python: `derive_clinic_code()`

**下段 登録記号番号** — ✅ 実装済み（2026-03-20）→ 分割欄修正済み（2026-03-20）
- CR49:DV50 はラベル行「登録記号番号」→ **書き込み禁止**（旧実装の誤りを修正）
- 分割欄: 左=**CR51**:DH52 / 中=**DK51**:DO52 / 右=**DR51**:DV52（openpyxlスキャンで確定）
- 書込方式: `torokuKigoNo` をハイフンで3分割して各欄に記入。例: `契2804440-0-0` → 左=`契2804440` / 中=`0` / 右=`0`
- U2（CZ2・先頭協/契除去・ハイフン保持）とは別管理

**U4: 単併区分** — ✅ 実装済み（2026-03-20）★★☆
- 「単独」= 健保/国保単独。当面は固定「単独」で CT8 に書込
- CT8 テンプレート値 "1.単独" → "①.単独" にテキスト置換（circle パターン）
- GAS: `V3TR_writeToApplication_` 内でテキスト置換 / Python: `put_era_circle(ws, "CT8", 1)`

**U5: 本家区分** — ✅ 実装済み（2026-03-20）★★☆（★暫定運用★）
- 判定ロジック: 保険種別→続柄→生年月日（対象月末日時点年齢）→一部負担金割合
- GAS: `V3TR_calcAgeAtEndOfMonth_()` + `V3TR_deriveHonkeku_()` ヘルパー追加
- Python: `calc_age_at_end_of_month()` + `derive_honkeku_cell()` ヘルパー追加
- 書込: テンプレート内先頭数字を丸数字に置換（例: "2.本人"→"②.本人"）
- 使用列: `保険種別` / `続柄` / `患者生年月日` / `一部負担金割合` / `対象月`
- **★後期高齢者（保険種別=6 or 年齢75歳以上）は空欄（保留: 制度上の記載方式未確認）**
- "0.高7" の "0" は Unicode U+24EA "⓪" で置換（暫定: 帳票表示確認必要）

**U6: 給付割合** — ✅ 修正済み（2026-03-20）★★☆（★暫定運用★）
- 片側丸付け方式（U5と同方式）: テンプレートの対象数字1文字のみ置換
- テンプレート実値: DP8='10・９' / DP11='８・７'（全角文字）
- 割合=1: DP8 '９'→'⑨'（結果: '10・⑨'）/ 割合=2: DP11 '８'→'⑧'（結果: '⑧・７'）/ 割合=3: DP11 '７'→'⑦'（結果: '８・⑦'）
- GAS: `KYUFU_CHAR_MAP` / Python: `KYUFU_CHAR_MAP` 定数で管理（旧 KYUFU_CELLS+KYUFU_CIRCLE_TEXT を置換）

**U7: 請求区分（新規・継続）** — ✅ 実装済み（2026-03-20）★★★
- `row["請求区分"]` 生成: GAS側 `V3TR_buildTransferRow_` 内で `cs.firstDate` の年月 vs `ym` で "新規"/"継続" を判定
- DH31 書込: `write_application.py` の `put(CELL_MAP["請求区分"], seikyu_kubun)` で実装
- 保留: 同月内治癒再発（case1継続 + case2同月初検 → 両方○）は将来対応
| D4 | 負傷の原因欄 | ✅ **実装済み（2026-03-20）** 3部位目60/100算定時（row2["部位1_計"]>0）のみ BR20 に出力。GAS: V3TR_writeToApplication_ / Python: write_application() | — | ~~中~~ **DONE** |
| D5 | 施術証明欄・委任欄の自動/手書き分離が未明文化 | 両欄ともに py 実装なし（全手書き前提で空出力） | `write_application.py` + 運用ドキュメント | **低** |

#### 各差分の詳細

**D1 — 施術終了年月日 ✅ クローズ（2026-03-19）**

#### 実装内容

- 一次fix: `aggDates.maxDate` フォールバック追加
- 二次fix: `p1Dates.maxDate` / `p2Dates.maxDate` で部位別最終施術日に対応（優先順位: endDate → p1/p2Dates.maxDate → aggDates.maxDate → 空）

#### 実ファイル確認結果（2026-03-19）

| ファイル | 確認内容 | 結果 |
|---|---|---|
| `申請書_touji_2026-02_214947.xlsx` | 右肩関節打撲: 施術終了年月日=令和8年2月25日 / 実日数=8 | ✅ OK |
| `申請書_touji_2026-02_214947.xlsx` | 右上腕下部挫傷: 施術終了年月日=令和8年2月16日 / 実日数=4 | ✅ OK |
| `申請書_hirayamaka_2026-02_214947.xlsx` | 腰部捻挫: 施術終了年月日=令和8年2月16日 / 実日数=5 | ✅ OK |
| `申請書_hirayamaka_2026-02_214947.xlsx` | 肩関節打撲: 施術終了年月日=令和8年2月16日 / 実日数=3 | ✅ OK |

**確認判定:**
- D1空欄解消: OK
- 部位別最終施術日（部位で終了日が分かれて出力）: OK
- 実日数: OK（施術日カレンダーと整合確認済み）

**残課題なし。D1はクローズ。D2は設計確定・M31出力停止済み（B案: 既定で書かない）。**

**D2 — 継続月数・頻回（✅ 設計確定 2026-03-20 — M31出力停止・内部値計算のみ保持）**

#### セル確認（2026-03-19）✅

| 確認項目 | 結果 |
|---|---|
| 行31 の構造 | E31:L31=「経過」ラベル / **M31:CY31=空のマージセル（補助表示・当面未使用）** |
| 「頻回」「継続月」テキストを持つセル | **テンプレート全体で0件** |

#### 設計確定内容（2026-03-20）

| 項目 | 確定内容 |
|---|---|
| 正式出力先 | 摘要欄（継続月数）＋長期欄（頻回→0.5 / 長期のみ→0.75）— **手動** |
| M31 | **当面空欄（出力停止中）**。空欄提出でも制度違反なし |
| A16:B20（患者画面） | **院内メモ。請求正本に使わない** |
| 内部値 | `rawContMonths`/`freqStarted` — `V3TR_calcD2Keizoku_()` が計算・保持 |
| 継続月数の定義 | 月10回以上の施術を行った連続月数（単純経過月数ではない）|
| 頻回の成立 | 月10回以上×5か月連続 → 翌月から0.5逓減 |
| 頻回開始後 | 月10回未満でも治癒・中止・転医まで0.5継続（解除不可）|

#### コード状態

| ファイル | 状態 |
|---|---|
| `Ver3_transferData.js` | `V3TR_calcD2Keizoku_()` 存在・動作。`row["経過"]` は常に `""` を設定（出力停止中）|
| `write_application.py` | `CELL_MAP["経過"]="M31"` 存在。`if keizoku:` ガードにより現状はスキップ（出力停止中）|

#### 反映・確認済み（2026-03-20）

| 作業 | 結果 |
|---|---|
| clasp push | ✅ 7ファイル Pushed（Ver3_transferData.js / Ver3_test.js 含む）|
| Cloud Run | ✅ revision `jrec-appgen-server-00004-kc9` — 100% トラフィック |
| D2 ロジックテスト | ✅ 全6ケース PASS（`runD2Suite()` で確認可能）|
| M31出力停止 | ✅ `row["経過"]=""` 設定済み。clasp push 要（次回 de 時に反映）|

**D3 — 負傷名の左右表記**

- `V3TR_buildInjuryLabel_(partAgg)` = `partAgg.bui + " " + partAgg.byomei`
- `partAgg.bui` は施術明細の「部位」列の値そのまま
- 現場入力が「右頸部」「左足関節」のように左右込みで入力されていれば問題なし
- 問題ケース: 「頸部」と入力し左右なしで記録されていると申請書の負傷名欄に左右が出ない
- **確認箇所**: 実シートの部位名入力フォーマット（左右を部位名に含めているか）

**D4 — 負傷の原因欄** — ✅ 実装済み（2026-03-20）

- 出力条件: 「3部位目を100分の60で算定することとなる場合」= `row2["部位1_計"] > 0` が true のとき
- 新しい transferCol 追加なし。既存の `負傷の状況` / `負傷の場所` / `負傷の日時` (transferCols登録済み) から派生
- GAS: `V3TR_writeToApplication_` に `V3TR_buildInjuryText_` + part3HasData 判定を追加
- Python: `write_application()` に `_build_injury_text()` + part3_has_data 判定を追加
- 出力形式: `{負傷の場所　負傷の状況　負傷の日時}` を全角スペース結合。複数ケースは " / " で結合
- ★ 後期高齢・2部位以下・3部位目実績なし → BR20 空欄（制度上正しい）
- ★ 残課題: multiCoef3 が 0.6 以外の設定の場合の判定精度 / 告示原文での制度確認

**D5 — 施術証明欄・委任欄**

- 施術証明欄（施術者氏名・施術所名・所在地）: 院側の固定情報 → 設定シートから自動入力可能
- 委任欄（患者の委任署名・日付・患者氏名記入）: 患者が手書きする必須欄 → 自動入力不可
- 現状は両欄とも空出力（py 実装なし）
- **明文化方針**: 施術証明欄は設定シートに院情報を登録して自動出力、委任欄は手書き前提として py は対象外とする

---

### 次タスク候補（優先順）

| 優先 | タスク | 分類 | 概要 |
|---|---|---|---|
| 1 | ~~runFixtureSuite() PASS確認~~ | ✅ **完了** | 57/57 PASS 確認済み（2026-03-19） |
| 2 | ~~transferData への新5列反映~~ | ✅ **実装済み（調査完了）** | transferCols に全5列記載済み・V3TR_buildRows_ でセット済み（2026-03-18）。write_application.py は5列を参照しない（申請書不要・監査列のため正しい）。schemaVersion "3.0" 継続で問題なし。コード変更不要。 |
| 3 | ~~B案メニュー実行確認~~ | ✅ **完了** | 疎通確認・メニュー実行・Drive出力まで一通り確認済み（2026-03-19）|
| **次** | **B案 出力内容確認** | 🔵 **次の作業** | 生成された申請書のレイアウト・金額・患者情報・部位負傷名・請求額の整合確認 |

**保留継続:**
- 運動後療料 月2回特例 → `docs/JREC-01_運動後療料_月2回特例メモ.md` 参照（根拠資料未確認のため）
- 既存データ一括再計算メニュー → 低優先度
- 保存先フォルダIDやURLを設定値・ログ・ドキュメントに明記 → B案出力内容確認フェーズで実施

### ✅ 温罨法初検日特例 実装完了（2026-03-17）

- **33/33 PASS 確認済み**（TC01〜TC17b + M01〜M05）
- TC17a（初検日特例・warm=0）/ TC17b（後療日通常算定・warm=75）すべてPASS
- `calcOnePartAmount_V3_`: kubun=初検 時に warm=0 固定（初検日特例）

### ✅ 金属副子等加算 Phase 2 実装済み（2026-03-17）— clasp push 後 40/40 PASS 確認待ち

- TC20a/b/c 実装済み（1回目・3回目・上限超）
- `buildMetalCountByCaseKey_V3_`: 施術明細から caseKey 単位の通算算定回数を集計（beforeDate 以前、visitKey 重複除去）
- `calcOnePartAmount_V3_`: `metalPriorCount` 引数追加 → 3回以上で 要確認「金属副子等加算 算定上限超（通算3回）」
- `calcCaseDetailAmount_V3_`: `detailValues`/`detailMap` 引数追加 → `buildMetalCountByCaseKey_V3_` を呼び出し
- `calcHeaderAmountsByVisitKey_V3_`: 施術明細シート読み込みを追加
- `recalcAmountsByVisitKey_V3_`: metalPriorCount を計算して渡す

### ✅ 金属副子等加算 Phase 1 実装完了（2026-03-17）— 37/37 PASS 確認済み

- TC19a/b 実装済み（骨折=算定可・捻挫=要確認）
- `AM_SET_KEYS.metalAddon` / `loadSettings_V3_` に `金属副子等加算` = 1,000 追加
- `AM_DETAIL_COLS` に `metalChk / metalOut` 追加（施術明細列）
- `CASE_COLS` に `metal1 / metal2` 追加（来院ケース列）
- `calcOnePartAmount_V3_`: `metalChk` 引数追加 → 骨折/不全骨折/脱臼→1,000円, C群→0+要確認
- `metalOut` は逓減（coef・ltCoef）対象外 → `total += metalOut`（乗算なし）

### ✅ 長期継続理由書アラート 実装完了（2026-03-17）— 35/35 PASS 確認済み

- TC18a/b PASS 確認済み。TC14a/b・TC16a/b/c expected 更新済み
- `calcMonthsElapsed_V3_`: 受傷日から来院日までの月数を計算（共通ヘルパー）
- `calcOnePartAmount_V3_`: monthsElapsed ≥ 3 → `"長期施術3か月超（継続理由書確認）"` を needCheck reason に追加
- 長期減額 reason（あれば）が先、継続理由書 reason が後（セミコロン区切り）

### ✅ 長期50%逓減 実装完了（2026-03-17）

- **31/31 PASS 確認済み**（TC01〜TC16c + M01〜M05）
- TC16a（50%適用）/ TC16b（75%維持・頻回未達）/ TC16c（4か月目・条件未達）すべてPASS
- `buildMonthlyVisitCounts_V3_`: 来院ヘッダから caseKey 単位の月別来院数を集計
- `calcLongTermCoef_V3_`: 4引数化。monthlyVisitCounts 全月≥10 → 0.50、そうでなければ 0.75
- 起算月ルール: 初検日<16日→当月起算、≥16日→翌月起算（ユーザー確認済み 2026-03-17）
- 確認済み単価: koryoDakkyu=720 / seifukuDakkyu=5200 / warm=75 / electro=33 / taiki=5 / cold=85
- `runFixtureSuite()` で一括実行可能（31 件→35 件）

### 未実装制度論点（優先順）

| 優先 | 項目 | 状況 |
|---|---|---|
| 高 | 温罨法 初検日特例 | ✅ 実装済み（TC17a/b PASS）|
| 中 | 長期継続理由書アラート | ✅ 実装済み（TC18a/b PASS 確認済み）|
| 中 | 金属副子等加算 Phase 1 | ✅ 実装完了（TC19a/b PASS 確認済み）|
| 低 | 金属副子等加算 Phase 2（回数制限） | ✅ 実装完了（TC20a/b/c PASS 確認済み）|
| 中 | 特殊骨折制限（3部位目以降の制限等） | 未調査。骨折+多部位の制限条件があれば fixture で境界確認が必要 |
| 中 | transferData への新5列反映 | 申請書データへの反映可否を検討 |
| 低 | 既存データ一括再計算メニュー | 過去来院ヘッダへの新5列遡及反映 |

### ✅ B案メニュー実行・Drive出力確認完了（2026-03-19）

#### 実施内容

| 手順 | 結果 |
|---|---|
| 新PCで `.clasp.json` 復旧（Script ID から `clasp clone`） | ✅ 完了 |
| `jyu-gas-ver3.1` フォルダに `.clasp.json` コピー | ✅ 完了 |
| `clasp push` 実施 | ✅ 完了 |
| `Ver3_core.js:228` メニュー登録確認 | ✅ 確認済み |
| `Ver3_transferData.js:1984` `V3TR_menuGenerateApplication_B()` 実装確認 | ✅ 確認済み |

#### 疎通確認結果

| テスト | エンドポイント | 結果 | レスポンス |
|---|---|---|---|
| V3TR_smokeHealth | `https://jrec-appgen-server-j6vlxdvqaa-an.a.run.app/health` | HTTP 200 | `{"status":"ok"}` |
| V3TR_smokeGenerate | `/generate` | HTTP 200 | `{"status":"ok","patients":[],"month":"2026-03","generatedAt":"..."}` |

#### B案メニュー実行結果

- **メニュー:** 柔整ツール → 「【B案】申請書を生成して Drive に保存」
- **実行結果:** OK
- **Drive出力:** OK
- **対象患者数:** 1件
- **エラー:** なし
- **出力先フォルダ:** 確認済み

#### 重要判断（記録）

- B案は「Cloud Run 疎通確認 → GAS連携 → メニュー実行 → 実ファイル出力」まで通過済み
- 新PCでも Apps Script / clasp 復旧手順が確認できた（`SETUP.md` §8章に手順追記）
- この時点で **B案はスモークテスト段階を通過**。次は出力内容確認フェーズ

#### 次フェーズ（出力内容確認）

| 確認項目 | 内容 |
|---|---|
| レイアウト崩れ | 帳票の枠・位置ずれがないか |
| 金額整合 | 当月合計・窓口負担額・請求金額が正しいか |
| 患者情報 | 氏名・生年月日・保険者番号・住所 |
| 対象月 | ヘッダに正しい月が入っているか |
| 部位・負傷名 | 記載内容が転記データと一致しているか |
| 請求額 | write_application.py の A案出力と比較確認 |

---

### ✅ Cloud Run デプロイ完了（2026-03-19）

| 項目 | 状態 |
|---|---|
| Secret Manager `JREC_APPGEN_SECRET_KEY` 登録 | ✅ 完了 |
| Cloud Run SA に Secret Accessor 権限付与 | ✅ 完了 |
| Docker build / tag / push | ✅ 完了 |
| Cloud Run `jrec-appgen-server` デプロイ | ✅ 完了 |
| `/health` エンドポイント 200 OK 確認 | ✅ 完了（`{"status":"ok"}`）|
| GAS Script Properties `APPGEN_ENDPOINT` / `APPGEN_SECRET` 設定 | ✅ 完了 |

**次アクション:**

スモークテスト関数を `Ver3_smokeTest.js` に追加済み（2026-03-19）。以下の手順で実行する。

### STEP 1: clasp push

```bash
cd gas-projects/jyu-gas-ver3.1
clasp push
```

### STEP 2: /health 疎通確認

1. Apps Script エディタを開く（スプレッドシート > 拡張機能 > Apps Script）
2. 関数プルダウンで **`V3TR_smokeHealth`** を選択して「実行」
3. 期待: アラートに `✅ /health OK / HTTP: 200 / Body: {"status":"ok"}`

### STEP 3: /generate 疎通確認（患者0件の最小 NDJSON）

1. 同エディタで **`V3TR_smokeGenerate`** を選択して「実行」
2. 送信内容: 患者データなし・meta行のみ（実来院データ不要）
3. 期待: アラートに `✅ /generate OK / HTTP: 200 / Body: {"status":"ok","patients":[],...}`

### STEP 4: 本番メニューで実データ送信

上記2ステップ成功後:
1. スプレッドシートを開いてメニュー「柔整ツール」>「**【B案】申請書を生成して Drive に保存**」
2. 月を確認して OK
3. 完了アラートで「エラー: 0 件」を確認
4. Drive フォルダに xlsx が保存されているか確認
5. `_申請書生成ログ` シートに `OK` 行が追記されているか確認

### 失敗時の確認点

| 症状 | 確認先 |
|---|---|
| `APPGEN_ENDPOINT が未設定` | Script Properties の値を再確認 |
| HTTP 401 | `APPGEN_SECRET` の値と Cloud Run の `JREC_APPGEN_SECRET_KEY` が一致しているか |
| HTTP 400 | NDJSON フォーマット / schemaVersion 確認 |
| HTTP 500 | GCP Console > Cloud Logging でスタックトレース確認 |
| 接続失敗 | `APPGEN_ENDPOINT` の URL が正しいか（末尾スラッシュなし）|

### 次フェーズ候補

1. **申請書生成フロー B案** — ✅ Cloud Run デプロイ完了・/health 確認済み。次: GAS → Cloud Run 疎通確認 → 本処理エンドポイント確認
2. **特殊骨折制限** — 骨折+多部位の制限条件調査と fixture 追加
3. ~~transferData への新5列反映~~ — ✅ 実装済み確認済み（2026-03-19）

### 中長期

- 申請書生成フローの実運用確認
- 現場運用で `会計区分` と `区分` の混同が起きないかを入力確認
- 次段階で `保険新規 / 自費直新規` の実入力運用を設計

---

## 保留事項

- 実スプレッドシート上での最終確認状況は人手確認が必要
- 単価や算定条件の制度変更時は `SPEC.md` と設定シートの両方を見直す
- `保険新規 / 自費直新規 / 再来` の分離運用は次段階で必ず着手する
- 現在のローカル設定では container-bound GAS の script ID が取れておらず、`clasp run` / Execution API による live 関数実行確認は未完了
- bound GAS の script ID / `.clasp.json` / `executionApi.access=MYSELF` / API executable deployment までは確認済み。2026-03-15 時点の残課題は `scripts.run` 実行権限で、`clasp run ensureSettingsRows_V3` は devMode で permission エラー、`--nondev` では API executable 未解決エラーになる
- Apps Script Execution API の 403 条件として「呼び出し側 OAuth client とスクリプト側が同じ Google Cloud project を共有していること」が公式要件。現状はここが最後の有力候補で、最短ルートは Apps Script エディタから `ensureSettingsRows_V3` を手動実行して live 反映確認しつつ、必要なら標準 GCP プロジェクト側の紐付けを確認すること

---

## 直近の重要判断

- 来院ヘッダの追加位置は `caseIndex` 右側の末尾追加を第一案とする
- 追加する正式列名は `会計区分 / 自費メニュー区分 / 自費売上額 / 慢性候補フラグ / 次回予約あり / 新規区分`
- 選択肢マスタは `設定` シート右側の `E:I` を第一案とし、既存の `A:D` 用途を崩さない
- 既存コードは見出し名ベース参照のため、末尾列追加なら既存処理影響は限定的と判断
- `新規区分` は今回は受け皿だけ用意し、`保険新規 / 自費直新規` の必須運用は次段階で行う
- save/export 経路で来院ヘッダ不足列を自動補完し、設定シート側では選択肢マスタと入力候補を一括で整える
- live 実行の切り分けでは、`ensureSettingsRows_V3` 自体はトップレベル関数として存在し、API executable deployment も作成済みのため、実装本体より execution 条件側を優先確認する

---

## テスト状況

- テストケース文書: `TESTCASES.md` あり
- fixture テスト基盤: `Ver3_test.js` + `tests/jrec01/fixtures/` + `tests/jrec01/expected/` 整備済み
- fixture 件数: 57件（TC01〜TC25b + TC09b + M01〜M05 + M06b）
- **✅ 57/57 PASS 確認済み（2026-03-19）** TC01〜TC25b 全件 runFixtureSuite() で通過確認済み
- 実シート確認済み: M01 / M02 / M03 / M04 / M05 / TC09b
- Apps Script メニューから `runFixtureSuite()` で一括実行可能
- 確認済み単価: koryoDakkyu=720 / seifukuDakkyu=5200 / warm=75 / electro=33 / taiki=5 / cold=85

---

## 重要ファイル

- `README.md`
- `SPEC.md`
- `PLAN.md`
- `TESTCASES.md`
- `Ver3_core.js`
- `Ver3_amounts.js`
- `Ver3_transferData.js`
- `write_application.py`

---

## コード正本と同期ルール（2026-03-16 確定）

### 正本の定義

| 対象 | 正本 | 参照元 |
|---|---|---|
| GAS コード（.js）| GitHub `feature/auto-dev-phase3-loop` | Claude Code / ChatGPT はここを読む |
| 申請書スクリプト（.py）| GitHub 同上 | 同上 |
| 療養費算定ルール | `SPEC.md` / `JREC-01_制度SPEC_v0.9.md` | GitHub |
| 実運用データ | Google スプレッドシート | Apps Script で書き込み |

**Apps Script エディタは編集場所ではなく実行場所**。コードの変更は必ず GitHub 経由で行い、その後 `clasp push` で Apps Script に反映する。

### GAS 修正後の必須手順

```
1. ローカルでコードを編集
2. git add / commit / push → GitHub に反映
3. clasp push → Apps Script エディタに反映
```

```bash
# 手順3のコマンド（jyu-gas-ver3.1 ディレクトリで実行）
cd gas-projects/jyu-gas-ver3.1
clasp push
```

### やってはいけないこと

- Apps Script エディタで直接コードを編集する（GitHub と乖離する）
- `clasp pull` でローカルを上書きする（GitHub の変更が失われる）
- clasp push せずに GitHub だけ更新したまま放置する

### 最終 clasp push 状況

| ファイル | 最終 GitHub commit | Apps Script 反映 |
|---|---|---|
| Ver3_amounts.js | `209ceb9`（2026-03-18）| ✅ clasp push 済み |
| Ver3_core.js | `7dd0790`（2026-03-17）| ✅ clasp push 済み |
| Ver3_test.js | `209ceb9`（2026-03-18）| ✅ clasp push 済み |
| Ver3_transferData.js | 2026-03-20（U7請求区分実装）| ✅ clasp push 済み（2026-03-20）|
| write_application.py | 2026-03-20（U7請求区分 put()追加）| N/A（ローカルのみ）|
| Ver3_patientPicker.js | 変更なし | 問題なし |
| SPEC.md | `22447fd`（2026-03-17）| N/A（ローカル文書のみ）|

### clasp status について

`clasp status` はファイルの追跡状況のみ表示し、Apps Script との内容差分は表示しない。
内容差分の確認には `clasp pull`（ローカル上書き）が必要だが、GitHub 正本運用下では原則使わない。

---

## 再開メモ

作業再開時は、まず `README.md`、`SPEC.md`、`TESTCASES.md` を確認し、次に対象ロジックの実装ファイルを読む。
制度変更や単価変更に関わる作業では、コードより前に仕様との整合を確認する。
JBIZ-04 には日次入力を持たせず、このブックを現場入力の正本として使う前提を崩さない。
**コード修正後は必ず `clasp push` まで行うこと（上記「コード正本と同期ルール」参照）。**

---

## 2026-03-15 完了整理

- 実装完了: 来院ヘッダ6列追加と `設定!E:I` 候補マスタ反映の最小実装まで完了
- live 確認完了: Apps Script エディタから `ensureSettingsRows_V3` を手動実行し、`設定!E:I` と来院ヘッダ6列の反映、既存列・既存データ非破壊を確認
- 保留: `clasp run` / Execution API 調査は別タスク。現時点ではコードではなく実行条件側の課題の可能性が高い

---

## 2026-03-17 再検料月内上限ロジック修正 + amounts.js 治癒後初検抑制解除

### 修正概要

| 対象ファイル | 対象関数 | 変更内容 |
|---|---|---|
| Ver3_transferData.js | `V3TR_countKubunInCases_` | `reCount` を `Math.min(rawReCount, validInitCount)` に変更（cebeffe）|
| Ver3_transferData.js | `V3TR_countKubunInCases_` | `initCount` を `Math.min(rawInitCount, validInitCount)` に変更（本 commit）|
| Ver3_amounts.js | `getMonthlyBilledStatus_` | 治癒後別負傷 [B] 判定を追加（opt_caseSh / opt_caseMap / opt_treatDate）|
| Ver3_amounts.js | ─ | `isCaseEndedBefore_` ヘルパー追加 |

### 判定ロジック（全層整合済み）

```
V3TR_countKubunInCases_（transferData）:
  validInitCount:
    [A] 施術継続中 Mixed: 先行ケース終了日なし or >= 後続初検日 → 1
    [B] 治癒後別負傷:     先行ケース終了日 < 後続初検日（厳密）   → 2
  initCount = Math.min(rawInitCount, validInitCount)
  reCount   = Math.min(rawReCount,   validInitCount)

getMonthlyBilledStatus_（amounts.js）:
  initFee > 0 の行を発見した場合:
    → isCaseEndedBefore_ で、そのケースが現在の treatDate より前に終了しているか確認
    → 終了していれば suppressInitBilled=true → initBilled=false を維持（治癒後 [B]）
    → 終了していなければ initBilled=true（施術継続中 [A]）

isCaseEndedBefore_（amounts.js）:
  caseKey の全行を走査し、施術終了日_部位1/2 の最遅値を取得
  最遅終了日 < treatDate → true（治癒済み）/ それ以外 → false
```

### エッジケース明文化済み

| ケース | 扱い |
|---|---|
| `endDate == later.initDate`（同日） | [A] 保守扱い（`<` 厳密）|
| `endDate` 空欄（Date でない） | [A] 保守扱い（施術継続中とみなす）|
| `caseKey` 列なし（headMap に未存在） | `ckVals=null` → `suppressInitBilled=false` → 従来動作 |
| `caseNo` 列なし | 全行 caseNo=1 扱い → `initCases.length<=1` → `validInitCount=min(rawInitCount,1)` |

### 到達点

| 項目 | 状態 |
|---|---|
| transferData 再検料集計（reCount） | ✅ [A]=1 / [B]=2 |
| transferData 初検料集計（initCount） | ✅ [A]=1 / [B]=2 |
| amounts.js 初検抑制（getMonthlyBilledStatus_）| ✅ 治癒後別負傷 [B] で suppressInitBilled |
| isCaseEndedBefore_ ヘルパー | ✅ 追加済み |
| M06a（施術継続中）既存 M01〜M05 | ✅ 変化なし（validInitCount=1 → 旧挙動と等価）|
| M06b fixture / 実シート確認 | ⚠️ 未実施（fixture 追加・실시후 확인が必要）|

### M06b 全層整合の確認結果（コード分析）

```
[B] 治癒後別負傷 シナリオ（例: case1 終了 2/10、case2 初検 2/15）

amounts.js（per-visit 算定）:
  case1 の初検（2/1）: initBilled=false → initFee=1550 ✅ billed
  case2 の初検（2/15）:
    getMonthlyBilledStatus_ → case1 caseKey の endDate=2/10 < treatDate=2/15 → suppressInitBilled=true
    → initBilled=false → initFee=1550 ✅ billed（抑制されない）
  来院ヘッダ initFee 合計 = 3100

transferData 月次集計:
  rawInitCount=2, validInitCount=2 → initCount=2 → initFee = 1550×2 = 3100 ✅
  rawReCount=2,   validInitCount=2 → reCount=2   → reFee  = 410×2  = 820  ✅

全層整合: ✅ amounts.js ↔ transferData で initFee / reFee が一致
```

> **ステータス: 実装受理 / 運用完了は未了（2026-03-17 確認）**
> M06b は amounts.js（per-visit）と transferData（月次集計）の両層が修正されたことで、
> 「治癒後別負傷の初検料・再検料を各エピソードで独立算定する」という制度要件を充足している。
>
> **運用完了条件（残タスク）:**
> 1. ~~実シートで M06b パターン入力 → initFee=3100 / reFee=820 を確認~~ ✅ NDJSON・申請書生成で確認済み（2026-03-17）
> 2. Dashboard 反映: `de -ProjectId JREC-01` ✅ 本セッションで実施
> 3. M06b fixture 追加（TESTCASES.md 追記）⚠️ 未実施
> 4. caseKey 欠落フォールバック時のログ化（任意）⚠️ 未実施

## 2026-03-17 M06b 実シート確認（write_application.py バッチ実行）

### 確認条件

| 項目 | 内容 |
|---|---|
| 実行コマンド | `python write_application.py --batch` |
| NDJSON | transfer_batch_2026-03.ndjson（再生成） |
| 実行環境 | .venv（Pillow 不足で一度失敗 → pip install Pillow 後に成功）|
| 出力ファイル | output\2026-03\申請書_hirayamaka_2026-03.xlsx |
| セル書込数 | 86 |
| 検証 | 全件パス ✅ |

### hirayamaka M06b データ確認

| 項目 | 値 | 確認 |
|---|---|---|
| case1 caseKey | hirayamaka_2026-03-02_C1 | — |
| case1 施術終了年月日 | 2026-03-09 | 治癒 |
| case2 caseKey | hirayamaka_2026-03-16_C2 | — |
| case2 初検日 | 2026-03-16 | 治癒後の新規別負傷 |
| isPostRecovery 判定 | 2026-03-09 < 2026-03-16 → true | ✅ [B] 治癒後別負傷 |
| 初検料_月額 | 3,100 | ✅ 期待値通り（1550×2） |
| 再検料_月額 | 820 | ✅ 期待値通り（410×2） |
| 当月合計 | 6,936 | — |
| 窓口負担額 | 2,080 | — |
| 請求金額 | 4,856 | — |

### 確認余地（事実として記録、未解決）

| 項目 | 内容 |
|---|---|
| case要約表示 | case1要約="case1:再検" / case2要約="case2:再検" — 両ケースとも再検表示。M06b では case2 に初検（3/16）があるが case2要約が "再検" を示す。表示仕様として問題ないか確認余地あり（billing 正確性に影響なし）|

### Pillow 依存追加（再発防止）

- .venv に Pillow 未インストール状態で実行 → `ModuleNotFoundError: No module named 'PIL'`
- `pip install Pillow` 後に再実行し成功
- `requirements.txt` を新規作成し openpyxl / Pillow を明記（本コミット）

---

## 2026-03-17 請求前チェックリスト実施結果（2026-03 2件）

### 実施条件

| 項目 | 内容 |
|---|---|
| 転記データ再生成日時 | 2026-03-17T16:57:58+09:00（post-fix: 施療料 caseTotal 算入済み） |
| 対象月 | 2026-03 |
| 患者件数 | 2件（hirayamaka / touji） |
| SHEETS.ui | `"患者画面"` ✅（commit 7dd0790 で確認） |

### 金額確認（post-fix 値）

| 患者 | 当月合計 | 窓口負担額 | 請求金額 | pre-fix 当月合計 | 差分 |
|---|---|---|---|---|---|
| hirayamaka | 5,481 | 1,640 | 3,841 | 3,961 | +1,520 ✅（施療料 760×2 case） |
| touji | 4,363 | 1,310 | 3,053 | 2,843 | +1,520 ✅（施療料 760×2 case） |

### チェックリスト結果

| チェック項目 | hirayamaka | touji |
|---|---|---|
| 初検取得モード = caseKey | ✅ | ✅ |
| 当月合計 / 窓口負担額 / 請求金額 計算整合 | ✅ | ✅ |
| 保険者番号 | 1280015 ✅ | 32280414 ✅ |
| 患者氏名 | 平山克士 ✅ | 田路吾子 ✅ |
| 患者生年月日 | 1973-10-10 ✅ | 1969-05-23 ✅ |
| 住所 | 兵庫県朝来市立野 169-1 ✅ | **⚠️ 空欄（要入力）** |
| 負傷名1 | 頸部 捻挫 ✅ | 頸部 捻挫 ✅ |
| 転帰 | 空欄（治療継続中なら可）| 空欄（治療継続中なら可）|
| Mixed 区分 | Mixed ✅ | Mixed ✅ |
| case1要約 / case2要約 | 後療 / 再検 ✅ | 再検 / 初検 ✅ |

### 請求確定できる項目

- 施療料欠落修正（commit 09129b7）反映済み ✅
- 当月合計・窓口負担額・請求金額の計算整合 ✅
- 初検取得モード caseKey ✅
- effectiveKubun → kubun 修正（commit 4f6419d）反映済み ✅

### 請求確定前に人間が確認する項目

| 項目 | 内容 |
|---|---|
| ⚠️ touji 住所 | 申請書の住所欄が空欄。患者画面で入力してから再生成すること |
| ⚠️ 転帰 | 両患者とも空欄。治療継続中なら空欄可。終了の場合は記入要 |

### 保留論点（制度確認待ち・今回変更なし）

**再検料 Mixed 2エピソード算定キャップ → 2026-03-17 一部解消**

- commit `cebeffe` で `Math.min(reCount, 1)` を `Math.min(reCount, validInitCount)` に修正済み
- hirayamaka / touji 両患者とも validInitCount=1 のため今回の請求には影響なし

---

## 2026-03-16 帳票番号飛び修正 完了

### 対象

- `write_application.py`

### 問題

- case2 のみ実データがある場合（例: touji）、以下の飛び番が発生していた
  - 施療料: `(1)` @ AC35 の次が `(3)` @ BG35 になる（`(2)` が抜ける）
  - 部位明細: ラベルが `⑴` の次が `⑶` になり、書き込み行も 行38 → 行40 と飛ぶ

### 原因

- `build_injury_rows` は L385 で後フィルタ（名称が空の行を除去）し詰めて書き込んでいた
- `build_shoryo_array` と `build_part_detail_array` はソース配列のインデックスをそのまま使っていたため、空スロットが挟まるとインデックスが飛んだ
  - `build_shoryo_array`: ゼロ値エントリを `continue` でスキップするが、`SHORYO_CELLS[i]["no"]` は元のインデックス `i` を参照
  - `build_part_detail_array`: `has_data=False` をスキップするが、`labels[i]` と `PART_ROWS[i]` は元のインデックス `i` を参照

### 対応（commit: 93b228e）

- **Fix-S**: `build_shoryo_array` の返り値を書き込み前にリスト内包でフィルタし、非ゼロ値だけに詰めてから `enumerate` → `SHORYO_CELLS[i]` で連番書き込み
- **Fix-P**: `build_part_detail_array` の書き込みループに `display_idx` を導入。`has_data=True` のときだけ `display_idx` を進め、`PART_ROWS[display_idx]` と `labels[display_idx]` で連続行・連番を保証

### 結果（実機確認済み）

| 確認項目 | 修正前 | 修正後 |
|---|---|---|
| touji 施療料 | (1) @ AC35 / **(3)** @ BG35 | (1) @ AC35 / **(2) @ AR35** |
| touji 部位ラベル | ⑴ @ 行38 / **⑶ @ 行40** | ⑴ @ 行38 / **⑵ @ 行39** |
| hirayamaka（case2=null） | 変化なし | 変化なし（影響なし） |

- Permission denied エラーが1回発生したが、原因は出力 xlsx ファイルのロック（Excel で開いたまま実行）。コード側の問題ではなく成功判定。

### 参考 commit

- `93b228e` — fix(JREC-01): 施療料・部位明細の番号付けを詰め連番に修正 (Fix-S / Fix-P)

---

## 2026-03-16 mixed case 表示改善 完了

### 対象

- `Ver3_amounts.js`（calcHeaderAmountsByVisitKey_V3_ に新5列生成ロジック追加）
- `Ver3_core.js`（HEADER_COLS / appendHeaderRow_V3_ に5列配線追加）
- `docs/JREC-01_mixed_case_display_memo.md`（設計判断メモ追加）

### 実装内容

来院ヘッダに以下5列を追加し、mixed case の説明性を強化した。

| 列名 | 内容 |
|---|---|
| 算定区分 | 実際に課金した区分（初検/再検/後療/算定なし） |
| Mixed区分 | 複数ケース同日かどうか（Mixed/通常） |
| case1要約 | case1 の区分を短縮表示 |
| case2要約 | case2 の区分と抑制状況を短縮表示 |
| 課金理由要約 | なぜその算定区分になったかを短文で説明 |

### 実シート確認結果

| パターン | 確認結果 |
|---|---|
| M01（case1=再検 / case2=初検抑制）| ✅ OK |
| M03（case1=後療 / case2=初検抑制）| ✅ OK |
| M05（case1=後療 / case2=再検）| ✅ OK（e931fe5 で課金理由要約バグ修正後） |

### バグ修正（e931fe5）

- 原因: case1=後療 / case2=再検 の mixed で `initSuppressed=false` のため M01 条件を通過できず `else → "算定なし"` に落ちていた
- 修正: `!hasBillableInitial && reFee>0 && isMixed && !initSuppressed` 分岐を追加し `"再検ありのため再検採用"` を返すようにした

### 実シート確認状況

| テストケース | 確認結果 |
|---|---|
| M01（case1=再検 / case2=初検抑制） | ✅ OK |
| M02（case1=再検 / case2=初検抑制なし） | ✅ OK（2026-03-17 fixture PASS確認） |
| M03（case1=後療 / case2=初検抑制） | ✅ OK |
| M04（case1=初検 / case2=初検） | ✅ OK |
| M05（case1=後療 / case2=再検） | ✅ OK（e931fe5 修正後） |

### 未対応範囲（次スコープ）

- `exportHeaderFromCases_V3` への新5列配線
- `transferData` への新5列反映（月次転記への影響検討）
- 既存データの一括再計算メニュー
- `区分` → `表示区分` へのリネーム（将来候補）

### 参考 commit

- `ff7d0ab` — docs(JREC-01): mixed case 表示改善メモ追加
- `5077920` — feat(JREC-01): 来院ヘッダ新5列実装（算定区分/Mixed区分/case要約）
- `e931fe5` — fix(JREC-01): chargeReason に「後療+再検 mixed」分岐を追加
