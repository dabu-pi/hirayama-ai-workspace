# WINDOWS_NOTES.md — Windows固有の注意事項

## 動作確認環境

- Windows 11 Home (Build 26200)
- Python 3.13.1
- tkinter 8.6

## 仮想デスクトップの制限

Windows の仮想デスクトップ（Task View）には公式 API がない。
Phase 1 は **手動でアクティブDesktopを切り替える** 運用とする。

Phase 4 で以下を調査予定:
- `IVirtualDesktopManager` COM インターフェース（非公開API）
- `pywin32` + ctypes での実験的取得
- 第三者ライブラリ `pyvda` の安定性確認

## DPI スケーリング

高解像度ディスプレイ（150%/200%スケール）では tkinter の座標系がズレる場合がある。
対処: `SetProcessDPIAware()` をアプリ起動時に呼ぶ（Phase 2 で追加予定）。

```python
import ctypes
ctypes.windll.shcore.SetProcessDpiAwareness(1)
```

## フォント

`Meiryo UI` を使用。Windows 10/11 に標準搭載。
未インストール環境では tkinter がシステムデフォルトフォントにフォールバックする（文字化けなし）。

## タスクバーへの非表示

`overrideredirect(True)` 設定により、タスクバーに表示されない。
アプリを閉じる手段: × ボタン / 右クリックメニュー「終了」

## 常時最前面の制限

フルスクリーンアプリ（ゲーム等）起動時はオーバーレイが隠れる場合がある。
Phase 1 では許容する。

## Windows起動時の自動起動（Phase 2 予定）

スタートアップフォルダにショートカットを置く方法:
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
```
`scripts\start.bat` のショートカットをここに配置する。

## pythonw.exe について

`scripts\start.bat` では `pythonw` を使用してコンソールウィンドウを非表示にする。
デバッグ時は `run.bat`（python）を使い、標準出力を確認できるようにする。
