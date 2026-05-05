# JREC-01 柔整保険申請書 Ver3.1 — プロジェクトステータス

最終更新: 2026-05-05 (WEB-1B)  
担当: dabu-pi  
ブランチ: `feature/auto-dev-phase3-loop`

---

## 現在の状態

**稼働中 + Phase WEB-1 完了**

スプレッドシート運用は継続中。  
Web UI 化 Phase WEB-1（読み取り専用 Web 入口）を実装・clasp push 済み。

---

## Phase WEB-1 実装内容（2026-05-05）

### 新規追加ファイル

| ファイル | 内容 |
|---|---|
| `web-home.html` | Web ナビゲーションハブ（カード形式） |
| `web-patient-detail.html` | 患者詳細・来院履歴の読み取り専用画面 |
| `docs/WEB_UI_MIGRATION_PLAN_2026-05-05.md` | Web UI 移行計画 Markdown |

### Ver3_core.js 変更内容

| 変更種別 | 内容 |
|---|---|
| `doGet(e)` 拡張 | `page=home` / `page=detail` ルート追加（既存ルートは変更なし） |
| 新関数追加 | `getPatientDetail_V3(patientId)` — 患者基本情報 + 来院履歴10件返却 |

### patientSearch.html 変更内容

- 「患者詳細を見る」ボタンを選択後パネルに追加（`?page=detail&patientId=xxx` へのリンク）

---

## doGet ルーティング（現在）

| `page=` | HTML | 状態 |
|---|---|---|
| `search`（デフォルト） | `patientSearch.html` | 稼働中 |
| `selfpay` | `selfPayWeb.html` | 稼働中 |
| `home` | `web-home.html` | WEB-1 追加 |
| `detail` | `web-patient-detail.html` | WEB-1 追加 |

---

## 既存スプレッドシート運用への影響

**影響なし**

- 既存シート構造は変更していない
- 既存 GAS 関数は変更していない（doGet の既存ルートも変更なし）
- スプレッドシート操作（保存・帳票出力）は従来通り動作する

---

## Phase WEB-1B 入口整理・設計固め（2026-05-05）

### 実施内容

| 項目 | 内容 |
|---|---|
| `patientSearch.html` | 「← Web ホームへ」リンクを追加（最小差分） |
| デフォルト URL 方針 | `page=search` のまま維持（変更しない） |
| 設計 Markdown 作成 | `docs/PHASE_WEB2_VISIT_CREATE_DESIGN_2026-05-05.md` |

### デフォルト URL をまだ変更しない理由

`patientSearch.html` → `selfPayWeb.html` はスマホ実地テスト済みの稼働導線。
`web-home.html` は実機未確認のため、デフォルトに変更すると既存運用が止まるリスクがある。
条件リスト（PHASE_WEB2 設計 §8）が揃ったタイミングで変更する。

### `saveVisitFromWeb_V3` が必要な理由

既存の `saveVisit_V3` はスプレッドシートの患者画面シート（C2, B4, A12:H13 等）からデータを読むため、
Web App の google.script.run から呼んでも意図した値が読めない。
JSON 引数で受け取る専用関数 `saveVisitFromWeb_V3(payload)` を新規実装する必要がある。

### `setPatientAndDate_V3` を Web 保存処理に流用しない理由

B2（患者表示名）と B4（来院日）を **シートに書き込む副作用** がある。
Web セッションと並行してスプレッドシートを開いている場合に干渉する。
Web UI からの来院登録では、シートを経由しない保存経路（`saveVisitFromWeb_V3`）を使う。

### 次の実装候補（Phase WEB-2）

```
1. getPrevVisitData_V3(patientId)  ← 前回来院データ JSON 返却
2. web-visit-new.html              ← 来院登録フォーム
3. doGet に page=visitNew 追加
4. saveVisitFromWeb_V3(payload)    ← 来院登録保存（UIシート非依存）
5. web-patient-detail.html に「来院記録を追加」ボタン
```

---

## Phase WEB-1 後 既存 Web UI 棚卸し（2026-05-05）

詳細は `docs/WEB_UI_EXISTING_INVENTORY_2026-05-05.md` 参照。

### 棚卸し結果サマリ

- 既存稼働中導線: `patientSearch.html` → `selfPayWeb.html`（スマホ操作・実地テスト済み）
- Phase WEB-1 の位置づけ: **部分延長 + 部分並列**
  - 延長: `patientSearch.html` に「患者詳細を見る」追加
  - 並列: `web-home.html` は `?page=home` 指定でのみアクセス可能（デフォルト URL は変更なし）
- 既存スプレッドシートUI専用関数（Web から直接呼べない）: `saveVisit_V3`, `autofillFromPreviousVisit_V3`, `openSelfPayDialog_V3`

### Phase WEB-2 前に決めること

1. **デフォルト URL の方針**（`web-home.html` をデフォルトにするか）
2. **来院登録の設計**（`saveVisitFromWeb_V3` 新関数の引数・バリデーション方針）
3. **実機確認**（`web-home.html` / `web-patient-detail.html` の動作確認）

### Phase WEB-2 で必要な新関数

| 関数 | 役割 |
|---|---|
| `saveVisitFromWeb_V3(params)` | JSON 引数で来院登録（`saveVisit_V3` の Web 版） |
| `getPrevVisitData_V3(patientId, treatDate)` | 前回来院データの JSON 返却 |

---

## 次フェーズ候補

### Phase WEB-2
Web から来院記録を新規登録する。

- 患者選択 → 来院日選択 → 区分候補表示
- 部位・施術内容入力 → 保存前確認 → visitKey 発行
- 監査ログ記録

### Phase WEB-3
Web から施術録・申請書生成へ。

- 月次申請対象者一覧
- 申請書プレビュー・生成
- PDF / 印刷導線

---

## 設計方針リファレンス

詳細は `docs/WEB_UI_MIGRATION_PLAN_2026-05-05.md` を参照。

### 個人情報ログ禁止フィールド

氏名・住所・電話番号・生年月日・保険者番号・記号番号・被保険者情報

### 算定ルール優先順位（維持）

30日ルール → 月内制御 → 区分確定 → 逓減 → 長期減額
