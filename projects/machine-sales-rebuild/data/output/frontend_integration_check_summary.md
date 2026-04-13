# フロント組み込み確認サマリー

- 組み込み対象件数: 66
- 通常商品: 63
- placeholder 商品: 3
- 通常商品は `displayUrl` / `galleryUrls` で表示する前提
- placeholder 商品は `imageStatus=placeholder` または `hasRealImage=false` で `画像準備中` 表示へ分岐

## ローカル確認方法

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
uv run python -m http.server 8010
```

- ブラウザで `http://127.0.0.1:8010/frontend/public-preview/index.html` を開く
- `baseImageUrl` は `frontend/public-preview/app.js` の `CONFIG.baseImageUrl` で差し替え可能
