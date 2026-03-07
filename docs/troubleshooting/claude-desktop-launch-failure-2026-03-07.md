# Claude Desktop 起動失敗トラブルシューティング記録

**発生日:** 2026-03-07
**解決日:** 2026-03-07
**対象PC:** \<PC名\>（Windows 11 25H2 / ユーザー: \<ユーザー名\>）
**対象アプリ:** Claude Desktop v1.1.5368.0

---

## 発生した症状

Claude Desktop のアイコンをクリックすると、以下のダイアログが表示されて起動しない。

```
Claude Desktop failed to Launch
```

- ウィンドウは一切表示されない
- エラーダイアログを閉じると何も起動しない
- 再インストールしても再発した
- Claude Code CLI（`claude` コマンド）は正常に動作していた

---

## 最初に見えていた現象

| 場所 | 内容 |
|---|---|
| Claude Setup.log | `MSIX installation succeeded / Launching Claude` まで進んでいた |
| `Get-AppxPackage` | Claude が「インストール済み」として表示されていた |
| AppModel-Runtime/Admin イベントログ | Claude のプロセス作成直後にコンテナーが破棄されていた |
| `CoworkVMService` | 再インストール後も `Running` になっていた（謎のサービスに見えた） |

---

## 調査で判明したこと

### CoworkVMService の正体

「謎のサービス」と思っていた `CoworkVMService` は、実は **Claude Desktop 自身のバックエンドサービス** だった。

```
BINARY_PATH_NAME: C:\Program Files\WindowsApps\Claude_1.1.5368.0_x64__pzs8sxrjxfjjc\app\resources\cowork-svc.exe
DISPLAY_NAME: Claude
```

このサービスは Claude の内部コンポーネントであり、問題の原因ではなかった。

### 問題は2段階あった

起動失敗の原因は **1つではなく、2段階に重なっていた**。
第1段階を修正すると、第2段階が顕在化した。

---

## 原因 第1段階：Chrome Sandbox AppContainer の残骸

### 何が起きていたか

Claude Desktop（Electron アプリ）は内部で **WebView2**（画面描画エンジン）を使用する。
WebView2 は起動時に「Chrome Sandbox」という安全な隔離領域（AppContainer）を Windows 内に作成しようとする。

過去に Claude がクラッシュした際、この AppContainer の **登録情報だけが残骸として残った**。
以降、起動するたびに「同じ名前の AppContainer を作ろうとしたら、すでに存在すると言われてエラー」が繰り返された。

### 確認したログ（AppModel-Runtime/Admin イベント ID 40）

```
AppContainer Chrome Sandbox cr.sb.odmF5200EAFD3AD904629CBB0F87A78A3C7211081FE
は既に存在するため、作成できませんでした
```

このエラーが Claude を起動するたびに記録されていた。

### 残骸の場所

| 種類 | 場所 |
|---|---|
| レジストリ1 | `HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings\S-1-15-2-1760019844-2681172078-3872633735-798519778-3824819574-1684089895-1452983902` |
| レジストリ2 | `HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings\S-1-15-2-620072444-2846605723-1118207114-1642104096-81213792-2370344205-2712285428` |
| フォルダ1 | `C:\Users\<ユーザー名>\AppData\Local\Packages\cr.sb.odmf5200eafd3ad904629cbb0f87a78a3c7211081fe\` |
| フォルダ2 | `C:\Users\<ユーザー名>\AppData\Local\Packages\cr.sb.odm3E4D1A088C1F6D498C84F3C86DE73CE49F82A104\` |

### 修正内容（第1段階）

上記のレジストリ2件とフォルダ2件を削除した。

```powershell
# レジストリ削除
$base = 'HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings'
Remove-Item "$base\S-1-15-2-1760019844-..." -Recurse -Force
Remove-Item "$base\S-1-15-2-620072444-..."  -Recurse -Force

# フォルダ削除
Remove-Item "$env:LOCALAPPDATA\Packages\cr.sb.odmf5200..." -Recurse -Force
Remove-Item "$env:LOCALAPPDATA\Packages\cr.sb.odm3E4D1A..." -Recurse -Force
```

**この修正後、AppModel イベント ID 40 は発生しなくなった。**
しかし Claude Desktop の起動失敗は続いた（第2段階の問題が顕在化）。

---

## 原因 第2段階：Documents フォルダが OneDrive を向いており GetFolderPath が空文字を返していた

### 何が起きていたか

Claude Desktop（Electron アプリ）は起動直後に、以下の処理を行う。

```
app.getPath('documents')  ← Windows に「ドキュメントフォルダはどこ？」と問い合わせる
```

この問い合わせに対し、Windows が **空文字（何も返さない）** を返していた。
Claude はこれを「パスの取得失敗」と判断して即クラッシュした。

### 確認したログ（launch-failure.err）

```
Error: Failed to get 'documents' path
{}
Failed to get 'documents' path}
Error: Failed to get 'documents' path
    at Object.<anonymous> (C:\Program Files\WindowsApps\Claude_...\app\resources\app.asar\.vite\build\index.js:...)
```

**このファイルの場所：**
```
C:\Users\<ユーザー名>\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\launch-failure.err
```

### なぜ空文字が返っていたか

Windows の「ドキュメントフォルダ」の指定先がレジストリで以下のように設定されていた：

```
HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders
  Personal = C:\Users\<ユーザー名>\OneDrive\ドキュメント   ← OneDrive 内の日本語フォルダ
```

これは以前 OneDrive の「ドキュメント」フォルダ同期を有効にしたときの設定が残ったものだった。
しかし調査時点で **OneDrive.exe は停止中** だった。

OneDrive が停止している状態では、Windows の `SHGetKnownFolderPath` API が
ドキュメントフォルダのパスを正しく解決できず、空文字を返すことがある。
（フォルダ自体は存在しているが、API レベルで空が返る）

### 修正内容（第2段階）

レジストリの `Personal` 値をローカルフォルダに変更した。

```
変更前: C:\Users\<ユーザー名>\OneDrive\ドキュメント
変更後: C:\Users\<ユーザー名>\Documents
```

変更対象のレジストリキー：

```
HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders
  Personal
  {F42EE2D3-909F-4907-8871-4C22FC0BF756}
  {24D89E24-2F19-4534-9DDE-6A6671FBB8FE}

HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders
  Personal
```

**実行コマンド：**

```powershell
$key = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders'
Set-ItemProperty -Path $key -Name 'Personal' -Value "$env:USERPROFILE\Documents"
```

---

## 修正前後の違い

| 項目 | 修正前 | 修正後 |
|---|---|---|
| Event ID 40（Chrome Sandbox） | 起動のたびに発生 | 発生しない |
| launch-failure.err | 起動のたびに更新（`Failed to get 'documents' path`） | 更新されない（クラッシュなし） |
| Claude プロセス | 起動して即終了（ウィンドウなし） | 起動して継続（ウィンドウあり） |
| `MainWindowHandle` | `0`（ウィンドウなし） | ゼロ以外（ウィンドウあり） |
| `MainWindowTitle` | `''`（空） | `'Claude'` |

---

## 成功確認の方法

以下の PowerShell コマンドで確認する：

```powershell
# Claude ウィンドウが存在するか確認
Get-Process -Name 'Claude' | Select-Object Id, MainWindowHandle, MainWindowTitle

# 結果の読み方:
# MainWindowHandle が 0 以外 かつ MainWindowTitle が 'Claude' → 起動成功
# MainWindowHandle が 0 → プロセスはあるがウィンドウなし（失敗）
```

```powershell
# launch-failure.err のタイムスタンプが更新されていないことを確認
Get-Item "$env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\launch-failure.err" |
  Select-Object LastWriteTime, Length
# → 最終起動時刻より前のタイムスタンプ ＆ サイズ変わらず = 今回はクラッシュしていない
```

---

## 再発時の確認ポイント

### 1. まず launch-failure.err を読む

```powershell
Get-Content "$env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\launch-failure.err"
```

- `Failed to get 'documents' path` → ドキュメントフォルダの設定を確認（後述）
- その他のエラー → エラー内容に応じて調査

### 2. ドキュメントフォルダの確認

```powershell
# ドキュメントフォルダの現在の設定先を確認
(Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders').Personal

# GetFolderPath が正常に動作しているか確認
[System.Environment]::GetFolderPath('MyDocuments')
# 空文字が返ったら問題あり
```

### 3. AppModel イベントログを確認

```powershell
# Chrome Sandbox の残骸エラーを確認
Get-WinEvent -LogName 'Microsoft-Windows-AppModel-Runtime/Admin' -MaxEvents 50 |
  Where-Object { $_.Id -eq 40 } |
  Select-Object TimeCreated, Message
```

- `cr.sb.odm...` が「すでに存在する」というエラーが出ていたら AppContainer の残骸を削除する

### 4. AppContainer 残骸の削除手順（再発時）

```powershell
# 残骸の確認
$base = 'HKCU:\SOFTWARE\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppContainer\Mappings'
Get-ChildItem $base | ForEach-Object {
  $m = (Get-ItemProperty $_.PSPath -Name Moniker -ErrorAction SilentlyContinue).Moniker
  if ($m -like '*cr.sb*') { Write-Host "SID: $($_.PSChildName)  Moniker: $m" }
}

# フォルダ確認
Get-ChildItem "$env:LOCALAPPDATA\Packages" | Where-Object { $_.Name -like 'cr.sb*' }
```

### 5. Documents を OneDrive から切り離す手順（再発時）

```powershell
# バックアップ
reg export 'HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' C:\temp\shell_folders_backup.reg /y

# 修正
$key = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders'
Set-ItemProperty -Path $key -Name 'Personal' -Value "$env:USERPROFILE\Documents"
```

---

## バックアップファイルの場所

| ファイル | 内容 |
|---|---|
| `C:\temp\shell_folders_backup_20260307_220148.reg` | Shell Folders レジストリバックアップ（修正前の状態、14,506 バイト） |
| `C:\Users\<ユーザー名>\Documents\claude_appcontainer_backup_20260307_214934.reg` | AppContainer Mappings レジストリバックアップ（133,574 バイト） |

---

## 関連キーワード（同じ問題で検索するときの手がかり）

- `Claude Desktop failed to Launch`
- `Failed to get 'documents' path`
- `Event ID 40`（AppModel-Runtime/Admin）
- `Chrome Sandbox` / `cr.sb.odm`
- `AppContainer` / `AppContainer already exists`
- `User Shell Folders` / `Personal`
- `OneDrive` + `Documents` リダイレクト
- `GetFolderPath('MyDocuments')` が空文字を返す
- `launch-failure.err`（Claude のエラーログ）

---

## 再発防止メモ

> **OneDrive を削除・停止・アカウントの切断を行った後は、必ず以下を確認すること。**
>
> 「ドキュメント」フォルダが OneDrive のパスを指したままになっている可能性がある。
> OneDrive が動いていない状態では `GetFolderPath('MyDocuments')` が空文字を返し、
> Electron ベースのアプリ（Claude Desktop 等）が起動しなくなることがある。
>
> **確認コマンド：**
> ```powershell
> (Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders').Personal
> ```
> パスが `C:\Users\...\OneDrive\...` になっていて OneDrive を使わない場合は、
> `C:\Users\<ユーザー名>\Documents` など存在するローカルフォルダに変更する。
