# CLAUDE.md — ai-invest プロジェクト向け運用ルール

最終更新: 2026-03-10

---

## 低トークン運用ルール

### 起動時の基本手順（毎回）

1. `PROJECT_STATUS.md` を読む
2. `CLAUDE.md`（このファイル）を読む
3. `docs/SPREADSHEET_SCHEMA_COMPACT.md` を読む
4. compact schema の `schema_version` が前回と変わっていなければ **詳細資料の再読をスキップ**
5. 変更があった場合のみ `docs/sheet_design.md` へ進む

起動時は必ず以下のように短く報告する：
```
schema v1.0 / unchanged → full reread skipped
```

---

### 毎回読むファイル（原則3つのみ）

| ファイル | 役割 |
|---|---|
| `PROJECT_STATUS.md` | 現在フェーズ・次アクション・進捗ログ |
| `CLAUDE.md`（このファイル） | 運用ルール・起動手順 |
| `docs/SPREADSHEET_SCHEMA_COMPACT.md` | スプレッドシート構成の短縮版 |

---

### 詳細確認が必要な場合（例外）

以下のいずれかに該当した時のみ、`docs/sheet_design.md` や関連詳細資料を読む。

| 条件 | 対応 |
|---|---|
| ユーザーがスプレッドシートの構造変更・列追加を指示した時 | `docs/sheet_design.md` を再読 |
| `docs/SPREADSHEET_SCHEMA_COMPACT.md` の `schema_version` が更新された時 | compact schema を再読し差分を確認 |
| スプレッドシート関連ファイル（`setup_sheets.gs` 等）に差分がある時 | 対象ファイルのみ確認 |
| 実装時に列不一致・参照エラーが発生した時 | 該当シートの列定義だけ確認 |

上記以外では、compact schema の内容を正として作業を継続する。

---

### 変更があった場合の compact schema 更新手順

スプレッドシート構成を変更した時は必ず以下を行う：

1. `docs/sheet_design.md` を更新する
2. `docs/SPREADSHEET_SCHEMA_COMPACT.md` の `schema_version` をインクリメント
3. 変更箇所のみ compact schema に反映する
4. `PROJECT_STATUS.md` の進捗ログに追記する

---

## プロジェクト概要（最小版）

- **フェーズ:** Phase 1（ペーパートレード準備中）
- **Google Sheets:** https://docs.google.com/spreadsheets/d/1HLKw4huGT9f_7g5vuIsPdtJZnI61vmXZIgalNLe8HLo/edit
- **シート数:** 4（①候補管理 / ②スクリーニング記録 / ③取引記録 / ④チャート型記録）
- **ユニバース:** 16銘柄（A_内需安定〜E_金融）
- **分類:** A_内需安定 / B_IT・DX / C_製造・精密 / D_医療 / E_金融
- **主キー:** 証券コード（B列）— 銘柄の識別・重複防止はコードで行う

---

## 関連ファイル一覧

| ファイル | 内容 | 読む頻度 |
|---|---|---|
| `PROJECT_STATUS.md` | フェーズ・次アクション・進捗ログ | 毎回 |
| `CLAUDE.md` | このファイル | 毎回 |
| `docs/SPREADSHEET_SCHEMA_COMPACT.md` | シート構成短縮版 | 毎回 |
| `docs/sheet_design.md` | シート列定義・運用ルール詳細 | 変更時のみ |
| `UNIVERSE.md` | 監視銘柄リスト・選定理由 | 銘柄変更時のみ |
| `SCREENING_RULES.md` | スクリーニング条件 | ルール変更時のみ |
| `INVESTMENT_POLICY.md` | 投資方針・損切り/利確ルール | ポリシー変更時のみ |
| `setup_sheets.gs` | Googleスプレッドシート自動生成スクリプト | シート構成変更時のみ |
| `templates/create_template.py` | xlsx テンプレート生成スクリプト | テンプレート変更時のみ |
