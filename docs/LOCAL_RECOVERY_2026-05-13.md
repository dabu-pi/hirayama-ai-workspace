# LOCAL_RECOVERY_2026-05-13

## 概要

2026-05-13 の全 repo sync（fetch + pull）後に、3 repo で大量の `" D"` dirty state が判明した。
`git restore .` で GitHub 正本から全ファイルを復元した。

---

## 発見のきっかけ

全 repo sync セッション（同日）にて fetch → pull --ff-only を実行後、
最終状態確認で以下 3 repo が dirty と判明。

- `hirayama-jyusei-strategy`
- `training-program-platform-jp`
- `training-trend-analyzer`

---

## dirty の内容と原因

### 共通パターン

`git status --short` で ` D` 表示。
意味：**ファイルが git index（HEAD）には存在するが、ディスク上に物理ファイルが存在しない**状態。

### 各 repo の詳細

| repo | D ファイル数 | 主な欠損 | 原因推定 |
|---|---|---|---|
| `hirayama-jyusei-strategy` | 34 | 旧 strategy/finance/marketing/menu/operations/*.md | repo が JBIZ Portal へ移行した際、旧 docs がディスクから削除されたが git rm されていなかった |
| `training-program-platform-jp` | 112 | package.json / app/ / components/ / lib/ 等ほぼ全ソース | 独立 repo 化時にファイルがディスクから消えていた（.next/ node_modules/ は残存） |
| `training-trend-analyzer` | 121 | src/ / tests/ / scripts/ / docs/ / config/ 等全 Python ソース | 同上。data/collected/ data/db/ __pycache__/ は untracked として残存 |

### untracked について

`training-trend-analyzer` で確認した untracked は以下。
復元した `.gitignore` によってカバーされ、`git restore .` 後は `git status` に表示されなくなった。

- `data/collected/` — 収集済みデータ（実行生成物）
- `data/db/` — SQLite DB（実行生成物）
- `scripts/__pycache__/` 他 — Python キャッシュ

これらは削除せず残した。

---

## 実施した復旧手順

```powershell
# 3 repo それぞれで実行
git -C <repo_path> restore .
git -C <repo_path> status -sb  # → clean を確認
```

| repo | コマンド | 結果 |
|---|---|---|
| `hirayama-jyusei-strategy` | `git restore .` | clean（exit 0） |
| `training-program-platform-jp` | `git restore .` | clean（exit 0） |
| `training-trend-analyzer` | `git restore .` | clean（exit 0） |

---

## 復元後の検証

### ファイル存在確認

全 3 repo で主要ファイルが OK（Test-Path 確認済み）。

### 自動テスト

| repo | コマンド | 結果 |
|---|---|---|
| `training-trend-analyzer` | `python -m pytest --tb=no -q` | **164 tests PASS** |
| `training-program-platform-jp` | `npm run typecheck` | **エラーなし** |
| `hirayama-jyusei-strategy` | 該当テストなし（GAS / live-check は今回スコープ外） | SKIP |

### live-check-runner

`test:training` suite（`projects/training-platform/smoke.spec.ts` 等）は存在するが、
今回は Chrome CDP 9222 が未起動のため実行せず。
実機確認が必要な場合は Chrome を CDP フラグで起動後に実行する。

```powershell
npm --prefix C:\hirayama-ai-workspace\workspace\tools\live-check-runner run test:training
```

---

## Portal-12 の状態（今回は触れていない）

今回の作業は repo 復旧のみ。Portal-12 実装には入っていない。

| 項目 | 状態 |
|---|---|
| Portal-12 | PARTIAL のまま |
| JBIZ 実装 | 済み |
| `external_request` scope 認可 | 完了済み |
| 主要ブロッカー | JREC-SF01 WebApp access が `MYSELF` のため HTTP 401 |
| 次判断候補 | ① JREC-SF01 WebApp を `ANYONE_WITH_GOOGLE` に変更 / ② Sheets relay / ③ Portal-12 pause |

Portal-12 の続きは、ユーザーが明示的に指示した場合のみ着手する。

---

## Dashboard / Run_Log 反映

今回の復旧作業は「コード実装」ではなくローカル環境整備のため、
Dashboard / Task_Queue / Run_Log への反映は **不要** と判断した。

理由：
- commit ハッシュに紐づく実装変更がない
- 案件（JBIZ / JREC-SF01 等）の進捗変化がない
- 運用継続に支障がない

---

## 今後の注意点

1. **dirty 状態の早期発見**: 各 repo の sync 後は `git status -sb` で確認する習慣を維持する
2. **独立 repo 化後のファイル管理**: repo を新規 init / clone した直後に status clean を確認する
3. **旧ファイルの整理**: `hirayama-jyusei-strategy` に残っている旧 strategy docs は、
   `git rm` でインデックスから削除して commit するか現状維持かを別途判断する
4. **live-check-runner CDP**: training suite を実行する前に Chrome CDP 9222 を起動する

---

## 最終 git 状態（復旧後）

| repo | branch | HEAD | status |
|---|---|---|---|
| `workspace` | `feature/auto-dev-phase3-loop` | `35f2b5e` | clean |
| `hirayama-jyusei-strategy` | `main` | `056566c` | clean |
| `training-program-platform-jp` | `main` | `fd913cb` | clean |
| `training-trend-analyzer` | `master` | `937914f` | clean |
| `jrec-sf01-selfpay` | `main` | `df4ab2e` | clean |
| `wildboar-member-management` | `feature/wildboar-member-phase4` | `8b6f61d` | clean |
| `desktop-work-status-overlay` | `master` | `a81b0ef` | clean |
| `subsidy-grants-projects` | `main` | `35a44b9` | clean |
