# VOCAB_MASTER.md — ダッシュボード語彙マスタ定義書

> Lists シートを語彙の単一ソース（SSoT）として運用するための管理文書。
> 英語↔日本語対応表・表記ゆれ防止ルール・将来変更手順を記録する。
>
> 作成: 2026-03-08 | 最終更新: 2026-03-08

---

## 1. 目的

ダッシュボードで使用する語彙を一元管理し、以下を防ぐ。

- 表記ゆれ（例: 「進行中」「In Progress」「実行中」が混在する）
- 意味の曖昧さ（例: 「待機」と「未着手」の違いが不明確）
- 将来の GAS や集計スクリプトが英語値を期待して壊れる

---

## 2. 語彙管理方針

| 方針 | 内容 |
|---|---|
| **基本**: 日本語優先 | 手動運用しやすい日本語表記を基本とする |
| **例外**: 技術語彙は英語維持 | Phase1〜4, GAS, AI, Ops 等は原語を維持 |
| **例外**: 固有名詞は英語維持 | Claude, ChatGPT, GitHub, Sheets, SUCCESS, ERROR 等 |
| **単一ソース** | Lists シートの値が全語彙の正典。直接入力禁止 |
| **変更手順厳守** | Lists → ドロップダウン再設定 → 既存データ置換 → 文書更新 の順 |
| **削除禁止** | 廃止語彙は削除せず「廃止」注記を付けて残す |

---

## 3. グループ別語彙定義

> Lists シートはカラム単位でグループを管理する。
> **列レイアウト:** A=status / B=phase / C=type / D=system / E=assigned_to / F=task_status / G=task_type / H=priority / I=idea_status

---

### Column A: status（プロジェクトステータス）

使用シート: Projects

| 英語（移行前） | 日本語（採用） | 意味・用途 |
|---|---|---|
| Active | 稼働中 | 本番環境で稼働中 |
| In Progress | 進行中 | 開発・改善作業中 |
| Prototype | 試作 | 動作するが本番非対応の試作段階 |
| Parked | 保留 | 一時中断・将来再開予定 |
| Complete | 完了 | 開発終了・安定運用または引退 |

> ⚠️ **変更時の注意:** Dashboard の QUERY/FILTER 数式がこの値を参照している可能性あり。
> 変更前に Dashboard シートの数式を確認すること（SAFE_CHANGE_ORDER Step 5 参照）。

---

### Column B: phase（フェーズ）

使用シート: Projects

| 語彙 | 採用 | 意味・用途 |
|---|---|---|
| Concept | 構想 | アイデア段階・要件未定義 |
| Design | 設計 | 仕様策定・設計中 |
| Build | 実装 | コーディング・構築中 |
| Test | テスト | テスト実施中（カタカナ維持） |
| Run | 運用 | 本番運用中 |
| Stable | 安定運用 | 安定して運用中 |
| Phase1 | Phase1 | 維持（プロジェクト固有フェーズ） |
| Phase2 | Phase2 | 維持 |
| Phase3 | Phase3 | 維持 |
| Phase4 | Phase4 | 維持 |
| PhaseB | PhaseB | 維持 |
| Ops | Ops | 維持（Operations の業界略語） |

---

### Column C: type（プロジェクト種別）

使用シート: Projects

| 英語（移行前） | 日本語（採用） | 意味・用途 |
|---|---|---|
| Production | 本番 | 本番環境で使用中 |
| Pilot | 試行 | 限定運用・パイロット |
| Local Only | ローカル専用 | ローカル環境のみ動作 |
| None | なし | 種別未定または該当なし |

---

### Column D: system（使用システム）

使用シート: Run_Log（将来: Task_Queue）

> ⚠️ **有効値は未確定（要ユーザー確認）。以下はドラフト案。**
> `system` 列は固有サービス名のため英語維持。

| 語彙（案） | 意味 |
|---|---|
| Sheets | Google スプレッドシート |
| GitHub | Git / GitHub 操作 |
| GAS | Google Apps Script |
| Claude | Claude Code / Claude Desktop |
| ChatGPT | ChatGPT 操作 |
| freee | freee API / freee 操作 |
| Local | ローカル開発環境 |

> **確認事項:** この有効値リストで問題ないかをユーザーが確認・確定してから Lists に追加する。

---

### Column E: assigned_to（担当）

使用シート: Task_Queue

| 英語（移行前） | 採用 | 意味・用途 |
|---|---|---|
| AI | AI | AI ツール担当（Claude・ChatGPT 等を総称）|
| Human | 人 | 人間が担当 |
| AI+Human | AI+人 | 協調作業 |

> **注意:** 旧スキーマの `Claude` / `人間` / `両方` から変更。
> `Claude` → `AI` に変更することで将来の AI ツール切り替えに対応。
> 旧値 `Claude` / `人間` / `両方` が残っている既存行は Step 6 で手動置換が必要。

---

### Column F: task_status（タスクステータス）

使用シート: Task_Queue

| 英語（移行前） | 日本語（採用） | 意味・用途 |
|---|---|---|
| Pending | 未着手 | タスク登録済み・未開始 |
| In Progress | 進行中 | 現在作業中 |
| Waiting | 待機 | 作業中だが外部待ち（承認待ち等） |
| Blocked | 停止中 | 阻害要因があり進められない |
| Done | 完了 | 完了・クローズ |

> **注意:** `未着手`（まだ開始していない）と `待機`（開始後の外部待ち）は意味が異なるため両方維持。
> ⚠️ Dashboard の「OpenTasks」カウント数式がこの値を参照している可能性あり。

---

### Column G: task_type（タスク種別）

使用シート: Task_Queue

| 英語（移行前） | 日本語（採用） | 意味・用途 |
|---|---|---|
| Run | 実行 | スクリプト実行・手動作業 |
| Test | テスト | テスト実施（カタカナ維持） |
| Dev | 開発 | 機能開発・コーディング |
| Docs | 文書 | ドキュメント作成・更新 |
| Research | 調査 | 調査・検証・プロトタイプ |
| Design | 設計 | 設計・仕様策定 |
| Ops | Ops | 維持（定常運用・インフラ） |

---

### Column H: priority（優先度）

使用シート: Task_Queue（将来: Projects）

| 英語（移行前） | 日本語（採用） | 意味・用途 |
|---|---|---|
| High | 高 | 最優先・今すぐ対応 |
| Medium | 中 | 通常優先度 |
| Low | 低 | 余裕があれば対応 |

> ⚠️ **型の変更:** 旧スキーマでは `priority` を NUMBER（1=最高）で管理。
> TEXT ドロップダウンへの変更により数値ソートが使えなくなる。
> Task_Queue の行順序（上行が高優先）で代替する。

---

### Column I: idea_status（アイデアステータス）

使用シート: Ideas

| 英語（移行前） | 日本語（採用） | 意味・用途 |
|---|---|---|
| Idea | アイデア | 登録済み・評価前 |
| Research | 調査中 | 実現可能性を調査中 |
| Planned | 計画済み | プロジェクト化予定 |
| Parked | 保留 | 保留（将来再評価） |
| Converted to Project | プロジェクト化済み | プロジェクトに昇格済み |

---

### 補足グループ（Lists 外・ただし文書で管理）

#### run_result（Run_Log 結果）

> **英語維持確定。GAS スクリプトが文字列比較する可能性があるため変更禁止。**

| 語彙 | 意味 |
|---|---|
| `SUCCESS` | 正常完了 |
| `STOP` | 意図的停止（安全規則による）|
| `ERROR` | エラー発生 |
| `PARTIAL` | 部分完了 |

#### effort_level / impact（影響度・工数）

| 旧語彙（スキーマ） | 現在の提案 | 採用 |
|---|---|---|
| `小` / `中` / `大` | Low/Medium/High → 低/中/高 | 高/中/低（impact は priority と統一）|

---

## 4. 英語のまま維持するもの（KEEP_AS_IS 一覧）

| 語彙 / グループ | 理由 |
|---|---|
| Phase1 / Phase2 / Phase3 / Phase4 / PhaseB | プロジェクト内の固有フェーズ名 |
| Ops | 業界標準略語（Operations）。日本語化すると意味が曖昧になる |
| GAS | Google Apps Script の固有略語 |
| AI | 国際標準語。固有ツール名としての役割 |
| テスト | カタカナ定着語（「Test」との表記ゆれを防ぐためカタカナ統一）|
| run_result: SUCCESS / STOP / ERROR / PARTIAL | GAS が参照する可能性。変更禁止 |
| system 列: Sheets / GitHub / GAS / Claude 等 | 固有サービス名。英語維持 |
| project_id: GAS-01 / FREEE-02 等 | 識別子。変更すると全参照が壊れる |

---

## 5. 表記ゆれ防止ルール

1. **Lists シートが唯一の正典** — Lists に定義されていない値は使用しない
2. **コピペ入力禁止** — 必ずドロップダウンから選択する
3. **新語彙追加は文書 → スプレッドシートの順** — このファイルに先に追記してから Lists に追加
4. **廃止語彙は削除しない** — 既存データへの影響を防ぐため「廃止」注記を付けて残す
5. **同義語の統一** — 「完了」/「Done」/「終了」が混在しないよう注意

---

## 6. 将来変更時の手順（SAFE_CHANGE_ORDER）

語彙を変更する場合は必ず以下の順で実施する。

| Step | 作業 | 担当 |
|---|---|---|
| 1 | **VOCAB_MASTER.md を更新**（このファイル）— 変更内容を記録 | Claude |
| 2 | **system 列の有効値を確認・確定**（初回のみ）| 人間 |
| 3 | **Lists シートを変更**（新語彙を追加。旧語彙は「廃止」注記で残す）| 人間 |
| 4 | **ドロップダウン検証を更新**（Projects / Task_Queue / Ideas / Run_Log）| 人間 |
| 5 | **Dashboard の数式を確認**（QUERY/FILTER 参照が壊れていないか）| 人間 |
| 6 | **既存データを一括置換**（旧語彙 → 新語彙。Run_Log 既存行は置換しない）| 人間 |
| 7 | **Dashboard が正常表示されるか確認** | 人間 |
| 8 | **dashboard-schema.md のスキーマ変更履歴を更新** | Claude |
| 9 | **Run_Log に変更記録を追加**（変更内容・日時）| 人間 |

---

## 7. 変更履歴

| 日付 | 変更内容 | 変更者 |
|---|---|---|
| 2026-03-08 | 初版作成。英語中心 → 日本語中心語彙への移行方針を定義。全9グループの対応表を作成 | Claude |
| 2026-03-08 | **語彙移行完了。** Lists/Projects/Ideas/Task_Queue の全データを日本語に一括変換（GAS スクリプト v2 実行）。個別修正: Ideas B7 "Strategy AI" → "戦略"。Metrics シートの COUNTIF 数式・基準値ラベル（B3〜B10・D3〜D7・E3〜E7・G3〜G7・H3〜H7）を英語 → 日本語に更新。Dashboard サマリー（Production Systems・In Progress 等）が正常カウントされることを確認 | Claude |
