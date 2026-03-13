# PROJECT_NAMING_RULE_DRAFT.md

最終更新: 2026-03-13
ステータス: Draft Archive

> この文書はレビュー履歴として保持する下書きである。
> 命名ルールの正本は `docs/PROJECT_NAMING_RULE.md` とする。

---

## 目的

`project_id` / `project_name` / `main_sheet_name` / `local_folder` の命名原則を
1本の文書として整理し、今後の実変更フェーズで判断基準のぶれを防ぐ。

この文書は命名方針の下書きであり、**今回はコード・sheet・folder・live data を変更しない。**

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

## 最新の命名基準表

以下を現時点の仮固定基準表とする。

| project_id | project_name | main_sheet_name | local_folder |
|---|---|---|---|
| `JREC-01` | 柔整毎日記録システム | `【毎日記録】来店管理施術録ver3.1` | `workspace/gas-projects/jyu-gas-ver3.1` |
| `FREEE-02` | freee見積自動化 | `2024長谷川さん管理シート` | `workspace/freee-automation` |
| `JWEB-03` | 患者管理Webアプリ | `整骨院 電子カルテ` | `workspace/patient-management` |
| `JBIZ-04` | 接骨院経営戦略AI | `平山接骨院 慢性疼痛強化プロジェクト 管理表` | `workspace/hirayama-jyusei-strategy` |
| `HAIKI-05` | 廃棄物日報システム | `【UI日報・月報】2026年一般廃棄物業務報告書（日報・月報）` | `workspace/waste-report-system` |
| `AIOS-06` | Hirayama AI OS | `Hirayama_AI_OS_Dashboard` | `workspace/ai-os` |
| `AINV-07` | AI投資プロジェクト | `AI投資用スプレッドシート` | `workspace/ai-invest` |

この基準表は、命名方針レビュー用のたたき台であり、今回時点では実システムへの反映を行わない。

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

## 実変更フェーズで必要な棚卸し対象

正式版では、以下を別紙チェックリストとして切り出す前提で扱う。
実変更フェーズでは、少なくとも以下を確認する。

- [ ] Dashboard / schema 文書内の `project_id` 参照
- [ ] scripts 内の `project_id` 定数、マップ、正規表現
- [ ] Run_Log / Projects / Task_Queue / Ideas の live data
- [ ] JSON / example ファイル内の既存 `project_id`
- [ ] handoff / automation / validator 系スクリプト
- [ ] 文書内の旧 `project_name` / 旧 `project_id` の記述

---

## 今回やらないこと

- コード変更
- live sheet の更新
- local folder 名変更
- live data の `project_id` 変更
- 既存ドキュメントの一括書換え

---

## 次の利用方法

- この文書を命名ルール文書のたたき台としてレビューする
- 命名基準表が固まったら、正式版ファイル名へ昇格する
- 実変更フェーズでは棚卸し対象を別紙チェックリストとして切り出して進める
