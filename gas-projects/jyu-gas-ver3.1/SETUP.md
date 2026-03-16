# SETUP.md — write_application.py 別PCセットアップ手順

最終更新: 2026-03-16

このファイルは `write_application.py`（療養費支給申請書 自動生成スクリプト）を
別PCでゼロから再現するための手順書です。
コマンドはそのままコピー＆ペーストして使えるように記載しています。

---

## 正本の場所

| 項目 | パス |
|---|---|
| ワークスペース正本 | `C:\hirayama-ai-workspace\workspace` |
| このプロジェクト | `C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1` |
| スクリプト本体 | `write_application.py` |
| テンプレート xlsx | `療養費支給申請書.xlsx`（スクリプトと同じフォルダに配置） |

> **重要:** OneDrive フォルダ内では作業しないこと。同期競合の原因になります。

---

## 事前条件

別PCで作業を始める前に、以下がすでに使える状態であることを確認してください。

| 条件 | 確認コマンド | 備考 |
|---|---|---|
| Git | `git --version` | バージョンが表示されればOK |
| Python 3.10以上 | `python --version` | 3.10 以上を推奨 |
| uv（パッケージ管理） | `uv --version` | 未導入なら下記参照 |
| clasp（GAS管理） | `clasp --version` | GAS コードを push するときに使う |

### uv が未導入の場合

```powershell
# Windows PowerShell で実行
(Invoke-WebRequest -Uri "https://astral.sh/uv/install.ps1").Content | powershell -
```

インストール後、PowerShell を再起動してから `uv --version` で確認してください。

---

## 第1章: ワークスペースのセットアップ

### 手順1: リポジトリのクローン（初回のみ）

```powershell
cd C:\hirayama-ai-workspace
git clone https://github.com/dabu-pi/hirayama-ai-workspace.git workspace
```

すでにクローン済みの場合はスキップしてください。

### 手順2: 最新状態に同期（毎回作業開始時）

```powershell
cd C:\hirayama-ai-workspace\workspace
git checkout feature/auto-dev-phase3-loop
git pull
```

> `ds` コマンド（PowerShell ショートカット）でも同等の操作ができます。

---

## 第2章: Python 仮想環境のセットアップ

### 手順3: プロジェクトフォルダへ移動

```powershell
cd "C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1"
```

### 手順4: 仮想環境の作成（初回のみ）

```powershell
uv venv
```

`.venv` フォルダが作成されます。

### 手順5: 仮想環境の有効化

```powershell
.venv\Scripts\activate
```

プロンプトの先頭に `(.venv)` が表示されれば有効化成功です。

### 手順6: 必要パッケージの導入

```powershell
uv pip install openpyxl
uv pip install Pillow
```

> `Pillow` は転帰（治癒・中止・転医）の楕円描画に使用します。
> 現在の運用データでは転帰が空欄のため実行されませんが、念のため導入してください。

---

## 第3章: NDJSON バッチファイルの準備

### 手順7: NDJSON ファイルの取得と配置確認

NDJSON ファイルは GAS メニューから出力します。

1. スプレッドシートを開く（毎日記録ブック Ver3.1）
2. GASメニュー「一括JSON出力（月指定）」を実行
3. Google Drive にダウンロードされた `transfer_batch_YYYY-MM.ndjson` をローカルにダウンロード
4. ダウンロード先のパスを確認する

> ファイル名にスペースが含まれる場合（例: `transfer_batch_2026-01 (1).ndjson`）でも、
> 次章の実行コマンドでダブルクォートを使えば問題なく動作します。

---

## 第4章: 実行

### 手順8: 申請書を一括生成する

仮想環境が有効化されていることを確認してから実行してください（`.venv` がプロンプトに表示されているか確認）。

```powershell
python write_application.py --batch "C:\Users\<ユーザー名>\Downloads\transfer_batch_2026-01.ndjson"
```

`<ユーザー名>` は実際のWindowsユーザー名に置き換えてください。

**ファイル名にスペースがある場合の例:**

```powershell
python write_application.py --batch "C:\Users\pinsh\Downloads\transfer_batch_2026-01 (1).ndjson"
```

### 手順9: 出力先の確認

```
gas-projects\jyu-gas-ver3.1\output\2026-01\
  ├── 申請書_hirayamaka_2026-01.xlsx
  └── 申請書_touji_2026-01.xlsx
```

月ごとにサブフォルダが自動作成されます。

### 手順10: コンソール出力の確認

正常に完了した場合、以下のような出力が表示されます。

```
NDJSON読み込み: ...
バリデーション OK: 2患者, schemaVersion=3.0, month=2026-01
[1/2] hirayamaka ... OK
[2/2] touji ... OK
==================================================
一括転記完了: 2/2 件
出力先: ...output\2026-01
検証: 全件パス
```

---

## 第5章: 目視確認ポイント

出力された xlsx を Excel で開いて以下を確認してください。

### 共通（両ファイル）

| 確認セル | 期待値 | 確認内容 |
|---|---|---|
| `E21` | 患者氏名 | 平山克士 / 田路吾子 |
| `CQ4`〜`DS4` | 保険者番号 8桁 | 各セルに1桁ずつ |
| `CV44`〜`DP44` | 合計 1820 | 各桁に数字が入っている |
| `CV45`〜`DP45` | 窓口負担額 550 | |
| `CV46`〜`DP46` | 請求金額 1270 | |
| `M32` カレンダー | 通院日に丸数字 | visitDays=[1] → ①が丸 |

### hirayamaka（case2=null）

| 確認セル | 期待値 |
|---|---|
| `E26` | 頸部 捻挫 |
| `E27` | 背部下部 挫傷 |
| `E28`〜`E30` | **空欄**（case2なし） |
| `AC35` | (1) 760円 |
| `AR35` | (2) 760円 |
| `BG35`〜`CK35` | **空欄**（case2なし） |
| `E38`（部位⑴） | 冷85、部位計85 |
| `E39`（部位⑵） | 冷85、部位計85 |
| `E40`・`E42` | **空欄** |

### touji（case2=実データ）

| 確認セル | 期待値 |
|---|---|
| `E26` | 頸部 捻挫（case1） |
| `E27` | 空欄（case1 負傷名2なし） |
| `E28` | 腰部 捻挫（case2）← 詰めて27行でなく28行 |
| `AC35` | (1) 760円（case1施療料1） |
| `AR35` | **(2) 760円**（case2施療料1）← (3)でなく(2) |
| `E38`（部位⑴） | 冷85、部位計85（case1部位1） |
| `E39`（部位⑵） | 冷85、部位計85（case2部位1）← ⑶/行40でなく⑵/行39 |
| `E40`・`E42` | **空欄** |

---

## 第6章: よくあるエラーと対処

### エラー1: `ModuleNotFoundError: No module named 'openpyxl'`

**原因:** 仮想環境が有効化されていない、またはパッケージが未導入。

**対処:**

```powershell
# 仮想環境を有効化してからインストール
.venv\Scripts\activate
uv pip install openpyxl
```

---

### エラー2: `ModuleNotFoundError: No module named 'PIL'`

**原因:** Pillow が未導入。

**対処:**

```powershell
uv pip install Pillow
```

---

### エラー3: `PermissionError: [Errno 13] Permission denied: '...申請書_xxx.xlsx'`

**原因:** 出力先の xlsx ファイルが Excel やエクスプローラーのプレビューで開かれている、またはクラウドストレージが同期ロックしている。

**対処:**

1. Excel でファイルが開いている場合は閉じる
2. エクスプローラーのプレビューペインを閉じる
3. OneDrive / Google Drive の同期が進行中の場合は待つ
4. 再実行する

> このエラーはコードの不具合ではありません。ファイルを閉じれば解決します。

---

### エラー4: `エラー: transfer_batch_*.ndjson が見つかりません`

**原因:** `--batch` をファイル指定なしで実行したが、デフォルト検索先（`G:\マイドライブ\ダウンロード`）にファイルが見つからない。

**対処:** ファイルパスを明示的に指定する。

```powershell
python write_application.py --batch "C:\Users\<ユーザー名>\Downloads\transfer_batch_2026-01.ndjson"
```

または環境変数で検索先を変更する。

```powershell
$env:V3_BATCH_DOWNLOAD_DIR = "C:\Users\<ユーザー名>\Downloads"
python write_application.py --batch
```

---

### エラー5: `バリデーションエラー: schemaVersion不一致`

**原因:** 古いバージョンの NDJSON を使っている。

**対処:** GAS側で最新の NDJSON を再出力してからやり直す。

---

## 第7章: 運用ルール

| タイミング | 操作 | 内容 |
|---|---|---|
| 作業開始 | `ds` | git pull + 状態確認。`feature/auto-dev-phase3-loop` ブランチで実施 |
| 作業終了 | `de -ProjectId JREC-01 "説明"` | commit + push + ログ同期 |
| PC切替前 | `de "WIP: ..."` | 途中でも必ず push まで実施 |
| push しない一時保存 | `de -NoPush "説明"` | 機密・壊れ状態のみ |

**基本方針:**

- 正本は `workspace/` のみ。`claude-sandbox/` や `archive/` では Git 作業しない
- コードに単価・定数をハードコードしない（設定シートで管理）
- 申請書 xlsx や認証情報（`service_account.json` 等）はコミットしない
- GAS コードの変更後は `clasp push` を忘れずに実施する

---

## 付録: ファイル構成

```
gas-projects/jyu-gas-ver3.1/
├── write_application.py     ← 申請書生成スクリプト（このセットアップの対象）
├── 療養費支給申請書.xlsx    ← テンプレート（必須・gitで管理）
├── output/                  ← 生成済み申請書の出力先（gitignore済み）
├── Ver3_core.js             ← GAS: 来院登録・区分判定
├── Ver3_amounts.js          ← GAS: 金額計算
├── Ver3_transferData.js     ← GAS: 申請書データ転記
├── Ver3_patientPicker.js    ← GAS: 患者選択UI
├── appsscript.json          ← GAS プロジェクト設定
├── SPEC.md                  ← 金額計算仕様書
├── PLAN.md                  ← 開発計画
├── TESTCASES.md             ← テストケース
├── PROJECT_STATUS.md        ← 進捗・完了事項
└── SETUP.md                 ← このファイル
```
