# Workspace Remaining Review 2026-05-02

## STATUS
調査完了 / 移動・削除・退避は実施していない

---

## TARGETS
1. `C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild`
2. `C:\hirayama-ai-workspace\workspace\ai-invest`
3. `C:\hirayama-ai-workspace\workspace\msk-assessment-platform`

---

## SUMMARY_TABLE

| folder | exists | git | branch | status | remote | last substantive update | recommendation |
|---|---|---|---|---|---|---|---|
| `projects/machine-sales-rebuild` | ✓ | workspace root の一部 | feature/auto-dev-phase3-loop | clean | github.com/dabu-pi/hirayama-ai-workspace | 2026-04-05 | **KEEP**（現在地維持） |
| `ai-invest` | ✓ | workspace root の一部 | feature/auto-dev-phase3-loop | clean | 同上 | 2026-03-10 | **NEEDS_OWNER_DECISION** |
| `msk-assessment-platform` | ✓ | workspace root の一部 | feature/auto-dev-phase3-loop | clean | 同上 | 2026-03-27 | **KEEP**（稼働中シートあり） |

---

## machine-sales-rebuild

### 基本情報

| 項目 | 内容 |
|---|---|
| パス | `workspace/projects/machine-sales-rebuild/` |
| 独立 Git リポジトリ | なし（workspace root repo の一部） |
| 最終実質コミット | `d0c617a` 2026-04-05 — `docs: define production base image url rules` |
| コミット総数 | 12件 |
| git status | clean |
| プロジェクトID | なし（PROJECTS.md 未登録） |

### `projects/` ラッパーの理由

コミット `2fa6701`（2026-04-05）「refactor: move machine sales rebuild into project folder」で意図的に `projects/machine-sales-rebuild/` へ移された。
移動前は workspace 直下に `data/`, `docs/`, `scripts/` などが直置きされていたため、他プロジェクトと混在しないよう `projects/` に分離した。
`docs/PROJECT_STATUS.md` の再開手順にも `projects/machine-sales-rebuild/` のパスが記載されており、正式な運用パスとして認識済み。

### 内容

- STRONG DEPOT（中古医療機器販売サイト machine-group.net）の商品データ・WordPress画像・products.json を再構築するプロジェクト
- `data/output/` に公開商品 66件・163画像の回収済み成果物あり
- `data/seeds/` に設定マスタ CSV あり
- フロントエンドプレビュー（`frontend/public-preview/`）実装済み
- Phase 5B（実CSV全量監査・画像回収・派生画像生成）完了。次は本番 baseImageUrl の切り替え

### orchestrator / lifecycle 参照

- `ai-os/lifecycle-projects.json` に登録なし
- PROJECTS.md にプロジェクト ID（MSRB-XX 相当）は未割り当て
- scripts/ に machine-sales 参照スクリプトなし

### 退避リスク

- git-tracked ファイル多数（CSV, JSON, 設計書）。退避すると git 履歴上の実データパスが壊れる
- `docs/PROJECT_STATUS.md` の再開手順が `projects/machine-sales-rebuild/` を指している

### 判断材料まとめ

`projects/` ラッパーは意図的なリファクタリングの結果。workspace 直下への昇格は不要（かつて直下にあったものを意図的に移動済み）。
PROJECTS.md 未登録は気になるが、プロジェクトは git-tracked で実質的に管理されている。
最終更新から約 4 週間経過しているが、Phase 5B の成果物は揃っており、次フェーズ（本番切り替え）に移れる準備はできている状態。

---

## ai-invest

### 基本情報

| 項目 | 内容 |
|---|---|
| パス | `workspace/ai-invest/` |
| 独立 Git リポジトリ | なし |
| 最終実質コミット | `455bcfb` 2026-03-10 — `ai-invest: Claude低トークン運用仕組みを導入` |
| 最終 git 更新 | `2b5a0b5` 2026-04-19（共通テンプレート配布のみ、内容変更なし） |
| コミット総数 | 9件（実質 8件＋共通テンプレ 1件） |
| git status | clean |
| プロジェクトID | AINV-07 |

### 進捗状況

| フェーズ | 状態 |
|---|---|
| Phase 0（設計）| **完了** — INVESTMENT_POLICY v1.1, SCREENING_RULES v1.1, UNIVERSE v1.1 確定済み |
| Phase 1（ペーパートレード）| **未着手** — 16銘柄の初回スクリーニングが未実施 |
| Phase 2〜4 | 未着手 |

### orchestrator 参照

- `ai-os/lifecycle-projects.json` に登録なし
- `ai-os/DASHBOARD_MASTER_PLAN.md`: "AINV-07 remains a registration candidate until the Dashboard Projects row is..."（登録候補として保留中）
- `ai-os/PROJECT_STATUS.md`: `状態=構想`, `段階=構想` — 最低優先度
- PROJECTS.md: `registration_candidate / keep`

### 外部連携・稼働シート

- 稼働中の Google Sheet なし（GAS テンプレートは用意済みだが未実行）
- service_account 等の認証情報との連携なし

### 退避リスク

低い。コードなし、ライブシートなし、orchestrator 非参照。
git-tracked なので退避しても履歴は残る。ただし PROJECTS.md が `keep` 指定。

### 判断材料まとめ

**2026-03-10 以降、実質的な進捗がない（約 7-8 週間）。**
Phase 0 の設計資産（銘柄リスト・投資ルール・GAS テンプレート）は完成しているため、再開する場合はすぐ Phase 1 に入れる状態。
ただし「今後継続する意思があるか」はオーナーの判断が必要。
継続しないなら archive 候補。継続するなら PROJECTS.md に正式登録してステータスを更新するのが望ましい。

---

## msk-assessment-platform

### 基本情報

| 項目 | 内容 |
|---|---|
| パス | `workspace/msk-assessment-platform/` |
| 独立 Git リポジトリ | なし |
| 最終実質コミット | `b5c79a9` 2026-03-27 — `fix: make ns history columns idempotent` |
| 最終 git 更新 | `2b5a0b5` 2026-04-19（共通テンプレート配布のみ） |
| コミット総数 | 40件以上 |
| git status | clean |
| プロジェクトID | JASSESS-01 |

### 外部連携（重要）

| 項目 | 内容 |
|---|---|
| **稼働中 Google Sheet** | `平山接骨院_運動器初期評価システム_JASSESS-01` |
| Spreadsheet ID | `1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY` |
| Apps Script ID | `1EuUnfTRIEZ_0VYib_d8hdAE-EPRkng-ZBdwICrJDFuXX3TEKOdvyeTyK` |
| clasp 設定 | `gas/.clasp.json` あり（gitignore対象） |
| GAS ファイル | `logic_engine.js`（31KB）, `setup_sheets.js`（40KB）, `setup_neck_shoulder.js`（41KB）等 |

### PROJECTS.md 登録

PROJECTS.md §7「運動器初期評価システム JASSESS-01」として正式登録済み。
接骨院における運動器疾患評価（腰痛・頚肩こり・膝・姿勢・高齢者機能）の標準化基盤として位置づけられている。

### 進捗状況

| フェーズ | 状態 |
|---|---|
| Phase 1（腰痛評価モジュール）| TC-J01〜J10 全件 PASS、実機確認済み |
| Phase C（nsOnEdit live 発火）| 確認 PASS（manual live edit） |
| Phase 2（頚肩こりモジュール）| GAS 実装済み、Phase C 完了 |
| 実臨床テスト | 「開始可」判定済み |
| 次ステップ | Phase 1 腰痛評価の症例レビュー再開 |

### scripts/ からの参照

- `scripts/ns-live-smoke-test.mjs` — live 5パターンの smoke test
- `scripts/sync-jassess-ns-comment-master.mjs` — コメントマスタ同期
- `scripts/inspect-jassess-live-sheet.mjs` — live シート inspector
- `scripts/read_live_sheet_jassess.mjs` — live 読み取り

### 退避リスク

**高い。** 稼働中の実クリニカル Google Sheet と Apps Script が連携済み。
アーカイブすると clasp push 経路が失われ、GAS 更新不能になる。
scripts/ からの参照も複数あり、退避すると参照が壊れる。

### 判断材料まとめ

**明確に KEEP。** 稼働中の接骨院用評価システムであり、実 GAS・実シートと連携済み。
最終更新から約 5 週間経過しているが、「実臨床テスト開始可」の状態で一時休止中。
PMOD-08（知識マニュアル）とは目的・対象が異なる別プロジェクト。

---

## REFERENCES_FOUND

| 参照元 | 対象 | 内容 |
|---|---|---|
| `docs/PROJECT_STATUS.md` (line 614〜625) | `projects/machine-sales-rebuild/` | 再開手順・正本パスとして明記 |
| `ai-os/DASHBOARD_MASTER_PLAN.md` | AINV-07 | registration_candidate として保留中 |
| `ai-os/PROJECT_STATUS.md` | AINV-07 | `状態=構想`, `段階=構想` |
| `PROJECTS.md` §7 | `msk-assessment-platform/`（JASSESS-01） | 正式登録済み |
| `scripts/ns-live-smoke-test.mjs` | msk-assessment-platform / JASSESS-01 | live smoke test スクリプト |
| `scripts/sync-jassess-ns-comment-master.mjs` | msk-assessment-platform / JASSESS-01 | コメントマスタ同期 |
| `scripts/inspect-jassess-live-sheet.mjs` | msk-assessment-platform / JASSESS-01 | live シート inspector |
| `msk-assessment-platform/LIVE_SHEET_ACCESS.md` | `secrets/service_account.json` | 認証情報経路（未変更） |

---

## RISKS

| リスク | 対象 | 評価 |
|---|---|---|
| msk-assessment-platform を退避すると clasp push 経路が失われ GAS 更新不能 | msk | 高 |
| msk-assessment-platform を退避すると scripts/ の参照が壊れる | msk | 高 |
| machine-sales-rebuild を退避すると docs/PROJECT_STATUS.md の再開手順が壊れる | machine-sales | 中（git 履歴は残る） |
| ai-invest を退避するとペーパートレード設計資産が失われる | ai-invest | 低（git 履歴で復元可） |

---

## RECOMMENDATION

### `projects/machine-sales-rebuild` → **KEEP（現在地維持）**

理由:
- `projects/` ラッパーは意図的なリファクタリングの結果（2026-04-05 の明示的 refactor commit）
- `docs/PROJECT_STATUS.md` が `projects/machine-sales-rebuild/` を再開入口として指定済み
- git-tracked 実データ（CSV, JSON）が多数。workspace 直下への昇格はこれを逆行させる
- 追加推奨: PROJECTS.md へ正式プロジェクトID（例: MSRB-01）を登録するとよい

### `ai-invest` → **NEEDS_OWNER_DECISION**

判断軸:
- 継続する → PROJECTS.md のステータスを `active` に更新し、Phase 1（16銘柄スクリーニング）を着手する
- 継続しない → `_archive_workspace_cleanup_20260502/` に退避してよい（依存関係なし）
- 不明 → 現状維持でよい（ストレージへの影響は最小）

git-clean かつ依存なし。オーナー意思次第でどちらでも安全に対応可。

### `msk-assessment-platform` → **KEEP（退避禁止）**

理由:
- 稼働中の接骨院用 Google Sheet + Apps Script と連携済み
- PROJECTS.md に JASSESS-01 として正式登録済み
- scripts/ から複数の参照がある
- Phase 1 腰痛・Phase 2 頚肩こりモジュールの実機確認済み。実臨床テスト開始可の状態
- 5 週間の休止は長いが、稼働インフラは維持されておりアーカイブ候補にはならない

---

## NO_ACTION_TAKEN

今回（2026-05-02 この調査セッション）において、移動・削除・退避はいかなるフォルダーについても実施していない。
調査とレポート作成のみ。
