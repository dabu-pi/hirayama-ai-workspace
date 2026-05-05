# 手動テストチェックリスト

作成日：2026-05-04
最終更新：2026-05-05（Phase 2 静的確認追記）

各フェーズの実装後に実施する手動テストのチェックリスト。

---

## Phase 1 テスト — スプレッドシート設定確認

**実施日：2026-05-05 / 対象：DEVスプレッドシート**

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 1-1 | スプレッドシートに11シートすべてが存在する | 11シートのタブが確認できる | 2026-05-05 | OK |
| 1-2 | Membersシートのヘッダーが正しい | 列名がSHEET_SCHEMA.mdと一致する | 2026-05-05 | OK |
| 1-3 | Membersシートのstatusに入力規則が設定されている | active/paused/withdrawn のドロップダウンが表示される | 2026-05-05 | OK |
| 1-4 | MembershipPlansシートにコースデータが入力されている | 6件のコースデータが存在する（PLAN-001〜006） | 2026-05-05 | OK |
| 1-5 | Settingsシートに初期設定値が入力されている | 13件の設定値が存在する | 2026-05-05 | OK |
| 1-6 | FeeRulesシートに料金ルールが入力されている | 6件のルールが存在する（FR-001〜006） | 2026-05-05 | OK |
| 1-7 | 入力規則が15箇所に設定されている | GASログで「入力規則設定完了（15箇所）」を確認 | 2026-05-05 | OK |
| 1-8 | setupSpreadsheet() を2回実行しても重複が発生しない | Settings: 0件追加（13件スキップ）等のログを確認 | 2026-05-05 | OK |
| 1-9 | KeyCardsシートに全鍵番号が入力されている | 全鍵がavailableとして登録されている | - | SKIP（Phase 2前にオーナーが手動登録） |

---

---

## Phase 2 静的確認（コードレビュー） — 2026-05-05

**実施方法:** GAS Webアプリ未デプロイのため、Playwright 実機実行は未実施。
ソースコードの静的分析（全ファイル目視確認）で確認。

### 発見された重大バグ

| # | 内容 | ファイル | 修正状態 |
|---|---|---|---|
| BUG-01 | `appsscript.json` の `executeAs` が `USER_ACCESSING`（匿名ユーザーがフォーム送信時にスプレッドシート書き込みエラーになる） | `gas-project/appsscript.json` | **修正済み → `USER_DEPLOYING` に変更・clasp push 実施** |

### 静的確認チェックリスト

| # | 確認内容 | 確認方法 | 結果 | 備考 |
|---|---|---|---|---|
| SC-01 | `?page=intake-form` ルーティング存在 | Code.gs switch case | PASS | |
| SC-02 | Step 1〜5 HTML要素が定義されている | intake-form.html | PASS | id=step1〜step5 |
| SC-03 | Step 1: 氏名・フリガナ・生年月日・性別・職業フィールド | intake-form.html | PASS | 全フィールド実装済み |
| SC-04 | Step 2: 郵便番号・都道府県・市区町村・番地・建物名フィールド | intake-form.html | PASS | 全フィールド実装済み |
| SC-05 | Step 2: zipcloud API フォールバック（失敗時は手入力可能） | intake-form.html L764 | PASS | catch → エラー表示のみ |
| SC-06 | Step 3: 携帯・自宅電話・メールフィールド | intake-form.html | PASS | 全フィールド実装済み |
| SC-07 | Step 4: 緊急連絡先氏名・続柄・電話番号フィールド | intake-form.html | PASS | 全フィールド実装済み |
| SC-08 | Step 5: getMembershipPlans() でコース動的取得 | IntakeService.gs L16 | PASS | アクティブ・表示順でフィルタ |
| SC-09 | Step 5: プライバシー同意チェックボックス | intake-form.html L401 | PASS | |
| SC-10 | 確認画面: fillConfirmScreen() で全項目表示 | intake-form.html L798 | PASS | 全フィールドマッピング確認 |
| SC-11 | 送信: submitForm() → saveIntakeApplication() 呼び出し | intake-form.html L877 | PASS | |
| SC-12 | 完了画面: receiptId に受付番号を表示 | intake-form.html L881 | PASS | |
| SC-13 | 受付番号形式 APP-YYYYMMDD-XXXX | IntakeService.gs L118 | PASS | 当日連番・4桁ゼロ埋め |
| SC-14 | IntakeApplications シートへの appendRow() 呼び出し | IntakeService.gs L96 | PASS | |
| SC-15 | review_status = 'pending' で保存 | IntakeService.gs L88 | PASS | |
| SC-16 | 二重送信防止: submitting フラグ + ボタン disabled | intake-form.html L842 | PASS | |
| SC-17 | 個人情報ログ出力なし: Logger.log に氏名・住所・電話なし | IntakeService.gs L59, L97 | PASS | application_id のみ |
| SC-18 | バックエンドバリデーション (validateIntakeForm) 実装済み | ValidationService.gs L18 | PASS | フロント・バックで二重チェック |
| SC-19 | sessionStorage でステップ間データ保持 | intake-form.html L772 | PASS | 送信完了後に clear() |
| SC-20 | XSS 対策: esc() 関数でコースカード HTML をエスケープ | intake-form.html L903 | PASS | |

---

## Phase 2 テスト — 入会フォーム

**前提:** GAS Webアプリとしてデプロイ済みであること
**実機テスト状態:** ⏸ URL未設定のため未実施（Playwright spec は `tests/intake/phase2.spec.js` に追加済み）

### 正常ケース

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 2-1 | Step1で全項目を入力して「次へ」をタップ | エラーなくStep2に進む | | SKIP（URL未設定） |
| 2-2 | Step2で郵便番号を入力して「住所を検索」 | 都道府県・市区町村が自動入力される | | SKIP（URL未設定） |
| 2-3 | Step5で「確認画面へ」をタップ | 入力した全内容が確認画面に表示される | | SKIP（URL未設定） |
| 2-4 | 確認画面で「この内容で申し込む」をタップ | ローディング表示 → 受付番号が表示される | | SKIP（URL未設定） |
| 2-5 | 申込完了後、IntakeApplicationsシートを確認 | 最新行に申込データが保存されている | | SKIP（URL未設定） |
| 2-6 | review_status が pending になっている | シートの review_status 列で確認できる | | SKIP（URL未設定） |
| 2-7 | 受付番号の形式が APP-YYYYMMDD-XXXX になっている | 例: APP-20260505-0001 | | SKIP（URL未設定） |
| 2-8 | 「ホームへ戻る」をタップ | ホーム画面に遷移する | | SKIP（URL未設定） |

### バリデーションチェック

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 2-9  | Step1: 氏名（姓）を空欄で「次へ」 | エラーメッセージが表示されStep2に進まない | | |
| 2-10 | Step1: フリガナにひらがなを入力して「次へ」 | 「全角カタカナで入力してください」エラー | | |
| 2-11 | Step1: 生年月日を未来の日付で入力して「次へ」 | 生年月日エラーが表示される | | |
| 2-12 | Step3: 携帯番号を8桁で入力して「次へ」 | 電話番号エラーが表示される | | |
| 2-13 | Step5: コースを選択せず「確認画面へ」 | 「コースを選択してください」エラー | | |
| 2-14 | Step5: プライバシー同意なしで「確認画面へ」 | 「同意が必要です」エラー | | |

### 操作性・保持確認

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 2-15 | Step3まで入力後「戻る」でStep2へ戻る | Step2の入力内容が残っている | | |
| 2-16 | 「この内容で申し込む」を素早く2回タップ | 2回送信されない（二重送信防止） | | |
| 2-17 | Step5でコース一覧が表示される | MembershipPlansのアクティブなコースが表示される | | |

### タブレット確認

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 2-18 | iPad（横向き）でフォームを表示する | レイアウトが崩れない | | |
| 2-19 | 電話番号フィールドにフォーカス | 数字キーパッドが表示される | | |
| 2-20 | プログレスバーが各ステップで更新される | 1/5〜5/5 → 確認 → 完了の流れで表示 | | |

---

## Phase 3 Playwright Live Check — 2026-05-05 **（10/10 PASS）**

**実施方法:** `access: ANYONE_ANONYMOUS` に修正・デプロイ @2 後、Playwright headless Chromium で実機確認。

| # | テスト内容 | 実施日 | 結果 |
|---|---|---|---|
| 3-1-1 | `?page=member-list` でフィルタタブ4種が表示される | 2026-05-05 | **PASS** |
| 3-1-2 | 「再読み込み」ボタンが表示される | 2026-05-05 | **PASS** |
| 3-1-3 | ページタイトルが正しい | 2026-05-05 | **PASS** |
| 3-1-4 | GAS 呼び出し後に適切な状態が表示される | 2026-05-05 | **PASS** |
| 3-1-5 | フィルタタブのアクティブ状態切り替え | 2026-05-05 | **PASS** |
| 3-1-6 | テーブル行のボタン確認 | 2026-05-05 | **PASS**（DEV データなし→空状態正常） |
| 3-1-7 | バッジに申込件数が表示される | 2026-05-05 | **PASS**（0件表示確認） |
| 3-2-1 | applicationId 未指定でエラービューが表示される | 2026-05-05 | **PASS**（ERROR_VIEW: true） |
| 3-2-2 | 存在しないIDでエラービューが表示される | 2026-05-05 | **PASS**（ERROR: true） |
| 3-5-1 | 静的確認 — GAS ログに個人情報が出力されないこと | 2026-05-05 | **PASS**（コードレビュー確認） |

### データ依存テスト（IntakeApplications に申込データ追加後に実施）

| # | テスト内容 | 結果 |
|---|---|---|
| 3-3-1〜3-3-6 | 実データで member-detail 確認 | SKIP（TEST_APPLICATION_ID 未設定） |
| 3-4-1 | 正式登録インテグレーション | SKIP（テストデータ未準備） |
| 3-4-2 | 二重承認防止 | SKIP（承認済み申込なし） |

---

## Phase 3 静的確認（コードレビュー） — 2026-05-05

**実施方法:** clasp push / deploy 更新済み。Playwright は `ANYONE_ANONYMOUS` 修正後に実機実行（10 PASS）。
ソースコードの静的分析（全ファイル目視確認）で確認。

### 発見されたスペックバグ（Playwright spec の記述誤り・重大度: 低）

| # | 内容 | 修正状態 |
|---|---|---|
| SPEC-01 | Playwright spec が `#key_card_number` を参照 → 実際は `#s_keyCard` | 修正済み |
| SPEC-02 | Playwright spec が `#rejectDialog` を参照 → 実際は `#rejectOverlay` | 修正済み |
| SPEC-03 | Playwright spec が `#loadingOverlay` を参照 → 実際は `#loadingView` | 修正済み |

### 静的確認チェックリスト

| # | 確認内容 | 確認方法 | 結果 | 備考 |
|---|---|---|---|---|
| SC-P3-01 | `?page=member-list` ルーティング存在 | Code.gs switch case | PASS | html/member-list に正常ルーティング |
| SC-P3-02 | `?page=member-detail` ルーティング存在 | Code.gs switch case | PASS | html/member-detail に正常ルーティング |
| SC-P3-03 | member-detail に applicationId テンプレート変数が渡る | Code.gs L50: `template.applicationId = e.parameter.id` | PASS | |
| SC-P3-04 | member-list: フィルタタブ4種（すべて/未確認/承認済み/差し戻し） | member-list.html | PASS | `data-filter` 属性で実装 |
| SC-P3-05 | member-list: バッジカウント（全件・pending・approved・rejected） | member-list.html | PASS | `#badge-*` 要素 |
| SC-P3-06 | member-list: getIntakeApplications() 呼び出し | member-list.html L191 | PASS | |
| SC-P3-07 | member-list: pending 申込に「確認する」ボタン表示 | member-list.html L251-252 | PASS | `.btn-primary` |
| SC-P3-08 | member-list: goToDetail() で `?page=member-detail&id=...` にナビゲーション | member-list.html L271-274 | PASS | URL エンコード済み |
| SC-P3-09 | member-list: XSS 対策（esc() でエスケープ） | member-list.html L253,257 | PASS | |
| SC-P3-10 | member-detail: APPLICATION_ID 空の場合にエラー表示 | member-detail.html L363-366 | PASS | `showError()` 呼び出し |
| SC-P3-11 | member-detail: getIntakeApplicationById() 呼び出し | member-detail.html L377 | PASS | |
| SC-P3-12 | member-detail: getMembershipPlans() 呼び出し | member-detail.html L381 | PASS | |
| SC-P3-13 | member-detail: getAvailableKeyCards() 呼び出し | member-detail.html L385 | PASS | |
| SC-P3-14 | member-detail: generateNextMemberId() で会員番号提案 | member-detail.html L389 | PASS | |
| SC-P3-15 | member-detail: calcInitialFee() でリアルタイム費用計算 | member-detail.html L541 | PASS | コース・入会日変更でトリガー |
| SC-P3-16 | member-detail: 費用内訳（入会金・カードキー・日割り・翌月）表示 | member-detail.html L552-568 | PASS | |
| SC-P3-17 | member-detail: 正式登録ボタンは全必須項目揃うまで disabled | member-detail.html L292,580-586 | PASS | |
| SC-P3-18 | member-detail: 正式登録ダイアログ（確認内容表示） | member-detail.html L317-326 | PASS | `#approveOverlay` |
| SC-P3-19 | member-detail: 差し戻しダイアログ（理由入力） | member-detail.html L329-339 | PASS | `#rejectOverlay` |
| SC-P3-20 | member-detail: 処理済み申込はフォームを非表示にして処理済み情報表示 | member-detail.html L493-504 | PASS | |
| SC-P3-21 | 二重承認防止（approveIntakeApplication） | IntakeService.gs L234-237 | PASS | `review_status !== PENDING` でブロック |
| SC-P3-22 | 二重差し戻し防止（rejectIntakeApplication） | IntakeService.gs L324-327 | PASS | 同上 |
| SC-P3-23 | createMember でのログに個人情報なし | MemberService.gs L127 | PASS | `memberId` のみ |
| SC-P3-24 | approveIntakeApplication でのログに個人情報なし | IntakeService.gs L305 | PASS | `applicationId → memberId` のみ |
| SC-P3-25 | rejectIntakeApplication でのログに個人情報なし | IntakeService.gs L346 | PASS | `applicationId` のみ |
| SC-P3-26 | AuditLog に承認操作が記録される | IntakeService.gs L297-303 | PASS | action=approve, targetId=applicationId |
| SC-P3-27 | AuditLog に差し戻し操作が記録される | IntakeService.gs L339-343 | PASS | action=reject |
| SC-P3-28 | Payments に初回費用レコードが作成される | IntakeService.gs L263-278 | PASS | 費用記録失敗は警告のみで続行 |
| SC-P3-29 | KeyCards の状態が in_use に更新される | MemberService.gs L119-124 | PASS | `updateRowByKey()` で更新 |

---

## Phase 3 テスト — スタッフ確認・会員登録（実機確認）

**前提:** GAS Webアプリとしてデプロイ済みであること、Playwright 認証セッション設定済みであること
**実機テスト状態:** ⏸ Google 認証セッション未設定のため未実施（Playwright spec は `tests/intake/phase3.spec.js` に追加済み）

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 3-1 | `?page=member-list` で申込一覧が表示される | フィルタタブ・テーブルが表示される | | SKIP（認証未設定） |
| 3-2 | 未確認申込の「確認する」で member-detail に遷移する | `?page=member-detail&id=...` に遷移する | | SKIP（認証未設定） |
| 3-3 | 詳細画面で会員番号提案値が表示される | 既存最大番号+1 の形式で表示される | | SKIP（認証未設定） |
| 3-4 | 空き鍵番号が選択肢に表示される | KeyCards の available な番号のみ | | SKIP（認証未設定） |
| 3-5 | 初回費用がリアルタイム計算される | コース・入会日変更で金額更新される | | SKIP（認証未設定） |
| 3-6 | 「正式登録する」でテスト会員が登録される | Members シートに行追加・KeyCards 更新・Payments 記録 | | SKIP（認証未設定） |
| 3-7 | 登録後 AuditLogs に操作ログが記録される | approve アクションのログが確認できる | | SKIP（認証未設定） |
| 3-8 | 「差し戻す」でテスト申込が却下される | review_status=rejected / AuditLog 記録 | | SKIP（認証未設定） |
| 3-9 | 承認済み申込を再承認しようとするとエラー | 「すでに処理済みです」メッセージ | | SKIP（認証未設定） |
| 3-10 | GAS 実行ログに個人情報が出力されていない | ログに氏名・住所・電話番号なし | | SKIP（認証未設定） |

---

## Phase 4 テスト — 会員一覧・検索・詳細

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 4-1 | 会員一覧に登録済み会員が表示される | 全会員が一覧に表示される | | |
| 4-2 | ステータスでフィルタする | active/pause/withdrawn別に絞り込める | | |
| 4-3 | 氏名で検索する | 部分一致する会員が表示される | | |
| 4-4 | 会員番号で検索する | 一致する会員が表示される | | |
| 4-5 | 会員詳細を開くと全情報が表示される | 全フィールドが表示される | | |
| 4-6 | 会員情報を編集して保存する | Membersシートの内容が更新される | | |
| 4-7 | 編集後、AuditLogsに変更が記録される | update アクションの旧値・新値が記録されている | | |

---

## Phase 5 テスト — 休会・退会・再開

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 5-1 | activeな会員に休会処理を行う | Membersのstatusがpauseになる | | |
| 5-2 | 休会処理後、StatusHistoryに記録される | change_type=pause の行が追加される | | |
| 5-3 | 休会処理で鍵を返却すると、KeyCardsがavailableになる | 対象の鍵番号がavailableになる | | |
| 5-4 | 休会中の会員に退会処理を行う | Membersのstatusがwithdrawnになる | | |
| 5-5 | 退会処理後、StatusHistoryに記録される | change_type=withdraw の行が追加される | | |
| 5-6 | 休会中の会員に再開処理を行う | Membersのstatusがactiveになる | | |
| 5-7 | 再開処理後、StatusHistoryに記録される | change_type=restart の行が追加される | | |
| 5-8 | activeな会員には休会のみ選択できる | 退会・再開は選択できない | | |

---

## Phase 7 テスト — リコーリース集金代行エクスポート

| # | テスト内容 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|
| 7-1 | 集金データ作成ボタンをクリックするとプレビューが表示される | 対象会員数・合計金額が表示される | | |
| 7-2 | 休会中の会員がプレビューの対象外になっている | 除外会員リストに休会中会員が表示される | | |
| 7-3 | 退会済みの会員がプレビューの対象外になっている | 除外会員リストに退会済み会員が表示される | | |
| 7-4 | エクスポートするとCSVファイルがダウンロードされる | ファイルが正しいフォーマットで出力される | | |
| 7-5 | エクスポート後、BillingExportsシートに記録される | export_id・対象月・件数・合計が記録される | | |
| 7-6 | 同じ月のエクスポートを2回実行すると警告が表示される | 重複エクスポートの警告が表示される | | |

---

## 結果記録フォーマット

| 状態 | 記号 |
|---|---|
| 合格 | OK |
| 不合格 | NG（バグ報告を作成する） |
| 未実施 | （空欄） |
| スキップ | SKIP（理由を記録する） |
