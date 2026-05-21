# CLAUDE.md

平山克司ワークスペースのAIアシスタント（Claude Code）向けガイド。
このファイルはClaude Codeがワークスペースを理解するための一次情報です。

> **最初に必ず読むこと:** [`CLAUDE_COMMON_PREMISE.md`](./CLAUDE_COMMON_PREMISE.md)
> 全プロジェクト共通の実行ポリシー・パフォーマンス前提・出力フォーマット。各プロジェクト直下にも同ファイルを配置済み。

---

## ワークスペースの目的

接骨院経営・設備販売・廃棄物収集業務における**手作業の自動化とAI活用**を推進する開発ワークスペース。

- 保険請求ミスをなくし、事務工数を削減する
- 見積・請求業務をAPI連携で自動化する
- 経営データをAIで分析し、意思決定を支援する

---

## ディレクトリ構造

```
workspace/
├── CLAUDE.md                        # このファイル（AI向け一次ガイド）
├── README.md                        # GitHub表示用・ナビゲーションのみ
├── PROJECTS.md                      # 全プロジェクト詳細設計
├── ROADMAP.md                       # 開発計画・タスクとステータス管理
├── SETUP.md                         # 新PCセットアップ手順
├── 慢性疼痛_管理表_STATUS.md          # 慢性疼痛プロジェクト管理表の現状・変更履歴
├── .gitignore
│
├── gas-projects/
│   └── jyu-gas-ver3.1/              # 柔整毎日記録システム（稼働中）
│       ├── Ver3_core.js             # 来院登録・区分判定・算定ロジック
│       ├── Ver3_amounts.js          # 金額計算
│       ├── Ver3_transferData.js     # 申請書データ転記
│       ├── Ver3_patientPicker.js    # 患者選択UI
│       ├── write_application.py     # 療養費支給申請書生成（ローカル実行）
│       ├── SPEC.md                  # 金額計算仕様書
│       ├── PLAN.md                  # 開発計画
│       └── TESTCASES.md             # テストケース（TC01〜TC10）
│
├── freee-automation/                # freee見積自動化（開発中）
│   ├── spec.md
│   └── src/
│       ├── freee請求書作成.js
│       ├── hawkメール自動貼り付け.js
│       └── phase3_下書き作成.js
│
├── patient-management/              # 患者管理Webアプリ（開発中）
│   ├── app.py
│   ├── requirements.txt
│   └── templates/
│
├── hirayama-jyusei-strategy/        # 接骨院経営戦略AIドキュメント
│   ├── strategy/
│   ├── menu/
│   ├── operations/
│   ├── marketing/
│   └── finance/
│
└── archive/                         # 不使用・旧バージョンの保管庫
    ├── sandbox-flask-test/
    └── jyu-gas-simple/
```

> `waste-report-system/` は **HAIKI-05（廃棄物日報システム）** として稼働準備中。ディレクトリ作成済み。詳細は §5 を参照。

---

## 各プロジェクトの役割

### 1. `gas-projects/jyu-gas-ver3.1/` — 柔整毎日記録システム

**ステータス:** 稼働中（最優先）

柔道整復師の保険請求業務を支援するGoogle Apps Scriptシステム。
スプレッドシートをUIとして、来院受付から療養費支給申請書の生成まで一貫管理する。

**重要な設計方針:**
- 算定不可の場合でも金額0・要確認フラグで記録する（自動却下しない）
- 単価は設定シートで管理し、コード内に固定値を持たない
- 令和6年6月施行の算定単価に対応済み

**算定ロジックの優先順位:** 30日ルール → 受傷日経過日数 → 区分確定 → 月上限制御 → 多部位逓減 → 長期減額

### 2. `freee-automation/` — freee見積自動化

**ステータス:** 開発中

Gmail受信メール（hawk@pop13.odn.ne.jp）を起点に、freee見積書作成・PDF下書き・スプレッドシート記録を自動化するGASシステム。
自動送信はせず、**必ず下書き状態で止める**のが原則。

### 3. `patient-management/` — 患者管理Webアプリ

**ステータス:** 開発中（プロトタイプ）

Google スプレッドシートをDBとして使うFlask製患者住所録管理アプリ。
`service_account.json` は認証情報のためリポジトリに含めない。

### 4. `hirayama-jyusei-strategy/` — 接骨院経営戦略AI

**ステータス:** ドキュメント作成済み・実装予定

慢性疼痛特化の整骨院×トレーニングジムモデルの経営戦略ドキュメント群。
Claude APIを用いた分析・提案自動生成の実装が次フェーズ。

### 5. `waste-report-system/` — 廃棄物日報システム

**ステータス:** active_setup_pending（HAIKI-05）

廃棄物収集業務の日報・月報を自動化するシステム。ディレクトリ作成済み・Google Drive 連携設定中。
`ai-os/lifecycle-projects.json` で HAIKI-05 として登録済み。

---

## workspace と claude-sandbox の運用ルール

このワークスペースは2つのディレクトリで構成されている。Claudeはどちらで作業するかを常に明確にする。

```
C:\hirayama-ai-workspace\
├── workspace\        ← 本番開発（このリポジトリ）
└── claude-sandbox\   ← 実験・プロトタイプ専用（別リポジトリ）
```

### 3台PC共通の運用方針（2026-03-07 決定）

| 項目 | 方針 |
|---|---|
| 通常作業フォルダ | `C:\hirayama-ai-workspace\workspace`（3台統一） |
| 通常作業スコープ | `workspace` 配下のみ。`sandbox`・`logs` は必要時に明示して扱う |
| 常用ブランチ | `feature/auto-dev-phase3-loop`（master ではなくこちらを使う） |
| 他PCの適用 | 次回使用時に同じ方針へそろえる |

> 正本・作業場所・commit / push は `C:\hirayama-ai-workspace\workspace` のみ。root では Git 作業しない。

> **【2026-05-02 追記】root git の remote 削除済み:**
> `C:\hirayama-ai-workspace`（root）の git remote は削除した。
> root と workspace が同一 GitHub remote を向いており、root からの誤 push で
> workspace 最新作業が上書きされるリスクがあったため。
> root はローカル専用メタ管理 repo になった。commit / push / pull は workspace のみ。

### 作業開始前の必須確認（Claude Code 向け・2026-05-02 追加）

**すべての git 作業を開始する前に、以下を必ず確認すること:**

| 確認項目 | 正しい値 | NG の場合 |
|---|---|---|
| `git rev-parse --show-toplevel` | `C:/hirayama-ai-workspace/workspace` | **作業停止** |
| `git remote -v` | `origin → .../hirayama-ai-workspace.git` が表示される | **作業停止** |
| root での git 操作 | 禁止（remote 削除済み） | 絶対にしない |

PowerShell での作業パターン（推奨）:
```powershell
$repo = "C:\hirayama-ai-workspace\workspace"
& git -C $repo rev-parse --show-toplevel
& git -C $repo remote -v
& git -C $repo branch --show-current
& git -C $repo status
```

Bash ツールを使う場合は毎回 workspace パスを指定してから作業する。

### Multi-Claude / Single Writer Rule（2026-05-13 追加）

> 2026-05-13 Portal-12 仕上げ作業で、複数 Claude セッションが同じ JBIZ repo / Apps Script project / live-check-runner / auth.json に並行で書き込み、`gas/portal-gateway-v1.gs` と `scripts/portal-gateway-v1.gs` の 45 行 SHA mismatch が発生。詳細・採用ルール: [`hirayama-jyusei-strategy/docs/MULTI_CLAUDE_OPERATION_2026-05-13.md`](./hirayama-jyusei-strategy/docs/MULTI_CLAUDE_OPERATION_2026-05-13.md)

**JBIZ Portal / GAS deploy / live-check-runner / Apps Script 認可 / 共通管理表書き込みは single writer 運用**。複数 Claude を起動する場合、作業開始前に必ず以下を確認し、競合が見つかれば編集・commit・push・deploy を開始しない。

#### 作業開始時チェック（必須・スキップしない）

```powershell
# 並行 Claude / 関連プロセス
Get-Process | Where-Object {
  $_.ProcessName -match 'claude|node|npm|npx|tsx|playwright|chrome|clasp|git'
} | Select-Object Id, ProcessName, StartTime | Sort-Object StartTime | Format-Table -AutoSize

# 3 repo の git status
foreach ($r in @(
  'C:\hirayama-ai-workspace\workspace',
  'C:\hirayama-ai-workspace\workspace\hirayama-jyusei-strategy',
  'C:\hirayama-ai-workspace\workspace\gas-projects\jrec-sf01-selfpay'
)) {
  Write-Host "--- $r ---"
  git -C $r status -sb
}

# Chrome CDP 9222
Test-NetConnection localhost -Port 9222 -InformationLevel Quiet
```

#### 並行禁止項目（必ず直列）

| 項目 | 理由 |
|---|---|
| 同一 Apps Script project への `clasp push` / `clasp deploy` | last-writer-wins。deployment 順序が壊れる |
| Apps Script editor からの scope 認可（人間操作含む）| 認可中の clasp / verify はタイミング次第で失敗 |
| `tools/live-check-runner/` の編集（spec / scripts / package.json / config.json）| playwright 共有資源 |
| `tools/live-check-runner/auth.json` 更新 | storageState の上書きで他セッションの verify が即 fail |
| Chrome CDP port 9222 使用 / `.chrome-cdp-profile` | OS リソース / 同時 1 プロセス占有 |
| `gas/portal-gateway-v1.gs` ↔ `scripts/portal-gateway-v1.gs` のミラー編集 | 同一 commit で同期しないと SHA mismatch |
| 共通管理表（Run_Log / Task_Queue / Business_Links / Dashboard）への書き込み | 同時 `setupPortalN` で重複行や順序不整合 |
| 大型 Markdown（`PROJECT_STATUS.md` / `ROADMAP.md` / `NEXT_ACTIONS.md`）への並行追記 | merge 不可能 |

#### gas/ / scripts/ ミラー運用（JBIZ 限定）

JBIZ の `hirayama-jyusei-strategy/gas/portal-gateway-v1.gs` は clasp 正本。`scripts/portal-gateway-v1.gs` は参照ミラー。

- 編集は `gas/` 側のみ
- 編集したら必ず同セッション内で `Copy-Item gas\portal-gateway-v1.gs scripts\portal-gateway-v1.gs -Force`
- `Get-FileHash` で SHA256 一致を確認してから commit
- 両方を同一 commit に含める

#### clasp deploy ルール

- 1 セッション内で `clasp push --force` → `clasp deploy` を完結
- bookmark URL を維持する場合は `clasp deploy --deploymentId <既存ID>`
- 並行 Claude が同一 scriptId に deploy していないことを確認してから開始
- `clasp deploy` 実行後は `clasp deployments` で実際の version / deploymentId を確認（想定値で記録しない）

#### Apps Script scope 認可運用

- 新 scope 追加時は try/catch なしの専用 grant 関数を 1 個追加（例: `grantPortal12ExternalRequest`）
- ユーザーに GAS エディタで 1 回実行を依頼 → スコープ同意ダイアログで「許可」
- 認可中は他 Claude の clasp / verify を全停止
- 認可後は新規 `clasp deploy` で deployment auth bundle に scope を反映

#### live-check-runner 運用

- `auth.json` 更新は workspace single writer
- 更新中は他 Claude の `npm run test:*` を全停止
- Chrome CDP は `Get-Process chrome | Stop-Process -Force` → flag 付きで 1 個起動 → save-auth の順
- Chrome を完全終了せず flag 付きで起動しても、既存セッションが flag を上書きしないので CDP は無効になる

#### 完了条件（CLOSED とは）

JBIZ Portal / GAS / Dashboard / live-check-runner 作業は以下を全て満たすまで完了としない。

- 実装完了
- live-check-runner 検証完了（PASS / FAIL / BLOCKED を正確に記録）
- Markdown 記録完了（PROJECT_STATUS / NEXT_ACTIONS / ROADMAP / docs）
- Dashboard / Task_Queue / Run_Log 反映完了
- gas/ ↔ scripts/ SHA256 一致
- commit / push 完了
- 3 repo すべて clean（`git status -sb` で 0 ahead / 0 behind / dirty なし）
- handoff 報告完了

中途半端な dirty / 未 push / auth 期限切れ / SHA mismatch のまま完了報告しない。

#### Portal Link Audit ルール（2026-05-21 追加）

> **背景**: 2026-05-21 の棚卸しで、JBIZ Portal の JREC-SF01 リンクが旧 deploymentId (@83) を向いており、
> R-2M〜R-2T の修正済み機能が Portal から開けない状態が長期放置されていた。
> 詳細: [`hirayama-jyusei-strategy/docs/PORTAL_LINK_AUDIT_JREC_2026-05-21.md`](./hirayama-jyusei-strategy/docs/PORTAL_LINK_AUDIT_JREC_2026-05-21.md)

**平山ビジネスポータルは各事業アプリへの正本入口である。**

JREC-SF01 / JBIZ / Wildboar / JYU-GAS / その他関連事業アプリを **deploy した場合は、deploy だけで完了としない**。必ず同一フェーズ内で以下を確認・更新すること。

| 確認項目 | 確認方法 |
|---|---|
| 平山ビジネスポータルの nav リンクが最新 deploymentId を向いているか | JBIZ Portal `gas/portal-gateway-v1.gs` `buildNavigation_` 内の fallback URL を確認 |
| `Business_Links` の `primary_url` が最新か | `seedBusinessLinks_` 関数内の URL を確認 |
| 各事業詳細ページのクイックリンクが最新か | `buildSelfpayBusinessDetail_` 等の関数内を確認 |
| 古い deploymentId が本番導線に残っていないか | `grep -r "AKfycb" gas/` で全 URL を列挙して確認 |
| `/dev` URL が本番リンクに混入していないか | 同上 |
| 古い `page` parameter を開いていないか | 最新の page parameter 一覧と照合 |

**JREC-SF01 で確認対象にする page parameter（2026-05-21 @100 時点）:**

| page | 機能 |
|---|---|
| `?page=home` | ホーム（予約状況カード付き / R-2M）|
| `?page=reservation` | 公開予約ページ（院名・案内文 / R-2S）|
| `?page=reservationAdmin` | 予約管理（カレンダー表示・Cal再作成 / R-2R・R-2M）|
| `?page=reservationQrNotice` | 院内QR掲示印刷（R-2T）|

**deploy 後の完了条件にこれを追加する:**

1. 対象アプリの clasp push / deploy 完了
2. JBIZ Portal の関連リンク確認（上表）
3. 必要なリンク更新 + gas/ ↔ scripts/ SHA256 一致 + deploy
4. curl smoke / live-check-runner / Playwright で確認
5. Markdown 記録（docs / PROJECT_STATUS / ROADMAP）
6. commit / push / clean / ahead-behind 0/0

#### 並行可能 / 不可の早見表

| 状況 | 並行可否 |
|---|---|
| 別 repo の独立タスク（wildboar / training-platform 等で deploy target / Spreadsheet / live-check-runner 完全分離）| ✅ 並行可 |
| 完全 read-only 調査 | ✅ 並行可 |
| 同じ Markdown に追記しない docs 専用作業 | △ 条件付き |
| 同一 Apps Script project への push/deploy / 同一 GAS ファイル編集 | ❌ 直列のみ |
| JREC-SF01 endpoint 修正 + JBIZ Portal 接続 | ❌ 直列のみ（連携時のみ） |
| 同じ Spreadsheet を編集する setup action | ❌ 直列のみ |

### Git dirty / missing tracked files 防止ルール（2026-05-14 追加）

> 2026-05-14 / workspace 11 repo の同期作業で、`gas-projects/jyu-gas-ver3.1` と `hirayama-jyusei-strategy` の計 24 ファイルが
> **HEAD には tracked だが disk から欠損** という状態で長期間放置されていたことが判明（毎日 `git status` が dirty を返す原因）。
> JYU-GAS 側は `clasp push` 実行で GAS production code を削除する危険状態だった。
> 詳細・根本原因分析: [`docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md`](./docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md)

**Git の clean 判定は 2 系統チェック必須**。`git status --porcelain=v1` だけで判断しない。
必ず `git ls-files -d`（HEAD に tracked だが disk に存在しないファイル）も 0 件であることを確認する。

#### 作業開始時・commit 前・clasp push/deploy 前・PC 切替前に必ず実行

```powershell
cd C:\hirayama-ai-workspace\workspace
.\tools\git-health-check.ps1
```

非破壊（branch checkout なし）に 11 repo を `update-index --refresh` → `status --porcelain=v1` → `ls-files -d` → ahead/behind の順で監査する。
1 件でも issue があれば exit 1。

#### missing tracked が出た場合の手順

1. **即 `git reset --hard` / `git clean -fd` をしない**（原因不明のまま消すのは禁止）
2. `git ls-files -d` で対象ファイルを確認し、HEAD の内容と現行コードの参照を `git show HEAD:<file>` / `git grep` で調査
3. 以下のいずれかを判断:
   - **現行運用に必要** → `git checkout -- <file>` で復元
   - **明確に不要（旧構造）** → `docs/legacy/<phase>/` へ `git mv` で退避（**即 `git rm` 禁止**。経営戦略・KPI・コード本体は再参照価値あり）
   - **完全に不要かつ履歴も残らない** → `git rm` + commit
4. 判断根拠・対応内容を Markdown に記録してから commit / push

#### ファイル削除の運用ルール

| シナリオ | 正しい手順 |
|---|---|
| 不要ファイルを削除する | `git rm <file>` + commit + push まで完結。disk 削除のみで止めない |
| 旧バージョン文書を整理する | `git mv` で `docs/legacy/<phase>/` へ退避（履歴保持） |
| ファイルが既に disk から消えていて HEAD に残っている | 上記「missing tracked が出た場合の手順」に従う |

#### clasp push / clasp deploy 前の必須ゲート

```powershell
cd C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1  # または対象 repo
git update-index -q --refresh
git ls-files -d
```

`git ls-files -d` が 1 行でも出力した場合、**clasp push / clasp deploy を絶対に実行しない**。
clasp は disk 上のファイルを正本として GAS に同期するため、disk から欠損したファイルは GAS 上の対応ファイルを削除する。

#### branch sync の運用

- 通常の sync / audit では他 branch を checkout しない（現 branch の pull のみ）
- 他 branch の中身を見たい場合は `git worktree add` または一時 clone で別ディレクトリに展開
- `tools/git-health-check.ps1` は branch checkout を行わない設計（11 repo の現 branch のみを監査）

#### Source of truth ルール

| repo | 正本 |
|---|---|
| すべて | GitHub `dabu-pi/<repo>` の current branch |
| JYU-GAS（`gas-projects/jyu-gas-ver3.1`）| GitHub main。clasp deploy（`@N`）は派生物 |
| JBIZ（`hirayama-jyusei-strategy`）| GitHub main。Apps Script project は派生物。`gas/portal-gateway-v1.gs` ↔ `scripts/portal-gateway-v1.gs` は **同一 commit で同期** |

clasp / GAS editor の現状とローカル disk / GitHub が乖離した場合は **GitHub を信用** する。

### workspace（本番）で行うこと

- プロジェクトのソースコード実装・修正
- ドキュメントの更新（CLAUDE.md / PROJECTS.md / ROADMAP.md 等）
- 仕様が固まった機能の実装
- commit & push まで実施する

### claude-sandbox（実験）で行うこと

- 新技術・新APIの動作確認
- 仕様が未確定のプロトタイプ
- workspace に影響を与えたくない試行錯誤
- **commit は任意。push 不要**

### 判断基準

| 状況 | 作業場所 |
|---|---|
| 既存プロジェクトのバグ修正・機能追加 | `workspace/` |
| 「試しにやってみる」「動くか確認する」 | `claude-sandbox/` |
| claude-sandbox で動作確認済みのコードを本番化 | `workspace/` に移植 |
| 仕様が不明・要件が曖昧 | 先に質問。claude-sandbox で試作後に本番化 |

---

## Claudeへの行動指針

### 毎日の作業ルール（人間がやること）

| タイミング | コマンド |
|---|---|
| 作業開始 | `ds`（git pull + 状態確認） |
| 作業終了（案件明示） | `de -ProjectId JREC-01 "説明"`（commit + push + Projects 最小同期） |
| 作業終了（案件なし） | `de "説明"`（commit + push のみ） |
| PC切替前 WIP 保存 | `de "WIP: 途中状態の説明"`（別 PC で再開できるように push まで実施） |
| push せず一時保存 | `de -NoPush "説明"` |

> **注意:** `ds` / `de` は PowerShell 用ショートカット。Claude Code / Claude Desktop の会話欄に入力してもコマンドとしては実行されない。

> **WIP commit について:** 途中状態でも別PCで再開できる価値がある変更は `de` で push まで行う。壊れた状態・機密情報を含む場合のみ push を保留する。

### 判断基準

- **仕様が不明な場合は実装せず、質問してから進める**
- GASコードはローカル実行不可。テストは `TESTCASES.md` のケースをもとにコードレビューで行い、スプレッドシート上の動作確認は人間が行う
- **preview（devサーバー）不要・clasp push は即実行**: `gas-projects/` 配下はブラウザプレビュー不要。GASコードを変更したら確認・停止なしで `clasp push` まで実施して完了とする。Stop hook が「dev server が動いていない」と警告しても**無視して続行**すること。`.claude/settings.json` で `disableAllHooks: true` を設定済み（Claude Code 内部の preview Stop hook を無効化するため）
- freee API の仕様は `freee-automation/spec.md` を参照し、エンドポイントを推測で実装しない
- 認証情報ファイルが必要な場合は「このパスに配置してください」と指示するにとどめ、内容を生成・提案しない

### やってはいけないこと

| 禁止事項 | 理由 |
|---|---|
| freee APIへの本番POST自動実行 | 下書き確認ステップが必須 |
| Gmail・メールの自動送信 | 不可逆操作 |
| `_backup/` への新規ファイル追加 | gitが代替。不要 |
| 単価・料金のコード内ハードコード | 設定シートで一元管理 |
| `service_account.json` 等の認証情報を生成・コミット | 絶対禁止 |
| OneDriveフォルダ内での作業・ファイル保存 | 同期競合の原因になる |

---

## 開発ルール

### セキュリティ

- `.env`、`service_account.json`、`credentials.json`、`token.json` は**絶対にコミットしない**
- 認証情報は `.gitignore` で除外済み
- freee OAuth2トークンも同様に管理する

### コーディング

- GASファイル（`.js`）はclasp経由でスプレッドシートプロジェクトと同期する
- 単価・定数はコード内にハードコードせず、スプレッドシートの設定シートから取得する
- 自動送信・自動削除などの**不可逆操作は実装しない**（必ず確認ステップを挟む）

### 作業開始前の必須確認（スプレッドシート案件）

スプレッドシートに関わる作業を開始する前に、必ず以下を順番に実施すること。

| 手順 | 確認項目 | 内容 |
|---|---|---|
| 1 | 最新ブランチ確認 | `git pull` で最新状態に同期。ブランチ: `feature/auto-dev-phase3-loop` |
| 2 | CLAUDE.md 読み込み | 本ファイルのルール・設計方針を確認 |
| 3 | README_SHEETS.md 読み込み | `hirayama-jyusei-strategy/README_SHEETS.md` でシート構造・操作ルールを確認 |
| 4 | SHEET_DESIGN.md 読み込み | `hirayama-jyusei-strategy/SHEET_DESIGN.md` で列設計・数式設計を確認 |
| 5 | STATUS.md 読み込み | 該当案件の `*_STATUS.md`（ルート直下）で現状・差分・未解決論点を確認 |
| 6 | 対象シートの現物確認 | 列構成・注意書き・数式・入力規則が docs と一致しているか確認 |
| 7 | 差分解消 | docs と現物に差分があれば、本作業の前に STATUS.md へ反映して commit してから進む |

### 作業終了後の必須同期（スプレッドシート案件）

スプレッドシートを変更した同一セッション内で必ず以下を行うこと。

| 手順 | 内容 |
|---|---|
| 1. STATUS.md 更新 | 列定義・数式・変更内容・整合状態を記録する |
| 2. 他 md 更新 | 運用ルール変更なら CLAUDE.md、算定ロジック変更なら SPEC.md も更新 |
| 3. commit | 仕様ファイルの更新をコミットする |
| 4. push | GitHub に反映する |
| 5. 整合状態報告 | 完了報告テンプレ（下記）で整合状態を報告する |

### スプレッドシート完了報告テンプレ

スプレッドシートに関わる作業の完了時は、必ず以下のフォーマットで報告すること。

```
【作業開始前 Sheets確認】済 / 未
【確認した対象シート名】
【作業前差分】あり（内容: ） / なし
【反映した Sheets差分】
【変更したシート名】
【変更した列】追加: / 変更: / 削除: / 移動:
【数式変更】あり（内容: ） / なし
【入力規則変更】あり / なし
【注意書き変更】あり / なし
【更新した md ファイル名】
【最終整合状態】Sheets / docs 整合済み / 未整合（理由: ）
```

### STATUS系md の配置ルール

| ルール | 内容 |
|---|---|
| 配置場所 | ワークスペースルート（`workspace/`）直下に `{案件名}_STATUS.md` の形式で作成 |
| 命名規則 | `慢性疼痛_管理表_STATUS.md` のように案件名を日本語で明示する |
| 参照先 | CLAUDE.md の慢性疼痛管理表セクション・README.md のドキュメント表に記載する |
| 更新タイミング | Sheets 変更と同一セッションで必ず更新・commit する |
| 他PCからの参照 | GitHub の `feature/auto-dev-phase3-loop` ブランチから取得できる |

### スプレッドシート構造変更ルール

スプレッドシート（Google Sheets）の列構成・シート追加・数式設計・入力規則・注意書きを変更するときは、必ず以下を行う。

> 説明文・注釈・更新メモ追記は [`docs/SHEET_NOTES_STANDARD.md`](./docs/SHEET_NOTES_STANDARD.md) を優先し、`common engine + config + 薄い wrapper` 方式で実施すること。

**実施者ルール:**

| ルール | 内容 |
|---|---|
| Claude Code が実施する | 列追加・数式変更・入力規則・注意書き変更は原則 Claude Code が実施する（GAS経由またはユーザーへの手順提示） |
| ユーザー手動変更の場合 | 手動でシートを変更した場合も、次の Claude Code セッションで必ずローカル文書へ反映する |
| 差分があるまま進まない | Sheets とローカル文書に差分があるまま次タスクへ進まない |

**同一セッション内で必ず行う手順:**

| 手順 | 内容 |
|---|---|
| 1. Sheets変更 | 列構成・数式・入力規則・注意書きを変更する |
| 2. STATUS.md更新 | `慢性疼痛_管理表_STATUS.md`（または該当仕様ファイル）の列定義・数式を更新する |
| 3. CLAUDE.md更新 | 運用ルール変更が生じた場合のみ更新する |
| 4. SPEC.md更新 | 算定ロジック変更が生じた場合のみ更新する |
| 5. commit & push | 仕様ファイルの更新を必ずコミットしてGitHubに反映する |

**完了報告に必ず含める項目:**

- 変更したシート名
- 変更した列（追加・変更・削除・移動）
- 数式変更の有無と内容
- 入力規則変更の有無
- 注意書き変更の有無
- 更新した mdファイル名
- Sheetsとローカル文書の整合状態（整合済み / 未整合の場合は理由）

> **理由：** データ正本はSheets（運用実態）、構造仕様正本はローカルファイル（変更管理・他PC再現・ChatGPT連携）として分離管理するため。Sheetsだけ変えてローカルに記録しないと、次回再開時に構造が不明になる。

### ファイル管理

- 不要になったファイルはすぐ削除せず `archive/` に移動する
- `_backup/` フォルダはgitが代替するため新規作成・追加不可
- 実験・テスト用コードは本番ディレクトリに混在させず `claude-sandbox/` を使う

### Git運用

- **`git push` / `clasp push` は確認なしで実行してよい**（`~/.claude/settings.json` ユーザー共通設定で `allow` 済み。3台のPCすべてに適用すること → SETUP.md 参照）
- **通常作業ブランチは `feature/auto-dev-phase3-loop`** とする。新しいPCで作業を始めるときは `git checkout feature/auto-dev-phase3-loop` → `ds` の順で実行する。
- **Claude Codeは作業完了後、基本的に `de` でcommitとpushまで行う**
- 人間がやること: 作業開始 → `ds`、作業終了 → `de -ProjectId <id> "説明"`（これだけ）
- コミット前に認証情報が含まれていないか確認する（`gsc` / `de` が自動チェック）
- `venv/`、`__pycache__/`、ログファイルはコミットしない
- コミットメッセージは変更内容が明確にわかる日本語または英語で記述する

### de コマンド — workspace 全プロジェクト共通の終了コマンド

`de` は AIOS-06 専用ではなく、**workspace 全体で使う全プロジェクト共通の handoff コマンド**である。

```
de -ProjectId <project_id> "メッセージ"
```

**de が担う処理（この順で実行）:**

| ステップ | 内容 | 条件 |
|---|---|---|
| 1. cleanup | Task_Queue の known incomplete row を削除 | `-AutoCleanupKnownTaskQueueRow` 指定時 |
| 2. commit | `gsc`（git-safe-commit）経由で認証情報チェック + commit | 常時 |
| 3. push | GitHub に push | `-NoPush` なし |
| 4. Run_Log JSON/TSV | ローカルに `logs/runlog/` へ出力 | 常時 |
| 5. Run_Log シート追記 | Dashboard の `Run_Log` シートへ直接書き込み | env vars 設定済み時 |
| 6. Projects 最小同期 | `次アクション` / `最終更新日` / `補足` の 3列を更新 | ステップ5 成功 + `-ProjectId` 指定時 |

**Projects シートへの同期ルール:**

| 条件 | 動作 |
|---|---|
| `-ProjectId` に既存案件 ID を指定 | `Projects` シートの該当行の 3 列のみ上書き |
| `-ProjectId` 未指定 | 同期スキップ（commit / push は通常通り実施） |
| 未登録 project_id を指定 | `[WARN] Skip: no auto-append`（行の自動追加はしない） |
| `-Result SUCCESS` 以外 | 同期スキップ |

**`Projects` シートは全案件台帳の正本（single source of truth）**
URL・状態・段階などの固定情報は手動で管理し、`de` は `次アクション` / `最終更新日` / `補足` の 3 列だけを最小更新する。

**1コマンド完結（ステップ 5〜6 を含む）には環境変数の設定が必要:**

```
AIOS_DASHBOARD_SPREADSHEET_ID=<スプレッドシートID>
AIOS_SERVICE_ACCOUNT_PATH=<サービスアカウントJSONパス>
```

環境変数が未設定の場合、ステップ 1〜4 は通常通り動作し、ステップ 5〜6 はスキップされる（エラーにならない）。その場合は `append-runlog-to-sheet.mjs` + `sync-project-from-runlog.mjs` を別途実行する。

**別 PC での再開を前提とした WIP push:**
途中状態でも別PCで再開できる価値のある変更は `de` で push まで行う。
PC 切り替え前に `git status` / ブランチ / 未 push 有無を必ず確認する。

### GitHub同期ルール（ChatGPT連携前提）

Claude Code で実施した変更は、原則として **commit 後に push まで行う**こと。
本環境では、ChatGPT が GitHub 上の最新状態を確認し、設計・進捗・再開判断の整合を取る運用を前提とする。
**GitHub を Claude Code / ChatGPT / 人間の共通参照元（single source of truth）として扱う。**

#### 基本手順

作業完了時は以下を基本手順とする。

1. 変更内容を要約する
2. commit する
3. push する
4. 以下を報告する
   - ブランチ名
   - コミットID
   - 変更ファイル
   - 実施内容の要約
   - 未完了事項の有無

#### push しない例外

以下の場合に限り、commit 後に push せずローカル保持を許可する。

| 例外条件 | 内容 |
|---|---|
| 機密情報を含む可能性 | `.env`・認証情報・秘密鍵等が含まれる恐れがある場合 |
| 壊れた途中状態 | 明らかに未完成で共有に適さない状態 |
| 危険性が高い未テストコード | 誤認を招く可能性がある場合 |
| 一時退避目的のコミット | push 不要な仮保存のみ |
| ユーザーの明示的な指示 | 「pushしない」と明示された場合 |

例外時は必ず以下を報告・記録すること:push しない理由 / 現在の状態 / 残っているリスク / push 可能にするための次の確認項目

#### 作業完了時の報告必須フォーマット

```
STATUS: 完了 / 継続中 / 保留
BRANCH: 現在のブランチ名
COMMIT: コミットID
PUSH:   実施済み / 未実施（理由: ）
SUMMARY: 変更要約
NEXT:   次の作業
RISKS:  未解決事項（あれば）
```

---

## 技術スタック

| 技術 | 用途 |
|---|---|
| Google Apps Script | スプレッドシート・Gmail自動化 |
| Python (Flask) | Webアプリ・申請書生成 |
| freee API (OAuth2) | 見積・請求書作成 |
| Claude API (claude-sonnet-4-6) | AI分析・文書生成 |
| clasp | GASのバージョン管理 |
| gspread | PythonからGoogle Sheets操作 |

---

## 参照ドキュメント

| ドキュメント | 内容 |
|---|---|
| [PROJECTS.md](./PROJECTS.md) | 全プロジェクトの詳細設計・仕様 |
| [ROADMAP.md](./ROADMAP.md) | 開発計画・タスクとステータス |
| [SETUP.md](./SETUP.md) | 新PCセットアップ手順 |
| [慢性疼痛_管理表_STATUS.md](./慢性疼痛_管理表_STATUS.md) | 慢性疼痛プロジェクト管理表の現状・変更履歴・再開キュー |
| [gas-projects/jyu-gas-ver3.1/SPEC.md](./gas-projects/jyu-gas-ver3.1/SPEC.md) | 柔整金額計算仕様 |
| [freee-automation/spec.md](./freee-automation/spec.md) | freee自動化仕様 |

---

## 慢性疼痛強化プロジェクト2026 — 管理表固定ルール

> **この案件を再開するときは、最初に [`慢性疼痛_管理表_STATUS.md`](./慢性疼痛_管理表_STATUS.md) を読むこと。**
> スプレッドシート実物は必要なときだけ確認する。

### 案件識別情報

| 項目 | 内容 |
|---|---|
| 正式名称 | 慢性疼痛強化プロジェクト2026 |
| 管理表URL | https://docs.google.com/spreadsheets/d/1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc/edit |
| スプレッドシートID | `1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc` |
| 位置づけ | このスプレッドシートが「慢性疼痛強化プロジェクト2026」の正本（single source of truth） |
| 現状記録 | `慢性疼痛_管理表_STATUS.md`（日々の変更・現状はここを読む） |

### プロジェクト目的

接骨院×ジム併設モデルの収益強化。感覚ではなく数字で判断する。

| 目標 | 内容 |
|---|---|
| 疾患特化 | 慢性腰痛・首肩こりに集中 |
| 導線設計 | 治療 → 再発予防 → ジム誘導 |
| 売上目標 | 月自費 +20万円以上 |
| 投資回収 | 機器投資を1年以内に回収 |
| 判断軸 | 利益・再発予防導線・投資回収を最優先とし、感覚ではなく数字で判断する |

### スプレッドシート修正方針

| 方針 | 内容 |
|---|---|
| 既存シート保護 | 既存シートはなるべく壊さない。行列の大きな追加・削除は原則禁止 |
| 構造変更 | 大きな構造変更は補助シート追加で対応する |
| 表記 | 日本語表記中心。セルラベルは略称を避け意味が明確な名称にする |
| 価格変更耐性 | 単価・料金はシナリオセルに集約し、修正1箇所で全体に反映される構造を優先 |
| 仮数字運用 | 実績がない間は仮数字で運用。後で実績に差し替えやすい構造を維持する |
| 入力規則 | 黄色セル＝手入力 / 水色セル＝採用値（計算式参照）/ グレー＝自動計算 |

### 再開手順（この案件専用）

1. **必ず読む（毎回）:** `慢性疼痛_管理表_STATUS.md` → 現状把握・未解決論点確認
2. **次回確認点を見る:** STATUS の「次回再開時に最初に確認すべき点」セクション
3. **必要なときだけ:** スプレッドシート実物を開いて前回変更箇所を確認
4. **GAS修正の場合:** Apps Script エディタに注入して実行（ローカル実行不可）
5. **作業後:** STATUS.md の「今日までに実施した修正」と「現在の数値前提」を更新し commit / push

### 作業報告ルール（この案件専用）

作業完了時に以下を必ず報告する：

```
【変更したシート】例: 保険・来院前提、KPI目標
【主な数式変更】例: B26=IFERROR(B21*B8,"要確認")
【ユーザー入力欄】例: C17（総保険売上単価）を実績値に更新してください
【commit hash】xxxxxxx
【push】実施済み / 未実施（理由: ）
```

> 上記報告とあわせて、`慢性疼痛_管理表_STATUS.md` の変更履歴・数値前提・未解決論点を必ず更新すること。

### Google Drive handoff

- GitHub / `workspace` を正本とし、Google Drive は参照・検索・共有・バックアップ用途として使う。
- Google Drive for desktop の常駐同期は前提にしない。
- `workspace-export` は upload 用の guarded export として扱い、Drive 側コピーや `workspace-export` 側では Git 作業をしない。
- `de` は push 成功後に `scripts/sync-workspace-to-drive.ps1` で export を更新し、その後 `scripts/upload-workspace-export-to-gdrive.ps1` で rclone upload を試行する。
- 通常運用の既定は `sync`。ただし初回確認や新しい remote path の安全確認は `-Mode copy` を先に使う。
- rclone や remote 設定が未完でも、GitHub 正本 handoff は止めない。警告と `logs/gdrive-upload/` を確認する。
- export と upload をまとめて止める場合は `de -SkipDriveSync`、export は維持して upload だけ止める場合は `de -SkipGDriveUpload` を使う。
- Drive 側の入口は `workspace-export\INDEX.md`。詳細運用は `docs/GOOGLE_DRIVE_SYNC.md` を正本とする。
