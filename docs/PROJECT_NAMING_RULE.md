# PROJECT_NAMING_RULE.md

最終更新: 2026-03-13
ステータス: Official

> この文書を `project_id` / `project_name` / `main_sheet_name` / `local_folder` の命名ルールの正本として扱う。
> 実システムへの反映は別フェーズで行い、今回はルール確定のみを扱う。

---

## 目的

`project_id` / `project_name` / `main_sheet_name` / `local_folder` の命名原則を
1本の文書として整理し、今後の実変更フェーズで判断基準のぶれを防ぐ。

この文書では命名ルールを正式基準として定義するが、**今回はコード・sheet・folder・live data を変更しない。**

---

## 適用範囲

- AI OS Dashboard の `Projects` 管理
- workspace 内の各案件の識別
- 今後の `project_id` 移行設計
- `project_name` と `main_sheet_name` と `local_folder` の役割分担の明確化

---

## 命名原則

### 1. project_id

- `project_id` は **mnemonic な固定IDとすることを原則** とする
- 形式は `PREFIX-NN` を基本とする
- `PREFIX` は英大文字で、案件の**業務名・役割**が連想できる略称を優先する
- 技術名ベースの略称は避け、できるだけ業務名ベースに寄せる
- 一度確定した `project_id` は固定で使い続ける
- 既存参照が広いため、変更は通常運用ではなく別フェーズの一括移行で扱う

### 2. project_name

- `project_name` は **業務名ベースの正規表示名とすることを原則** とする
- 人が見て意味がわかることを優先する
- 可能な限り技術名を含めない
- `project_id` の mnemonic と意味が揃う名称を採用する
- ダッシュボード、文書、会話での基準名として扱う

### 3. main_sheet_name

- `main_sheet_name` は **実務上の正式名を尊重することを原則** とする
- 現場運用上すでに使われている名称は無理に一般化しない
- `project_name` と完全一致である必要はない
- ただし将来新設する場合は、できるだけ `project_name` と関係がわかる名称に寄せる

### 4. local_folder

- `local_folder` は **当面は既存運用優先で据え置くことを推奨** とする
- フォルダ名変更は影響範囲が大きいため、命名整理と同時には行わない
- 変更が必要な場合は別フェーズで扱う
- 現段階では「現行の正規パス」を記録対象とする

---

## 役割分担

| 項目 | 役割 | 命名方針 |
|---|---|---|
| `project_id` | 固定識別子 | 原則: mnemonic な略称 + 連番 |
| `project_name` | 正規表示名 | 原則: 業務名ベース |
| `main_sheet_name` | 実務上の正式名 | 原則: 現場名称を尊重 |
| `local_folder` | ローカル作業パス | 当面の推奨: 既存運用優先で据え置き |

---

## 正式基準表

以下を現時点の正式基準表とする。

| project_id | project_name | main_sheet_name | local_folder |
|---|---|---|---|
| `JREC-01` | 柔整毎日記録システム | `【毎日記録】来店管理施術録ver3.1` | `workspace/gas-projects/jyu-gas-ver3.1` |
| `FREEE-02` | freee見積自動化 | `2024長谷川さん管理シート` | `workspace/freee-automation` |
| `JWEB-03` | 患者管理Webアプリ | `整骨院 電子カルテ` | `workspace/patient-management` |
| `JBIZ-04` | 接骨院経営戦略AI | `平山接骨院 慢性疼痛強化プロジェクト 管理表` | `workspace/hirayama-jyusei-strategy` |
| `HAIKI-05` | 廃棄物日報システム | `【UI日報・月報】2026年一般廃棄物業務報告書（日報・月報）` | `workspace/waste-report-system` |
| `AIOS-06` | Hirayama AI OS | `Hirayama_AI_OS_Dashboard` | `workspace/ai-os` |
| `AINV-07` | AI投資プロジェクト | `AI投資用スプレッドシート` | `workspace/ai-invest` |

この基準表は命名ルールの正本であり、実システムへの反映順は別フェーズで管理する。

---

## 補足判断

### project_id で優先すること

- 業務の意味が伝わること
- 他案件と見分けやすいこと
- 既存の略称と衝突しにくいこと
- 将来見ても意味が追いやすいこと

### project_name で避けること

- 技術名だけで説明すること
- バージョン番号を正規名に含めること
- フォルダ都合の英字名をそのまま表示名にすること

### main_sheet_name の扱い

- 運用中の名称を優先して保持する
- 実務上の帳票・管理表の文脈を壊さない
- 正規表示名と用途が分かればよい

### local_folder の扱い

- 既存スクリプト・手順・参照先との整合を優先する
- 命名上の理想より、現状運用の安定を優先する
- 変更が必要な場合は別フェーズで計画する

---

## 関連文書

- `docs/PROJECT_NAMING_RULE_DRAFT.md` : レビュー履歴として保持する下書き
- `docs/PROJECT_NAMING_MIGRATION_CHECKLIST.md` : 実変更フェーズ用の棚卸しチェックリスト

---

## 今回やらないこと

- コード変更
- live sheet の更新
- local folder 名変更
- live data の `project_id` 変更
- 既存ドキュメントの一括書換え
