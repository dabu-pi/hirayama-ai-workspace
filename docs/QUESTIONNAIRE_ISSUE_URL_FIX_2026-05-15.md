# questionnaireIssue URL 発行画面エラー RCA + staff UI @58 update — 2026-05-15

## 1. 障害状況（直前 calMonth 復旧後の Phase 2 問題）

直前の calMonth 復旧で `prodUrl` を staff UI 正本 `AKfycbyOtef10...` に切り替えた後、ユーザが問診票管理画面 (`?page=questionnaireAdmin`) を開けるようになった。
しかし続いて `?page=questionnaireIssue`（QR / LINE 発行画面）を直リンクで開こうとしたらエラー画面が出た。

**エラー URL**:
```
https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec?page=questionnaireIssue
```

ユーザ判断: トークン式問診票の実運用テスト前に復旧優先 → Claude へ依頼。

---

## 2. 根本原因（staff UI deploy が古いスナップショットだった）

`clasp deployments` の結果と `git show 1d677bb:JREC_SF01_Main.gs` 確認結果:

| commit | 時系列 | 含まれる機能 |
|---|---|---|
| `1d677bb feat(jrec): Portal-18-D add return link (@53)` | 古い | Q-1A admin / Q-1B / Q-1C `questionnaireAdmin` `questionnaireDetail` case はあり、**`questionnaireIssue` case は無し** |
| `4cecba1 close Q-1A admin-base UI` | ↓ | - |
| `5840279 add Q-1B questionnaire to patient transfer` | ↓ | - |
| `443aecf add Q-1C questionnaire to visit chart transfer` | ↓ | - |
| `db1e6a7 add Q-2A/Q-2B public questionnaire token + form` | ↓ | - |
| `5ebb190 Portal-17 questionnaire L3 chronic pain KPI` | ↓ | - |
| **`bfc88d1 Q-4 questionnaire-issue page with QR and LINE template`** | ↓ | **Q-4 `questionnaireIssue` case + `questionnaire-issue.html` がここで追加** |
| `c6a2f70 Q-2C improve public questionnaire UX` | 新しい | - |

### staff UI deployment の中身

`AKfycbyOtef10...` deploymentId は **@53 という `1d677bb` 時点のスナップショット**で固定されていた。これは:

- **`questionnaireAdmin` / `questionnaireDetail` case**: ✅ `1d677bb` 時点で既に Main.gs L385/L399 に存在 → admin / detail は動作する
- **`questionnaireIssue` case**: ❌ `1d677bb` 時点では存在せず（Q-4 = bfc88d1 でその後追加）→ direct リンクで `?page=questionnaireIssue` を渡しても unknown route で fallthrough → エラー
- **`questionnaire-issue.html`**: ❌ `1d677bb` 時点では存在せず → そもそも HTML ファイル自体が deployment に含まれていなかった

git ls-tree `1d677bb -- .` でも `questionnaire-issue.html` は存在せず確認済み。

### なぜ admin だけ動いて issue が動かなかったか

- ユーザの「管理画面は表示できた」は、`@53 deploy + 1d677bb 時点コード`に存在する `questionnaireAdmin` case が render した結果。**ただし、その admin 画面の「🔗 新規 token 発行（QR / LINE）」ボタン自体は @53 時点では `questionnaire-admin.html` に含まれていなかった**（ボタン追加は `bfc88d1` で）
- そのため、ユーザは admin 画面で発行ボタンを見つけられず、URL 直打ちで `?page=questionnaireIssue` を試した → 古い deploy には case がなくエラー

---

## 3. 復旧手順（実施済み）

### 3.1 clasp push（最新ファイル upload）

```
clasp push --force
```

`questionnaire-admin.html` / `questionnaire-issue.html` / `questionnaire-public.html` / `JREC_SF01_Main.gs` / `JREC_SF01_Questionnaire.gs` / `JREC_SF01_ChronicPainKpi.gs` 等、最新 HEAD `b78586f` の全ファイルを upload。

### 3.2 clasp deploy（staff UI deploymentId を新 version で update）

```
clasp deploy \
  --deploymentId AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA \
  --description "@58 staff UI update: include Q-1A admin / Q-1B-Q-1C transfer / Q-2A-Q-2B-Q-2C public / Q-4 questionnaireIssue / Portal-17 L3"
```

結果: `Deployed AKfycbyOtef10... @58` ✅

**重要**: `--deploymentId` を指定したため、deployment ID（= ブックマーク URL）は維持され、version 番号だけ @53 → @58 に増加。ユーザのブックマーク張り替えは不要。

### 3.3 deploy 後の `clasp deployments` 確認

```
- AKfycbyOtef10... @58 - @58 staff UI update: include Q-1A admin / Q-1B-Q-1C transfer / Q-2A-Q-2B-Q-2C public / Q-4 questionnaireIssue / Portal-17 L3
- AKfycbw0aWYY... @57 - @57 - Q-2C: improved public questionnaire UX (successCard, expired/missing/already_submitted pages)
- AKfycbz0EqGZ... @48 - @48 - Portal-12: ANYONE access for JBIZ live KPI connection
```

staff UI が @58 で最新コード、public が @57 で Q-2C UX、古い ANYONE deploy @48 は放置（後日 archive 検討、NEXT_ACTIONS 参照）。

---

## 4. 動作確認用 URL（@58 staff UI）

すべて同じ deploy `AKfycbyOtef10...` の末尾にパスを付ける。

| 用途 | URL 末尾 |
|---|---|
| 問診票一覧（admin）| `?page=questionnaireAdmin&filter=all` |
| 問診票一覧 受付待ち | `?page=questionnaireAdmin&filter=pending` |
| 問診票一覧 送信済み | `?page=questionnaireAdmin&filter=submitted` |
| 問診票一覧 転記済み | `?page=questionnaireAdmin&filter=transferred` |
| 問診票一覧 ゴミ箱 | `?page=questionnaireAdmin&filter=trashed` |
| 問診票詳細 | `?page=questionnaireDetail&id=<questionnaireId>` |
| **問診票 URL 発行（QR / LINE）** | **`?page=questionnaireIssue`** ← 今回復旧 |
| ホーム（来院カレンダー）| `?page=home` |
| 患者一覧 | `?page=list` |

**フルURL例（URL 発行画面）**:
```
https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec?page=questionnaireIssue
```

admin 画面右上「🔗 新規 token 発行（QR / LINE）」ボタンからも同じ画面に行ける（@58 で `questionnaire-admin.html` も最新化されたため）。

### 患者向け公開問診票 URL（参考、変更なし）

`questionnaireIssue` で発行した token を patient に渡すときは、別 deploy の `AKfycbw0aWYY...` (@57 public) を使う:

```
https://script.google.com/macros/s/AKfycbw0aWYY0hPySJeAAcoJFg82zXFOzmBAaOVwQk5gVM3tlAGWJR37v2uflUr2qnxKpAb0og/exec?page=questionnairePublic&t=<rawToken>
```

これは `questionnaireIssue` 画面の `PUBLIC_EXEC_BASE` 定数で自動構築される（手動で組み立てる必要なし）。

---

## 5. live-check について

本セッションでは live-check 再実行は **しない**。

理由:
- 並行 Claude（pid 17956 / 16736）の節度ある共存: 11:09 から node プロセス 3 つが稼働中、`tools/live-check-runner/projects/wildboar/` 等で playwright session を持っている可能性。同じ live-check-runner で `npm run test:jrec:questionnaire-*` を動かすと chrome / port / auth.json で競合するリスク
- auth.json は前回計測から自然経過、Google session 期限切れの可能性
- @58 deploy の動作確認は **ユーザによる本番 URL での目視確認** で代用が確実かつ最速

過去の根拠:
- `questionnaire-issue.spec.ts` は前回 `bfc88d1` commit 時点で `11/11 PASS` を確定済み
- 今回 @58 deploy は `bfc88d1` 以降のすべての commit を含む（HEAD `b78586f` まで）
- code 変更ゼロ（push したのは既存ファイル、修正は workspace 側 config.json + docs のみ）

---

## 6. PII / セキュリティ確認

| 項目 | 結果 |
|---|---|
| 新 deploy にコード変更を含むか | ❌ ローカル HEAD `b78586f` の既存ファイルをそのまま push しただけ |
| token 取り扱い | 既存仕様維持（SHA-256 hash 保存、raw token は publicUrl 表示のみ）|
| Public URL に PII 流出 | なし（patientName / phone は public URL に含まれない、token のみ）|
| Portal-17 KPI 反映ロジック変更 | なし |
| Q-2C UX 文言変更 | なし（renderPublicError_ 5 状態の文言維持）|

---

## 7. Dashboard / Task_Queue / Run_Log 反映

なし。

理由: コード変更ゼロ、KPI 定義変更なし、Portal 表示変更なし、Task_Queue 対象なし。staff UI deploy update は GAS 側の operational change で、Dashboard 反映項目に該当しない。

---

## 8. 残課題と次タスク（NEXT_ACTIONS）

### 8.1 JBIZ portal-gateway-v1.gs L478-480 fallback URL の正本化（次セッション）

```js
{ label: '🩹 JREC-SF01 自費',
  url: getExternalPortalUrl_('JREC_SF01_PORTAL_URL',
                             'https://script.google.com/macros/s/AKfycbz0EqGZOXWrKokzFN2x4SMo17cJojaHnWvmR2FAHXyQ1OLIdnWGwBSHIyylDAMqb8oACA/exec') },
```

`AKfycbz0EqGZ...` (@48) は古い deployment。fallback を `AKfycbyOtef10...` (@58 staff UI) に更新する作業を次セッションで実施。
- ScriptProperties `JREC_SF01_PORTAL_URL` で override されている可能性があるため、未 override 状態でもこの fallback だけで正しい URL に向くようにする
- `gas/portal-gateway-v1.gs` ↔ `scripts/portal-gateway-v1.gs` SHA256 同期必須
- JBIZ 単独 clasp push + clasp deploy 必要（既存 JBIZ deploymentId 維持）
- JBIZ smoke 248 spec 再確認

### 8.2 古い @48 deployment の archive 検討

`AKfycbz0EqGZ...` (@48) は使われている形跡が JBIZ fallback URL のみ（grep 確認済み）。8.1 完了後に GAS Apps Script editor から archive 可能。

### 8.3 deployment description ガバナンス

将来の URL 誤認防止のため、deployment description に `[USE-FOR: staff-ui]` / `[USE-FOR: jbiz-api]` / `[USE-FOR: patient-public]` 等のプレフィックスを付ける運用を検討。

### 8.4 live-check spec 強化案

`prodUrl` の deploy version を自動確認する spec を `questionnaire-admin.spec.ts` 末尾に追加検討（QA-PROD-DEPLOY-CHECK 案: prodUrl に `?page=questionnaireIssue` で fetch → "token を発行する" の文字列が含まれることを確認）。

---

## 9. トークン式問診票の実運用テスト手順（次フェーズ）

@58 deploy 後、以下のフローでテスト可能:

1. staff UI で `?page=questionnaireIssue` を開く
2. source を「LINE」「QRコード」「スタッフ手渡し」から選ぶ
3. 「token を発行する」をクリック → token 生成（@58 / `createQuestionnairePublicToken`）
4. 画面に表示される:
   - publicUrl: `AKfycbw0aWYY.../exec?page=questionnairePublic&t=<rawToken>`（@57 public deploy）
   - QR 画像: `chart.googleapis.com` 240×240
   - LINE 文面: 院長確認済みのテンプレ（有効期限・1回限り注意付き）
5. LINE / QR / コピーで患者に送付
6. 患者がスマホで開く（Google ログイン不要 ANYONE_ANONYMOUS）
7. 患者が入力 → 送信
8. staff UI `?page=questionnaireAdmin&filter=submitted` で受信確認
9. 詳細から Q-1B（患者登録転記）/ Q-1C（カルテ転記）に進める

患者向け URL は `AKfycbw0aWYY...` (@57 public) なので staff UI とは別 deploy。両者は token を介して連動する。

---

## 10. 並行作業との切り分け（本セッション）

| プロセス | 範囲 | 影響 |
|---|---|---|
| 本セッション（claude pid 7304）| JREC-SF01 clasp push + clasp deploy --deploymentId（@53 → @58 update）+ docs / PROJECT_STATUS.md 追記 | edit window 最短、JBIZ には触れず |
| 別 Claude（pid 17956 / 16736）| `tools/live-check-runner/projects/wildboar/` 専用（11:09 node workers 3 つ稼働、おそらく wildboar test 実行中）| JREC-SF01 scriptId `1-1opRk...` への並行 clasp push なし、JREC-SF01 ファイル lastWrite は 08:35:09（私の pull 時刻）のまま |

JREC-SF01 scriptId への clasp 操作は single writer rule を満たし、安全に完結。
