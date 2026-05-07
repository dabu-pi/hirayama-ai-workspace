# WORKSPACE_REPO_STATUS — 2026-05-08

確認日時: 2026-05-08  
作成者: Claude Code (全リポジトリ pull 後の状態確認)

---

## workspace メインリポジトリ

| 項目 | 内容 |
|---|---|
| パス | `C:\hirayama-ai-workspace\workspace` |
| remote | `https://github.com/dabu-pi/hirayama-ai-workspace.git` |
| 現在 branch | `feature/auto-dev-phase3-loop` |
| latest commit | `19431c3 test: Wildboar W-10/W-11 Phase 11 コース変更・コース別集計 live-check追加 / 64/64 PASS` |
| pull 後の状態 | CLEAN（未コミット変更なし） |

### 本日のpull更新内容

`feature/auto-dev-phase3-loop`: 89c4019 → 19431c3（1コミット更新）
- `tools/live-check-runner/projects/wildboar/config.json` 更新（@28デプロイ情報反映）
- `tools/live-check-runner/projects/wildboar/smoke.spec.ts` 追加（W-10/W-11 テスト追加）

### ローカルブランチ一覧

| branch | upstream | 状態 |
|---|---|---|
| `feature/auto-dev-phase3-loop` | `origin/feature/auto-dev-phase3-loop` | 最新（pull済み） |
| `master` | `origin/master: behind 605` | 605コミット遅延（後述の理由でpull不可） |
| `recovery/restore-training-platform-source` | `origin/recovery/restore-training-platform-source` | checkout失敗（後述） |
| `backup/before-repo-split-20260505` | なし（upstream未設定） | ローカル専用バックアップ |

### master / recovery ブランチが pull できない理由

`training-program-platform-jp/` が workspace 内に独立 git リポジトリとして存在している。
`master` は `training-program-platform-jp/` をサブディレクトリとして管理していた時代のブランチであり、
checkout または pull しようとすると「untracked files が上書きされる」エラーが発生する。

```
error: The following untracked working tree files would be overwritten by merge:
    training-program-platform-jp/.env.example
    training-program-platform-jp/... (多数)
```

**これは設計上の想定内の状態。** `training-program-platform-jp` は独立リポジトリ化が完了済みであり、
workspace/master を更新する必要が生じた場合は別途判断が必要。

### remote-only branch（ローカルに存在しない）

| branch | 説明 |
|---|---|
| `origin/claude/objective-volhard` | 用途不明。取得不要と判断するまでローカル作成禁止 |
| `origin/feature/auto-dev-phase3` | 旧フェーズ。現在 phase3-loop が正規。取得不要 |

---

## 今後の禁止事項（workspace メインリポジトリ）

| 禁止操作 | 理由 |
|---|---|
| `git checkout master` | training-program-platform-jp/ と衝突 |
| `git pull master` | 同上 |
| `master` の 605コミット差を勝手に解消 | 影響範囲が広く、要人間判断 |
| `training-program-platform-jp/` の削除・退避・吸収 | 独立リポジトリとして稼働中 |
| remote-only branch のローカル作成 | 必要性を確認してから |
| `backup/before-repo-split-20260505` の削除 | 要判断 |

---

## 次回判断候補（人間が決める）

1. `master` の 605コミット差をどうするか（放置 / PR / merge / 廃止）
2. `origin/claude/objective-volhard` は何か？必要か？
3. `origin/feature/auto-dev-phase3` は削除してよいか？
4. `backup/before-repo-split-20260505` は削除してよいか？

---

## 各リポジトリの状態サマリー（2026-05-08 確認）

| リポジトリ | branch | latest commit | 状態 |
|---|---|---|---|
| workspace | `feature/auto-dev-phase3-loop` | `19431c3` | CLEAN / 最新 |
| desktop-work-status-overlay | `master` | `ec81397` | CLEAN / 最新 |
| subsidy-grants-projects | `main` | `35a44b9` | CLEAN / 最新 |
| training-program-platform-jp | `main` | `68997f2` | CLEAN / 最新 |
| training-trend-analyzer | `master` | `937914f` | CLEAN / 最新 |
| wildboar-member-management | `feature/wildboar-member-phase4` | `3b6210d` | CLEAN / 最新（6コミット pull済み） |

---

## Wildboar 更新内容（Phase 11 / 2026-05-07）

直前の全リポジトリ pull で `wildboar-member-management` が 6 コミット更新された（7a1983a → 3b6210d）。

### 更新内容の概要

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 11 | コース変更機能 + コース別集計 | CLOSED (PROD @28 / smoke 64/64 PASS) |
| Phase 11.1 | migration確認 + W-10/W-11 live-check追加 | CLOSED |
| Phase 11.2 | migration実行後確認 + Phase 11 サマリー作成 | CLOSED |

### 追加されたファイル（主要）

- `gas-project/PlanChangeService.gs` — コース変更ロジック
- `gas-project/DashboardService.gs` — ダッシュボード集計ロジック
- `gas-project/html/plan-change.html` — コース変更画面
- `gas-project/html/monthly-dashboard.html` — 月別ダッシュボード画面
- `docs/PHASE_11_PLAN_CHANGE_AND_PLAN_SUMMARY_2026-05-07.md` — Phase 11 記録

### PROD 情報

| 項目 | 値 |
|---|---|
| PROD WebApp URL | `https://script.google.com/macros/s/AKfycby2r--yf4vkm1FywAfYsLDZC2J0a43ce6TKNE0NedQoaHtARUUPG4VVSJ-rWYKsuJbBzg/exec` |
| 現在のデプロイ | @28（最新） |
| スプレッドシートID | `1DGg0XewfaN-aSlcbSrkgrdXifH5WtZmiJW_GABeuL6M` |
| GAS Script ID | `1wWhFryw2Nb1zXFY5lo9Qe-r8WIJyaQeg6QaS8sUqVkEOy1D0pasgDVIe` |

---

## Live-Check 実行結果（2026-05-08）

```
実行コマンド: npm run test:wildboar:prod
スペック: projects/wildboar/smoke.spec.ts
テスト数: 64（chromium 32 + mobile 32）
結果: 64/64 PASS
実行時間: 11.4分
```

| テスト範囲 | 結果 |
|---|---|
| W-1: ホーム画面（5テスト） | ✓ 全PASS |
| W-2: 入会フォーム（6テスト） | ✓ 全PASS（W-2f 羽渕fallback確認済み） |
| W-3: 申込一覧（2テスト） | ✓ 全PASS |
| W-4: 申込詳細（4テスト） | ✓ 全PASS |
| W-5: 会員一覧（2テスト） | ✓ 全PASS |
| W-6: 支払い一覧（2テスト） | ✓ 全PASS |
| W-7: 請求ダッシュボード（2テスト） | ✓ 全PASS |
| W-8: 月別ダッシュボード（2テスト） | ✓ 全PASS |
| W-9: カードキー/インボイス未設定（3テスト） | ✓ 全PASS |
| W-10: コース変更画面（2テスト） | ✓ 全PASS（Phase 11新機能） |
| W-11: コース別集計（2テスト） | ✓ 全PASS（Phase 11新機能） |

**本番 PROD @28 は正常稼働中。新機能（コース変更・月別ダッシュボード）も到達確認済み。**

---

## 今日完了したこと

- 全6リポジトリの git fetch --all --prune 実施
- 全CLEANリポジトリの ff-only pull 実施（2リポジトリで実更新）
- workspace/master と recovery ブランチの衝突原因を特定・記録
- Wildboar Phase 11 更新内容の把握
- live-check-runner smoke 64/64 PASS 確認
- 本ドキュメント作成

## まだやっていないこと / 次回やるべきこと

- Wildboar Phase 12（Next.js フロントエンド）は未着手
- wildboar migration（migrateAddPlanChangeHistory / migrateAddDesiredStartDate）は PROD GAS エディタで人間が実行必要
- workspace/master の 605コミット差の扱いは人間が判断
- training-program-platform-jp の新機能開発（未着手フェーズあり）
- desktop-work-status-overlay の Phase 3-D(DOM) 続き

## やってはいけないこと

- workspace/master を checkout / pull する（training-program-platform-jp/ と衝突）
- training-program-platform-jp/ を削除・退避・上書きする
- Wildboar 本番 WebApp URL を変える（PROD @28 URL を固定維持）
- Wildboar に新規デプロイする（既存 deploymentId 更新のみ可）
- remote-only branch を勝手にローカル作成する
- backup 系ブランチを勝手に削除する

## 手動確認が必要なこと

- wildboar migration 実行（PROD GAS エディタ → migrateAddPlanChangeHistory 実行）
- リコーリースCSV確認（OPERATION_START_CHECKLIST.md 参照）
- 実会員登録の本番運用開始判断（オーナー判断）
