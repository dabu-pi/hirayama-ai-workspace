# ROADMAP.md — Work Status Overlay

## Phase 1 — 手動管理 + 常時表示（完了）

- [x] 小型オーバーレイウィンドウ（tkinter）
- [x] 常時最前面 / 半透明
- [x] 画面右端に表示（初期位置）
- [x] ドラッグで移動可能
- [x] Desktop 1/2/3 のステータス表示
- [x] 各Desktopに projectName / gptStatus / claudeStatus / memo を設定
- [x] アクティブDesktopを手動切替
- [x] 右クリックメニューで状態変更
- [x] ダブルクリックで編集ダイアログ
- [x] JSON保存 / 再起動後に状態復元
- [x] ウィンドウ位置の保存
- [x] 30秒オートセーブ
- [x] 折りたたみ（− ボタン）

## Phase 2 — ホットキー + 時間表示

- [ ] ホットキー対応
  - Ctrl+Alt+1/2/3: Desktop切替
  - Ctrl+Alt+G: GPT状態ローテーション
  - Ctrl+Alt+C: Claude状態ローテーション
- [ ] 作業開始時刻・経過時間表示
- [ ] 最終更新からの経過時間（"3分前" 表示）
- [ ] DPI対応 (`SetProcessDpiAwareness`)
- [ ] Windows起動時の自動起動設定スクリプト
- [ ] 表示テーマ選択（ライト / ダーク）

依存追加予定: `keyboard`

## Phase 3 — ウィンドウ検出 / ログ出力

- [ ] ChatGPT / Claude / PowerShell / VS Code のウィンドウ検出
- [ ] ウィンドウタイトルから状態を半自動判定
- [ ] Desktopごとに repo path を登録
- [ ] git branch / status の表示
- [ ] 作業ログを `logs/YYYY-MM-DD.md` に出力

依存追加予定: `pywin32`, `psutil`

## Phase 4 — 仮想デスクトップ自動検出

- [ ] `IVirtualDesktopManager` COM 調査
- [ ] `pyvda` ライブラリの安定性検証
- [ ] 現在の仮想デスクトップを自動ハイライト
- [ ] 難しい場合は手動運用を継続

## 技術的負債・既知の制限

| 制限 | 内容 | 対応予定 |
|---|---|---|
| フォント | Meiryo UI 未インストール環境でフォールバック | Phase 2 で設定化 |
| DPI | 150%/200%スケール環境で座標ズレの可能性 | Phase 2 で対応 |
| フルスクリーン | 全画面アプリ起動時にオーバーレイが隠れる | Phase 4 以降で検討 |
| 仮想デスクトップ | 自動検出なし（手動切替） | Phase 4 で検討 |
