# JREC-01 患者画面ボタン — 最終確定記録

- 最終更新: 2026-04-06（実機確認完了・手動配置方式で確定）
- 対象: `【毎日記録】来店管理施術録ver3.1` の `患者画面` シート

---

## 背景

患者画面で頻用する「保存」「入力クリア」を、上部メニューを開かずにワンクリックで押せるようにするため、ボタン化を検討した。

---

## 試行した方式と廃止理由

| 試行 | 結果 |
|---|---|
| SVG Blob → `insertImage()` | `blob の形式がサポートされていません` で失敗 |
| PNG Blob → `insertImage()` | live 上で `画像を挿入できませんでした` が継続。PNG シグネチャ検証を追加しても解消せず |

GAS の `insertImage()` + `assignScript()` 方式（OverGridImage）は live 環境で安定しないと判断。
原因切り分けコストが高いため、**画像自動挿入方式は廃止**した。

---

## 最終確定方針 ✅

**Google Sheets 上で図形を手動配置し、スクリプトを手動割当する。**

- GAS 側は割当対象のラッパー関数のみ維持
- 画像自動生成・自動挿入系コードは今後使用しない
- ボタンが消えた場合は図形を再配置し、同じ関数名を再割当する

---

## 割当関数名と実処理

| ボタン | 割当スクリプト名 | 実処理 |
|---|---|---|
| 保存ボタン | `buttonSavePatientScreen` | `saveVisit_V3()` を呼ぶ |
| 入力クリアボタン | `buttonClearPatientScreen` | 確認ダイアログ後 `clearEntryUI_V3()` を呼ぶ |

- `buttonClearPatientScreen` は OK/CANCEL 確認ダイアログ付き（誤操作防止）
- 両関数は `Ver3_core.js` に存在する（削除しない）

---

## 手動配置手順

1. 患者画面シートを開く
2. **挿入 → 図形描画** で図形（四角形など）を作成
3. 図形を右クリック → **「スクリプトを割り当て」**
4. 上記の割当スクリプト名を入力して確定

> ⚠️ **注意: 関数名に余分なスペースを入れると「スクリプト関数が見つかりません」になる。**
> 括弧なし・前後スペースなしで入力すること。
> 例: `buttonSavePatientScreen`（`buttonSavePatientScreen()` や ` buttonSavePatientScreen ` は NG）

---

## 実機確認結果（2026-04-06）

| 確認項目 | 結果 |
|---|---|
| 保存ボタン（図形）クリック | ✅ `saveVisit_V3()` が実行された |
| 入力クリアボタン（図形）クリック | ✅ 確認ダイアログ表示 → OK で `clearEntryUI_V3()` が実行された |
| メニューからの保存・クリア操作 | ✅ 従来どおり動作 |

---

## GAS 側の現状（Ver3_core.js）

### 残している関数

| 関数 | 用途 |
|---|---|
| `buttonSavePatientScreen` | 保存ボタンの割当先 |
| `buttonClearPatientScreen` | 入力クリアボタンの割当先（確認ダイアログ付き） |
| `setupPatientScreenButtons_V3` | 手動配置ガイドダイアログを表示（メニュー: 手動ボタン配置ガイド） |
| `inspectPatientScreenButtons_V3` | 全シートの OverGridImage 一覧を Logger.log に出す（診断用） |
| `removePatientScreenButtons_` | 旧来の自動挿入画像を除去するために保持 |

### 廃止・変更した関数

| 対象 | 変更内容 |
|---|---|
| `insertPatientScreenButtonOverlay_` | 削除 |
| `buildPatientScreenButtonBlob_` | 削除 |
| `validatePngBlob_` | 削除 |
| PNG 定数 2件 | 削除 |
| `ensurePatientScreenButtons_V3_` | no-op に変更（onOpen 自動挿入を停止） |
| メニュー項目 | `患者画面ボタン再配置` → `手動ボタン配置ガイド` |

---

## 次回再開時の確認事項

- ボタンが消えた場合 → 図形を再配置し、同じ関数名を再割当する
- Apps Script エディタで `buttonSavePatientScreen` / `buttonClearPatientScreen` が存在するか確認する
- メニュー `手動ボタン配置ガイド` を選ぶと割当スクリプト名を含む案内ダイアログが表示される

---

## 運用ルール

- ボタン図形は手動管理。GAS 側での自動生成・自動挿入は行わない
- ラッパー関数（`buttonSavePatientScreen` / `buttonClearPatientScreen`）は削除しない
- 新しいボタンを追加する場合も同方式（手動図形 + スクリプト割当）で統一する
