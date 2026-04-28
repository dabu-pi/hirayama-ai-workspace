# sd_product_code 検証ライブラリ 試作メモ

## 今回作ったもの

- `scripts/lib/sd_product_code.py`
- `tests/test_sd_product_code.py`

## 提供関数

### `parse_sd_product_code(...)`

`sd_product_code` を次の要素へ分解する。

- 店舗レガシーコード
- メーカーレガシーコード
- 仕入年コード
- 通し番号3桁
- 部位レガシーコード

メーカーコード長は固定ではないため、固定幅では切らず、店舗プレフィックスと部位サフィックスをマスタ候補から最長一致で決めたうえで、残りを「メーカー + 年2桁 + 通し番号3桁」として分解する。

### `validate_sd_product_code(...)`

parse結果と期待値を照合し、`ok` / `warning` / `error` 相当の状態と理由メッセージを返す。

## 対応した検証

- 空文字
- 半角英数字以外
- 小文字混在コードは監査時に大文字化して分解
- 未知の店舗コード / メーカーコード / 部位コード
- 仕入年コードが `YY` または `MD` 以外
- 通し番号が3桁数字でない
- シート列から期待される店舗/メーカー/年/通し番号/部位との不一致
- メーカーレガシーコード重複の警告/エラー切り替え
- 旧ネック空部位コードの lenient 許容

## 実行コマンド

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
uv run python -m unittest tests.test_sd_product_code -v
```

## まだ仮の部分

- 新規採番生成そのものは未実装
- 未登録コード検知は seed CSV ベースであり、本番マスタ連携はまだ
- 旧コード例外の扱いは lenient モード中心で、最終的な運用境界は実データ確認が必要

## 実データ監査で見つかったこと

- `data/output/sd_product_code_audit.csv` では 924 件中 775 ok / 112 warning / 37 error
- warning の中心は `OT`, `LF`, `HS`, `MC`, `BM`, `IG`, `PB` の旧メーカーコード重複
- error の中心は `OOISAT041AT` など「年コード位置が `AT`」の旧例外26件、`KT` / `US` の未知メーカー旧コード、商品メーカー名とコードの不一致2件
## 2026-04-05 追記

- lenient mode では `KT -> KO`、`US -> UE` を既存データ互換 warning として扱う
- lenient mode では年コード `AT` も既存データ互換 warning として扱う
- expected maker が `EVERLAST` のときは既存コード `EL`、`LEGENDFITNESS` のときは既存コード `IV` を warning で許容する
