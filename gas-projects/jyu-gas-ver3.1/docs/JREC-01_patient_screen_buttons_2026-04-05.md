# JREC-01 患者画面ボタン追加 2026-04-05

- 作業日: 2026-04-05
- 対象: `【毎日記録】来店管理施術録ver3.1`
- 目的: 患者画面で頻用する `保存` / `画面クリア` を、上部メニューを開かずに押せるようにする

## 変更ファイル

- `Ver3_core.js`
- `PROJECT_STATUS.md`
- `docs/JREC-01_patient_screen_buttons_2026-04-05.md`

## 今回の実装概要

- 患者画面シートに、ボタン見た目用のセル領域を 2 つ用意した
  - `F1:G2` = `保存`
  - `H1:I2` = `入力クリア`
- 既存処理本体は変更せず、図形/画像ボタン割当用のトップレベル関数を追加した
  - `buttonSavePatientScreen()`
  - `buttonClearPatientScreen()`
- `buttonClearPatientScreen()` には確認ダイアログを追加した
- ボタンのクリック割当は、OverGridImage に `assignScript()` する方式にした
- `onOpen()` でも不足時の自動再配置を呼ぶようにし、シート再読込時にボタンが消えていても復元されるようにした
- SVG Blob は `Sheet.insertImage(blobSource, ...)` で `blob の形式がサポートされていません` になったため、修正版では **PNG Blob** に戻した
- 現在はセル装飾を見た目に使い、PNG OverGridImage はクリック割当用オーバーレイとして使う
- 管理メニューから再配置できるよう、`患者画面ボタン再配置` を追加した

## 既存処理との対応関係

| 新規ラッパー | 呼び出し先の既存関数 | 用途 |
|---|---|---|
| `buttonSavePatientScreen` | `saveVisit_V3` | 患者画面の保存 |
| `buttonClearPatientScreen` | `clearEntryUI_V3` | 患者画面の入力クリア |

## 採用した配置方式

- Google Sheets の Drawing/画像スクリプト割当方式に合わせ、**見た目はセルボタン、クリック判定は透明画像オーバーレイ** で実装した
- 理由:
  - 既存処理本体を変えずに済む
  - Apps Script から再配置・再実行しやすい
  - 再配置時に重複ボタンを除去しやすい

## 追加した主な関数

- `buttonSavePatientScreen()`
- `buttonClearPatientScreen()`
- `setupPatientScreenButtons_V3()`
- `inspectPatientScreenButtons_V3()`
- `ensurePatientScreenButtons_V3_()`

## 配置・再配置ルール

- `setupPatientScreenButtons_V3()` を実行すると、既存の患者画面ボタンを除去してから再配置する
- 再配置対象は alt text / script 名で判定する
- 順序は常に `保存` → `入力クリア`
- `inspectPatientScreenButtons_V3()` は全シートの OverGridImage を走査し、`sheetName / script / anchorA1 / width / height` を `Logger.log` に出す

## 確認観点

- 保存ボタンが `saveVisit_V3()` に繋がっていること
- クリアボタンが確認ダイアログ経由で `clearEntryUI_V3()` に繋がっていること
- メニュー操作 (`保存`, `画面クリア`) は従来どおり残ること
- 再実行してもボタンが重複しないこと

## テスト / 確認結果

- `node --check Ver3_core.js`
  - PASS
- `clasp push --force`
  - PASS
- `clasp run setupPatientScreenButtons_V3`
  - 権限エラーで headless 実行不可
  - そのため、live 上の即時自動配置確認は `onOpen()` 側の不足時再配置で補完する構成に変更した
- `clasp run inspectPatientScreenButtons_V3`
  - この環境では Execution API 側の権限制約があるため、headless 検証は継続課題

## 今後の追加ルール

- 日常運用で毎日押す操作だけを患者画面上部へ出す
- 設定系・移行系・デバッグ系は引き続きメニュー側に寄せる
- 新しいボタンを追加する場合も、既存処理本体ではなくトップレベルラッパー経由を優先する

## 補足

- 今回のボタンは公開シート UI 上の見やすさを優先し、`入力クリア` のみ確認ダイアログ付き
- placeholder 的な仮関数は置かず、既存関数へ直接接続している

---

## 2026-04-06 追記 — 画像自動挿入廃止・手動配置に移行

### 廃止の経緯

PNG OverGridImage 方式（`insertImage()` + `assignScript()`）は、SVG / PNG Blob を通じた複数の試みで live 上で継続的に以下のエラーが発生した：

> `Exception: 画像を挿入できませんでした。画像が有効であることを確認して、もう一度お試しください。`

Blob の検証コード（PNG シグネチャ確認）を追加しても解消せず、GAS 側の制約と判断。原因切り分けのコストが高いため、画像生成経路を中止し**手動配置に移行**した。

### 廃止した実装

| 廃止対象 | 内容 |
|---|---|
| `insertPatientScreenButtonOverlay_` | `insertImage()` を呼ぶ関数。削除。 |
| `buildPatientScreenButtonBlob_` | PNG Blob を生成する関数。削除。 |
| `validatePngBlob_` | PNG シグネチャ検証関数。削除。 |
| PNG 定数 | `PATIENT_SCREEN_BUTTON_IMAGE_MIME_TYPE` / `PATIENT_SCREEN_BUTTON_TRANSPARENT_PNG_BASE64`。削除。 |
| `ensurePatientScreenButtons_V3_` | no-op に変更（onOpen での自動挿入を停止）。 |
| `setupPatientScreenButtons_V3` | 手動配置ガイドダイアログに変更。 |
| メニュー項目 | `患者画面ボタン再配置` → `手動ボタン配置ガイド` に変更。 |

### 手動配置ルール（恒久）

スプレッドシートの「挿入 → 図形描画」で図形を作成し、右クリック →「スクリプトを割り当て」で以下の関数名を入力する。

| ボタン | 割当スクリプト名 | 推奨配置位置 |
|---|---|---|
| 保存ボタン | `buttonSavePatientScreen` | 患者画面 F1:G2 付近 |
| 入力クリアボタン | `buttonClearPatientScreen` | 患者画面 H1:I2 付近 |

- `buttonSavePatientScreen` / `buttonClearPatientScreen` 関数本体は引き続き `Ver3_core.js` に存在する
- メニュー `手動ボタン配置ガイド` を選ぶと、上記割当スクリプト名を含む案内ダイアログが表示される
