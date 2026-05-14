# Q-3 live-check consolidation 記録 — 2026-05-15

## 目的

JREC-SF01 自費問診票まわりの questionnaire spec 6 本（合計 80 spec）の再棚卸しと、Q-2C 以降で確定した renderPublicError_ 文言との spec drift 解消。

人間作業を最小化し、live-check-runner で再現可能な検証状態を整える。

---

## 作業対象 repo

| repo | path | 役割 |
|---|---|---|
| workspace | `C:\hirayama-ai-workspace\workspace` | spec 修正 + 記録 |
| jrec-sf01-selfpay | `C:\hirayama-ai-workspace\workspace\gas-projects\jrec-sf01-selfpay` | PROJECT_STATUS.md 更新（GAS 実装変更なし）|
| hirayama-jyusei-strategy | `C:\hirayama-ai-workspace\workspace\hirayama-jyusei-strategy` | 触れない（KPI / Portal 影響なし）|

---

## 棚卸し対象 6 本（合計 80 spec）

| spec | フェーズ | 全 spec | 主要シナリオ |
|---|---|---|---|
| questionnaire-admin.spec.ts | Q-1A | 15 | 一覧 / 詳細 / staffMemo / Trash / Run_Log / doc 4 |
| questionnaire-transfer-patient.spec.ts | Q-1B | 13 | preview / create / 重複ガード / linkExisting / doc 2 |
| questionnaire-transfer-chart.spec.ts | Q-1C | 11 | preview / createDraft / patientId 必須 / 二重転記防止 / doc 2 |
| questionnaire-public.spec.ts | Q-2A / Q-2B | 16 | token 発行 / ANYONE_ANONYMOUS / フォーム送信 / doc 3 |
| questionnaire-public-ux.spec.ts | Q-2C | 14 | 送信完了 / 期限切れ / 不正 token / 二重送信防止 / doc 3 |
| questionnaire-issue.spec.ts | Q-4 | 11 | token 発行 UI / QR / LINE テンプレ / doc 1 |

---

## 作業開始前の git 状態（GitHub 正本同期確認）

```
=== workspace ===
branch: feature/auto-dev-phase3-loop
HEAD: ebcec9e（fetch 後 ahead/behind 0/0）
status: clean
missing tracked: 0

=== jrec-sf01-selfpay ===
branch: main
HEAD: 1d677bb → ff-only pull で c6a2f70 へ進める（7 commits）
取り込み: Q-1A/Q-1B/Q-1C/Q-2A/2B/Q-2C/Q-4 + Portal-17 関連
status: .claude/ 1 件 untracked（既知 scope-out）
missing tracked: 0

=== hirayama-jyusei-strategy ===
branch: main
HEAD: c7c3b6a
status: clean
missing tracked: 0
gas/scripts SHA256: 取り込み済み（過去 commit 内で MATCH 確認）
```

並行 process 確認: `claude` pid 7304（自プロセス）1 つのみ。`node` / `tsx` / `playwright` / `clasp` 常駐なし。CDP 9222 オフ。`life-design-project` は別 branch `feature/nishio-initial-interview` で clean、今回触らない。

---

## live-check-runner 実行コマンド

```
cd C:\hirayama-ai-workspace\workspace\tools\live-check-runner
npm run test:jrec:questionnaire-admin
npx playwright test projects/jrec-sf01/questionnaire-transfer-patient.spec.ts projects/jrec-sf01/questionnaire-transfer-chart.spec.ts projects/jrec-sf01/questionnaire-issue.spec.ts
npx playwright test projects/jrec-sf01/questionnaire-public.spec.ts projects/jrec-sf01/questionnaire-public-ux.spec.ts
```

dev URL: `@54`（config.json）
public exec URL: `AKfycbw0aWYY0hPySJeAAcoJFg82zXFOzmBAaOVwQk5gVM3tlAGWJR37v2uflUr2qnxKpAb0og/exec` (ANYONE_ANONYMOUS)
auth.json: `lastWrite 2026-05-14 15:59:24`（16.6h age）

---

## 検出した drift（修正前）

### FAIL 1: QP-3 token なしアクセス

```
test("QP-3: token なしアクセスでエラーページが返る（ANYONE_ANONYMOUS / 未ログイン）", ...)
```

期待値: `expect(body, "should show error about invalid token").toMatch(/エラー|無効/)`

実 UI（Q-2C `renderPublicError_("missing_token")` 確定後）:
```
🔗 問診票リンクを確認できませんでした
URLが正しいかご確認ください。
リンクを再発行する場合は受付またはLINEでご連絡ください。
```

→ `/エラー|無効/` にマッチせず FAIL。

### FAIL 2: QP-4 不正 token

期待値同上 `/エラー|無効/`。実 UI は同じ「問診票リンクを確認できませんでした」（`renderPublicError_("invalid_token")`）。FAIL。

### Q-2C の QU-7 / QU-8 は正しい期待値で PASS

```
expect(body, "should show link error page").toMatch(/確認できませんでした|URL.*確認/);
```

Q-2A/Q-2B spec 追加時は `renderPublicError_` 文言確定前だったため `/エラー|無効/` で書かれていた。
Q-2C で UI を整え専用エラーページに変更したのと整合がとれていなかった。

---

## 修正内容（spec のみ）

ファイル: `tools/live-check-runner/projects/jrec-sf01/questionnaire-public.spec.ts`

QP-3 / QP-4 の期待値を Q-2C と整合する形に統一。

```diff
- expect(body, "should show error about invalid token").toMatch(/エラー|無効/);
+ // Q-2C 以降の renderPublicError_ 文言と整合: 「問診票リンクを確認できませんでした」
+ expect(body, "should show link error page (missing token)").toMatch(/エラー|無効|確認できませんでした|URL.*確認/);

- expect(body, "should show invalid token error").toMatch(/エラー|無効/);
+ // Q-2C 以降の renderPublicError_ 文言と整合: invalid_token は「問診票リンクを確認できませんでした」
+ expect(body, "should show link error page (invalid token)").toMatch(/エラー|無効|確認できませんでした|URL.*確認/);
```

GAS / HTML 実装の変更なし。clasp push / deploy 不要。

---

## 修正後 live-check 結果

| spec | PASS | skipped | FAIL | 備考 |
|---|---|---|---|---|
| questionnaire-admin (Q-1A) | 4 | 11 | 0 | dev URL auth 切れ → 実機 spec skip / doc 4 PASS |
| questionnaire-transfer-patient (Q-1B) | 2 | 11 | 0 | 同上 / doc 2 PASS |
| questionnaire-transfer-chart (Q-1C) | 2 | 9 | 0 | 同上 / doc 2 PASS |
| questionnaire-public (Q-2A/Q-2B) | 6 | 10 | 0 | doc 3 + QP-3 + QP-4 + QP-CLEANUP（skip 連鎖で即 return PASS）|
| questionnaire-public-ux (Q-2C) | 9 | 5 | 0 | doc 3 + 静的確認 + Public no-login UX 6 件 |
| questionnaire-issue (Q-4) | 1 | 10 | 0 | doc 1 PASS |
| **合計** | **24** | **56** | **0** | - |

**修正前**: 22 PASS / 56 skipped / 2 FAIL
**修正後**: 24 PASS / 56 skipped / 0 FAIL

---

## skipped 56 件の扱い

dev URL 経由 spec は `handleAuthRedirect` で auth.json 期限切れ時に `test.skip` する設計。これは仕様通りの safety net。

skipped 56 件の **CLOSED 認識** は jrec-sf01 直近 7 commit（pull 取り込み分）の commit message で確認済み:

| commit | フェーズ | live-check 結果 |
|---|---|---|
| 4cecba1 | Q-1A admin-base | 15 / 15 PASS |
| 5840279 | Q-1B questionnaire to patient | 13 / 13 PASS |
| 443aecf | Q-1C questionnaire to visit chart | 11 / 11 PASS |
| db1e6a7 | Q-2A / Q-2B public token + form | 16 / 16 PASS |
| 5ebb190 | Portal-17 questionnaire L3 KPI | 13 / 13 PASS（chronic-pain-kpi）|
| bfc88d1 | Q-4 questionnaire-issue | 11 / 11 PASS |
| c6a2f70 | Q-2C public questionnaire UX | 14 / 14 PASS |

直近の認証セッションで全 spec が PASS している記録があり、再現性は確保されている。auth.json を save-auth で更新すれば、本セッションでも 56 件 PASS する見込み。

---

## auth.json 再認可の運用（人間最小作業）

今回の作業範囲では auth 再取得は不要。dev URL 経由 spec を再実行したい場合のみ、以下を **single writer ルール（CLAUDE.md §Multi-Claude）に従って** 実施する。

1. 他 Claude / clasp / verify 並行作業を全停止
2. Chrome を flag 付きで再起動: `Get-Process chrome | Stop-Process -Force` → flag 付きで 1 個起動 → CDP 9222 enable
3. 対象 Google アカウントでログイン
4. `cd tools/live-check-runner; npm run save-auth`
5. `auth.json` 更新を確認（size / lastWrite）
6. workspace single writer で commit / push

---

## PII / token 安全性確認

修正は spec 期待値の正規表現変更のみ。

| 確認 | 結果 |
|---|---|
| PII を URL / log / console / Dashboard に出していない | ✅（テストデータ Q1B/Q1C は `Q1Bテスト患者` / `090-0001-9999` などダミー）|
| raw token を保存していない | ✅（QP-1 で TEST_RAW_TOKEN は spec 内変数のみ。GAS 側 secureTokenHash の hash 保存仕様は変更なし）|
| Public page error 文言に PII を出さない | ✅（`renderPublicError_` は固定文言のみ）|
| 既存 schema と互換性を保つ | ✅（GAS / HTML 変更なし）|
| 既存 CLOSED phase を壊さない | ✅（Q-2C の QU-7/QU-8 は同正規表現で動作中、変更なし）|

---

## Dashboard / Task_Queue / Run_Log 反映

なし。

理由: 今回は spec 期待値の drift 解消のみで、以下に該当しないため。
- KPI 定義変更なし
- Portal 表示変更なし
- Portal-17 / `questionnaire_layer_connected` の扱い変更なし
- Task_Queue に載せるべき新規継続タスクなし
- Run_Log イベント変更なし
- 月次レビュー記述に影響なし
- 外販テンプレ化に影響なし

---

## 次アクション候補

| 候補 | 内容 | 緊急度 |
|---|---|---|
| auth.json 再認可 | 後で `dev URL` 経由 spec 56 件を再現実行したいときに人間が save-auth | 低（CLOSED 認識は既存 commit で確認済み）|
| Q-2A/Q-2B spec の QP-2 強化 | publicUrl が exec URL を含むかの確認に dev URL 戻り値依存があり、auth 切れで skip。spec を簡素化検討 | 低 |
| QU-2 (送信完了画面実機確認) | google.script.run は noAuth context で 50s かかる可能性。設計を再確認 | 中（現状動いている） |
| Multi-Claude 単一 writer ルール | 並行 Claude が `auth.json` を上書きする事故を避けるため、live-check-runner 編集前の pre-check スクリプトを追加検討 | 低 |

---

## 作業被り防止メモ

本作業は単一 Claude セッション（pid 7304 / Windows）で実施。
GAS deploy / clasp push / Apps Script 認可 / auth.json 更新は **行っていない**。
他 Claude / 他 PC が同時に live-check-runner / jrec-sf01 / hirayama-jyusei-strategy を編集していないことを `Get-Process` で確認済み。
