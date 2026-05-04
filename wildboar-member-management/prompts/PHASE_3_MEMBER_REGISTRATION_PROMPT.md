# Phase 3 スタッフ確認・会員登録実装 — AIへの引き継ぎプロンプト

このプロンプトはPhase 3（スタッフ確認・会員登録機能実装）を担当するAIへの引き継ぎです。

---

## このフェーズの目的

スタッフが入会申込を確認し、会員番号・鍵番号を割り当てて、
正式な会員として登録できる管理画面を実装する。

## 作業前に必ず読むファイル

1. `CONTEXT.md` — プロジェクト背景・重要ルール
2. `AI_RULES.md` — AIが守るべきルール
3. `docs/STAFF_REVIEW_FLOW.md` — スタッフ確認画面の詳細設計（最重要）
4. `docs/FEE_CALCULATION_RULES.md` — 初回費用計算ルール
5. `docs/DATA_MODEL.md` — データモデル（Member登録時の処理フロー）
6. `gas-project/MemberService.gs` — 会員CRUD操作のスタブ
7. `gas-project/IntakeService.gs` — 申込処理のスタブ（Phase 2 で実装済み）
8. `gas-project/FeeService.gs` — 初回費用計算のスタブ
9. `gas-project/AuditLogService.gs` — 操作ログのスタブ
10. `gas-project/html/member-list.html` — 申込一覧HTMLのスタブ
11. `gas-project/html/member-detail.html` — 申込詳細確認HTMLのスタブ

## Phase 3 のタスク

### バックエンド（GAS）

- MemberService.gs の実装
  - createMember(applicationId, memberId, keyCardNumber, planId, joinDate)
  - generateNextMemberId()
  - getMemberById(memberId)
  - getMembers(statusFilter)
- IntakeService.gs の実装（追加分）
  - getIntakeApplications(reviewStatus)
  - getIntakeApplicationById(applicationId)
  - approveIntakeApplication(applicationId, staffData)
  - rejectIntakeApplication(applicationId, reason)
- FeeService.gs の実装
  - calcInitialFee(planId, joinDate)
  - getMonthlyFee(planId)
  - getEnrollmentFee(planId)
  - getCardKeyFee()
  - getDaysInMonth(year, month)（Phase 2 で実装済みなら確認のみ）
  - getRemainingDays(joinDate)（Phase 2 で実装済みなら確認のみ）
- AuditLogService.gs の実装
  - log(logData)
  - generateLogId()
  - getCurrentOperator()
- ValidationService.gs の追加実装
  - validateMemberId(value) — 会員番号の重複チェックを含む

### フロントエンド（HTML）

- member-list.html の実装（申込一覧タブ）
  - 未確認申込の一覧表示
  - ステータスフィルタ
  - 「確認する」ボタン
  - 未確認件数バッジ
- member-detail.html の実装（申込確認・登録）
  - 申込内容の全表示
  - スタッフ入力エリア（会員番号・鍵番号・コース・入会日）
  - 空き鍵番号のドロップダウン選択
  - 初回費用の自動計算・内訳表示
  - 「正式登録する」ボタン（確認ダイアログ付き）
  - 「差し戻す」ボタン（理由入力ダイアログ付き）

## 会員番号の採番ロジック

- Settingsシートから `member_id_prefix`（例：W）と `member_id_digits`（例：4）を取得する
- Membersシートの現在の最大番号を取得する
- 最大番号 + 1 をゼロパディングして採番する（例：W-0001, W-0042）
- 採番した番号をスタッフに提示し、スタッフが確認・変更できる

## 正式登録の処理フロー

1. IntakeApplicationsの review_status を approved に更新する
2. Membersシートに新規行を追加する
3. KeyCardsシートの鍵番号の status を in_use に、member_id を設定する
4. Paymentsシートに初回費用の記録を追加する
5. AuditLogsシートに操作を記録する

すべてのステップが成功してから完了画面を表示する。
途中でエラーが発生した場合はロールバックが難しいため、エラーログを残してスタッフに手動確認を促す。

## セキュリティ

- スタッフ管理画面は GAS の doGet で access = 'DOMAIN' または 'ANYONE_WITH_GOOGLE_ACCOUNT' に設定する
- Googleアカウントでのログインを必須にすることでアクセスを制限する
- getCurrentOperator() で操作者のメールアドレスを取得してAuditLogsに記録する

## 動作確認

- tests/manual-checklist.md の Phase 3 テスト項目を実施する
- テストデータは tests/live-check-plan.md の「テスト用ダミーデータ」を使用する

## 完了条件

- スタッフが申込一覧から申込を確認できる
- 会員番号・鍵番号の割り当てができる
- 初回費用が正しく計算されて表示される
- 正式登録するとMembersシートに行が追加される
- 差し戻し機能が動作する
- 全操作がAuditLogsに記録される
- tests/manual-checklist.md の Phase 3 項目が全て OK になっている

## 次のフェーズ

Phase 3 完了後は Phase 4（会員一覧・詳細・編集）を実装する。
引き継ぎプロンプトは今後作成する。
