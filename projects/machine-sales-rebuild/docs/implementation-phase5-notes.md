# 実装フェーズ5 メモ

最終更新: 2026-04-05

## 今回までに作ったもの

### phase5A

- v0 雛形CSV
- 現行商品マスタ -> v0 変換スクリプト
- v0 -> `products.json` 出力スクリプト
- `sd_product_code` 検証ライブラリ
- seed CSV
- 最小 unittest

### phase5B

- 実CSV全量の再取得と v0 変換
- `sd_product_code` 全量監査
- `products.full.sample.json` 再出力
- seed 補正
- `画像1〜3` の実態監査

### 今回の画像正本探索フェーズ

- `docs/image-source-discovery.md`
- `docs/image-file-naming-hypothesis.md`
- `docs/image-storage-options.md`
- `docs/image-data-audit.md` 更新
- `docs/image-generation-phase-plan.md` 更新
- `docs/open-questions.md` 更新
- `data/raw-images/.gitkeep`
- `data/derived-images/.gitkeep`
- `references/legacy-wordpress/.gitkeep`

## 実データで確認できたこと

- 実CSVは 993行、v0 変換対象は 924件
- `source_image_count=0` が 924件すべて
- 現行 `画像1〜3` は URL 列として成立していない
- live sheet spot check でも `画像1〜3` は plain text で、`hyperlink` と `formulaValue` は確認できなかった
- 競合画像は既存 docs 上で Google Drive 保存の痕跡がある
- 自社画像は WordPress / PHP 反映経路のどこかに元資産が残っている可能性が高い

## 今回の判断

- 700x700 派生画像生成は保留
- `画像1〜3` を `source_image_urls` の正本にしない
- 自社商品画像の探索と、競合画像の探索は分けて進める
- 今後の正本保存先の第一候補は Google Drive

## まだ仮のもの

- 自社商品画像の取得経路
- 派生画像の公開URL方式
- `displayUrl` 実生成
- 背景余白色と出力形式
- 画像再生成トリガー

## 実データ確認が必要なもの

- `strongdepot-product-manager` の実体
- WordPress メディアまたは旧ローカル画像控え
- Google Drive 内の自社商品画像フォルダ
- `SANT21651AT` / `ATNT18190AT` の原票

## 次に画像生成へ進める条件

1. 元画像の正本が確定している
2. 商品コード単位で画像群を取得できる
3. 5〜10商品でテスト回収できる
4. 正本保存先と派生保存先の役割分担が決まっている

## すぐ動かせるコマンド

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'

uv run python -m scripts.transform_current_to_v0
uv run python -m scripts.audit_sd_product_code
uv run python -m scripts.export_products_json
uv run python -m unittest discover -s tests -v
```
