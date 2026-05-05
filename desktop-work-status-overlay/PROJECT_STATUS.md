# PROJECT_STATUS.md — Work Status Overlay

## 現在のステータス

| 項目 | 内容 |
|---|---|
| フェーズ | Phase 1 完了 |
| 状態 | 実装済み・起動確認済み |
| 最終更新 | 2026-05-06 |

## 実装済み機能

- tkinter オーバーレイウィンドウ（フレームレス・常時最前面・半透明）
- Desktop 1/2/3 ステータス表示（projectName / GPT / Claude / memo）
- アクティブDesktop切替（D1/D2/D3 ボタン）
- 右クリックコンテキストメニュー
- ダブルクリック編集ダイアログ
- JSON保存（data/state.json）・30秒オートセーブ
- ウィンドウ位置保存・再起動後の復元
- ヘッダードラッグ移動
- 折りたたみ（− ボタン）
- 時計表示（右下、1分更新）

## 起動方法

```bat
cd C:\hirayama-ai-workspace\workspace\desktop-work-status-overlay
run.bat
```

または（バックグラウンド起動）:

```bat
scripts\start.bat
```

## ファイル一覧

| ファイル | 役割 |
|---|---|
| `src/main.py` | エントリポイント |
| `src/config.py` | 定数・カラー・デフォルト状態 |
| `src/models.py` | DesktopState dataclass |
| `src/state_store.py` | JSON読み書き |
| `src/overlay_window.py` | tkinter UI メイン |
| `data/state.example.json` | 設定例 |
| `run.bat` | コンソールあり起動 |
| `scripts/start.bat` | バックグラウンド起動 |
| `docs/DESIGN.md` | 設計書 |
| `docs/WINDOWS_NOTES.md` | Windows固有メモ |

## 次フェーズ計画

- Phase 2: ホットキー（`keyboard` ライブラリ）
- Phase 3: ウィンドウ検出・ログ出力
- Phase 4: 仮想デスクトップ自動検出調査

詳細は [ROADMAP.md](./ROADMAP.md) を参照。

## 再開手順

1. `git pull`（ブランチ: `feature/auto-dev-phase3-loop`）
2. `PROJECT_STATUS.md` を読む（このファイル）
3. `run.bat` で起動確認
4. 追加機能は ROADMAP.md を参照して実装
