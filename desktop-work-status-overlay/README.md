# Work Status Overlay

Windows デスクトップ作業ステータスを常時表示する小型オーバーレイアプリ。

仮想デスクトップ 1〜3 のプロジェクト名・GPT状態・Claude状態・次アクションをコンパクトに表示。
常時最前面・半透明・ドラッグ移動可能。

## クイックスタート

```bat
run.bat
```

または（コンソールなし起動）:

```bat
scripts\start.bat
```

## 操作

| 操作 | 動作 |
|---|---|
| ヘッダードラッグ | ウィンドウ移動 |
| D1 / D2 / D3 ボタン | アクティブDesktop切替 |
| DesktopブロックをW双クリック | 編集ダイアログ |
| 右クリック | コンテキストメニュー（状態変更・編集・終了） |
| − ボタン | 折りたたみ |
| × ボタン | 終了（状態保存） |

## 動作要件

- Windows 10/11
- Python 3.10+（tkinter 同梱）
- 追加 pip インストール不要

## ファイル構成

```
desktop-work-status-overlay/
├── src/              # アプリ本体
├── data/
│   ├── state.json          # 実行時の状態（自動生成）
│   └── state.example.json  # 設定例
├── scripts/          # バッチファイル
├── docs/             # 設計ドキュメント
├── run.bat           # 起動スクリプト（コンソールあり）
└── requirements.txt
```

## ステータス種別

待機 / 設計中 / 指示作成中 / 実装中 / LiveCheck中 / テスト中 / commit中 / push中 / deploy中 / 完了 / 要確認 / エラー

## 開発計画

[ROADMAP.md](./ROADMAP.md) を参照。
