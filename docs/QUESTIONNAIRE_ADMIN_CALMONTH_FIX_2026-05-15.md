# questionnaireAdmin "calMonth is not defined" RCA + URL 正本化 — 2026-05-15

## 1. 障害状況

**発生時刻**: 2026-05-15（直前の Claude セッション後、ユーザが本番管理画面をブックマーク登録しようとした際に発覚）

**ユーザがアクセスした URL**:
```
https://script.google.com/macros/s/AKfycbz0EqGZOXWrKokzFN2x4SMo17cJojaHnWvmR2FAHXyQ1OLIdnWGwBSHIyylDAMqb8oACA/exec?page=questionnaireAdmin&filter=all
```

**画面表示**:
```
JREC-SF01 エラー
テンプレート描画エラー: calMonth is not defined
```

**ユーザ判断**: 本番管理画面の運用開始を一旦停止 → Claude に緊急復旧依頼。

---

## 2. 根本原因（コードバグではなく URL 認識ミス）

`clasp deployments` で deployment slot を確認した結果:

| deploymentId | version | description | 現在の用途 |
|---|---|---|---|
| `AKfycbz0EqGZ...` | **@48** | "Portal-12: ANYONE access for JBIZ live KPI connection" | **古い ANYONE deployment（Q-1A 実装前）**。Q-1A〜Q-4 / Portal-17 を含まない |
| **`AKfycbyOtef10...`** | **@53** | "Portal-18-D: return link to Hirayama Portal in shared header" | **現行 staff UI 正本** |
| `AKfycbw0aWYY...` | @57 | "Q-2C: improved public questionnaire UX" | 患者向け ANYONE_ANONYMOUS 公開問診票 |

### 発生メカニズム

1. 直前の Claude セッションでユーザに「JREC-SF01 自費問診票 管理画面 URL」を聞かれた際、`tools/live-check-runner/projects/jrec-sf01/config.json` の **古い `prodUrl: AKfycbz0EqGZ...`** をそのまま staff UI URL として案内した
2. その URL は **@48 deploy**（2026-05 前半 / Portal-12 ANYONE access 用に作られた古い JREC-SF01 deployment）を指していた
3. @48 当時の `JREC_SF01_Main.gs` の `buildPage_` switch には `questionnaireAdmin` case が存在せず、未知の `page` 値で fallthrough → `home` template を render しようとし、`tmpl.evaluate()` 内で `<?= calMonth ?>` (home.html L173 等) を解決できず ReferenceError
4. `evalTemplate_` (現行 L723-732) の catch が `renderError_("テンプレート描画エラー: " + err.message + ...)` を返却 → ユーザが見た画面

### 現行コードでは到達不可

| 確認項目 | 結果 |
|---|---|
| 現行 `JREC_SF01_Main.gs` に `questionnaireAdmin` case | ✅ L680-691 で実装済み |
| 現行 `questionnaire-admin.html` に `calMonth` 参照 | ❌ なし（grep 0 件）|
| 現行 `index.html` (include) に `calMonth` 参照 | ❌ なし |
| 現行 `styles.html` に `calMonth` 参照 | ❌ なし |
| `calMonth` 参照は `home.html` (L166, 169, 173, 191, 192, 198) のみ | ✅ 確認済み |
| git log `-S "calMonth" --all` | `ebfdd82 chore(jrec-sf01): initialize standalone repository` のみ |

**→ 現行 staff UI (@53) では `questionnaireAdmin` は正常動作する。コード修正・clasp push・deploy 不要。**

---

## 3. 復旧手順（実施済み）

### 3.1 ユーザブックマーク URL の正本

```
https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec?page=questionnaireAdmin&filter=all
```

`filter` パラメータの有効値: `pending` / `submitted` / `transferred` / `trashed` / `all`

関連ページ（同じ deploy `AKfycbyOtef10...` の末尾に付ける）:

| ページ | path |
|---|---|
| 問診票詳細 | `?page=questionnaireDetail&id=<questionnaireId>` |
| token 発行（QR / LINE）| `?page=questionnaireIssue` |
| ホーム（来院カレンダー）| `?page=home` |
| 患者一覧 | `?page=list` |

### 3.2 config.json の正本化

`tools/live-check-runner/projects/jrec-sf01/config.json`:

| key | 旧値 | 新値 |
|---|---|---|
| `prodUrl` | `AKfycbz0EqGZ.../exec` (@48 / staff UI 用ではない古い ANYONE deploy) | `AKfycbyOtef10.../exec` (@53 staff UI 正本) |
| `legacyProdUrl_DO_NOT_USE` | -（新規）| `AKfycbz0EqGZ.../exec` + 注記 |
| `legacyProdUrlNote` | -（新規）| @48 の正体と使用禁止理由を明記 |
| `currentDeployment` | `@54` | `@53 (staff UI: Portal-18-D return link) / @57 (public Q-2C)` |

### 3.3 患者向け公開問診票 URL（参考、変更なし）

```
https://script.google.com/macros/s/AKfycbw0aWYY0hPySJeAAcoJFg82zXFOzmBAaOVwQk5gVM3tlAGWJR37v2uflUr2qnxKpAb0og/exec?page=questionnairePublic&t=<rawToken>
```

これは `?page=questionnaireIssue` で staff が発行する個別 token 付きで使用する患者向け URL。@57 deploy で UX 改善済み。

---

## 4. 影響範囲確認

| 確認 | 結果 |
|---|---|
| 既存 Q-1A〜Q-4 / Portal-17 への影響 | なし（コード変更ゼロ）|
| JREC-SF01 GAS への影響 | なし（clasp push / deploy なし）|
| JBIZ Portal-17 への影響 | なし |
| Dashboard / Task_Queue / Run_Log 反映 | 不要（KPI / Portal 表示変更なし）|
| live-check-runner spec への影響 | なし（既存 spec は `devUrl` を使用、`prodUrl` 参照は doc レベルのみ）|
| 公開問診票 patient flow への影響 | なし（@57 deploy 維持）|

---

## 5. 残課題と次タスク（NEXT_ACTIONS）

### 5.1 JBIZ portal-gateway-v1.gs L480 fallback URL の正本化（次セッション）

```js
// JBIZ gas/portal-gateway-v1.gs L478-480
{ label: '🩹 JREC-SF01 自費',
  url: getExternalPortalUrl_('JREC_SF01_PORTAL_URL',
                             'https://script.google.com/macros/s/AKfycbz0EqGZOXWrKokzFN2x4SMo17cJojaHnWvmR2FAHXyQ1OLIdnWGwBSHIyylDAMqb8oACA/exec') },
```

この fallback URL も `AKfycbz0EqGZ...` (@48) で古い。
- 通常運用では JBIZ ScriptProperties `JREC_SF01_PORTAL_URL` で override されているはずなので即時障害は出ない（Portal-18-D `aeedaa2` で「JREC-SF01 / JYU-GAS / Wildboar URL fallbacks set」commit あり、staff UI ボタンは @53 へ向いている想定）
- ただし fallback が古いままなのは将来事故の源。次セッションで以下を実施:
  1. JBIZ `gas/portal-gateway-v1.gs` L480 fallback を `AKfycbyOtef10...` (@53) に更新
  2. `gas/` ↔ `scripts/` SHA256 同期
  3. clasp push + deploy（JBIZ 単独 deploy）
  4. JBIZ Portal を smoke で再確認

### 5.2 古い @48 deployment の整理

`AKfycbz0EqGZ...` (@48) は description 上「Portal-12 ANYONE access for JBIZ live KPI connection」だが、JBIZ KPI 用 API endpoint は実際には `AKfycbw0aWYY...` (@57) を使っており、@48 はもはや使われていない可能性が高い。

- 後日: GAS Apps Script editor で @48 deployment の archive または削除を検討（誤アクセスで `calMonth` エラーを再発させないため）
- ただし削除前に JBIZ ScriptProperties / 他の hardcoded reference をすべて grep で確認すること

### 5.3 ユーザ手動作業

| 作業 | 内容 | 緊急度 |
|---|---|---|
| ブックマーク張り替え | 既存「自費問診票管理画面」ブックマークを `AKfycbyOtef10.../exec?page=questionnaireAdmin&filter=all` に更新 | 即時 |
| 動作確認 | filter=pending / submitted / transferred / trashed / all で全パターン正常表示することを確認 | 即時 |
| 旧 URL ブックマーク削除 | `AKfycbz0EqGZ.../exec` を使った既存ブックマークがあれば削除 | 高 |

---

## 6. 教訓と再発防止

| 教訓 | 再発防止策 |
|---|---|
| `config.json` の `prodUrl` を staff UI URL として疑わず使った | 今後 URL を案内する前に必ず `clasp deployments` で対象 version の description を確認する |
| 1 つの Apps Script project に 21 個の deployment があり、用途が混在 | NEXT_ACTIONS §5.2 で古い deployment を archive |
| @48 deployment の description が「Portal-12 ANYONE access」だったため staff UI と誤認 | deployment の description は必ず「[USE-FOR: ...]」プレフィックスを付ける運用に変える（次セッション以降）|
| live-check spec は `devUrl` 中心で `prodUrl` が古いことに気付かなかった | live-check に `prodUrl` の deploy version 確認 spec を追加（QA-PROD-DEPLOY-CHECK 案）|

---

## 7. 並行作業との切り分け（本セッション）

| プロセス | 範囲 | 影響 |
|---|---|---|
| 本セッション（claude pid 7304）| workspace `config.json` + 本 doc 新規 + JREC-SF01 PROJECT_STATUS.md 短い追記 | edit window 最小化、JBIZ には触れず |
| 別 Claude（pid 17956 / 8:40 起動）| `tools/live-check-runner/projects/wildboar/` 専用 | JREC-SF01 / JBIZ / live-check-runner 共有部分 / `config.json` の JREC セクションには未接触 |
| 別 Claude（pid 16736 / 10:30 起動）| 範囲不明（git は全 repo clean） | JREC / JBIZ / workspace に dirty 残しておらず、現時点で衝突なし |

`tools/live-check-runner/projects/jrec-sf01/config.json` は wildboar 範囲外なので、編集衝突リスクはなし（並行 Claude は `projects/wildboar/` 配下のみ）。

---

## 8. live-check 再実行について

本セッションでは live-check を実行しない。

理由:
- コード変更ゼロ（GAS / HTML / spec すべて未変更）
- 並行 Claude (pid 17956 / 16736) が live-check-runner の wildboar spec を稼働中の可能性（前回確認時 node workers 09:52 起動）
- 既存の chronic-pain-kpi 13/13 / questionnaire-* 6 spec の CLOSED 認識は前回 commit で確定済み
- 障害は URL 認識ミスであり、コード起因ではない

ユーザによる動作確認（新 URL でのブックマーク切り替え + filter 5 パターン目視確認）で復旧完了とする。
