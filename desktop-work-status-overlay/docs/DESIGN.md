# DESIGN.md — Work Status Overlay 設計書

## アーキテクチャ

```
main.py
  └─ StateStore (state.json の読み書き)
  └─ OverlayWindow (tkinter UI)
       ├─ header (ドラッグハンドル / 最小化 / 閉じる)
       ├─ body
       │    ├─ DeskBlock × 3  (D1 / D2 / D3)
       │    └─ separator
       └─ footer (時計)
```

## ウィンドウ設計

| 項目 | 設定 |
|---|---|
| フレームレス | `overrideredirect(True)` |
| 常時最前面 | `wm_attributes("-topmost", True)` |
| 透明度 | `wm_attributes("-alpha", 0.92)` |
| 初期位置 | 画面右端 – 340px, Y=40 |
| ドラッグ | ButtonPress-1 + B1-Motion でヘッダー移動 |
| 位置保存 | `data/state.json` に x/y を保存 |

## カラーパレット (Catppuccin Mocha 系)

| 用途 | カラー |
|---|---|
| 背景 | `#1E1E2E` |
| ヘッダー背景 | `#181825` |
| アクティブDesktop | `#313244` |
| テキスト | `#CDD6F4` |
| GPTステータス | `#89B4FA` (blue) |
| Claudeステータス | `#FAB387` (peach) |
| エラー | `#F38BA8` (red) |
| 完了 | `#A6E3A1` (green) |

## インタラクション

| 操作 | 動作 |
|---|---|
| D1 / D2 / D3 ボタン単押し | アクティブDesktop切替 |
| DesktopブロックをダブルクリックH | 編集ダイアログ |
| 右クリック | コンテキストメニュー |
| ヘッダードラッグ | ウィンドウ移動 |
| − ボタン | ボディ折りたたみ |
| × ボタン | 状態保存して終了 |

## データ構造

```json
{
  "activeDesktop": 1,
  "window": { "x": 1560, "y": 40, "opacity": 0.92 },
  "desktops": {
    "1": {
      "projectName": "JREC-SF01",
      "gptStatus": "設計中",
      "claudeStatus": "待機",
      "memo": "API連携方針確認",
      "updatedAt": "2026-05-06T08:00:00+09:00"
    }
  }
}
```

## ファイル構成

```
desktop-work-status-overlay/
├── src/
│   ├── main.py           # エントリポイント
│   ├── config.py         # 定数・カラー・デフォルト状態
│   ├── models.py         # DesktopState dataclass
│   ├── state_store.py    # JSON読み書き・オートセーブ
│   └── overlay_window.py # tkinter UIメイン
├── data/
│   ├── state.json        # 実動作用（.gitignore対象外）
│   └── state.example.json
├── scripts/
│   ├── install.bat
│   └── start.bat
├── docs/
│   ├── DESIGN.md         # このファイル
│   └── WINDOWS_NOTES.md
├── run.bat
└── requirements.txt
```

## 設計判断ログ

| 判断 | 理由 |
|---|---|
| tkinter 採用 | PySide6/PyQt6 未インストール。Phase 1 は依存ゼロで動くことを優先 |
| overrideredirect | フレームレスでコンパクトな外観を実現 |
| JSON保存 | 軽量・デバッグ容易・他ツール連携可能 |
| 30秒オートセーブ | 強制終了時のデータロスを最小化 |
| Phase 1 は手動管理 | 仮想デスクトップAPIは不安定なため、まず手動管理で使い勝手を確認 |
