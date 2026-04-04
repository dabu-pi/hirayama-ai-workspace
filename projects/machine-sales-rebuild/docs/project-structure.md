# プロジェクト構造

## ルート

`projects/machine-sales-rebuild/`

## 配下構造

```text
machine-sales-rebuild/
├─ README.md
├─ PROJECT_STATUS.md
├─ docs/
├─ data/
│  ├─ raw/
│  ├─ templates/
│  ├─ seeds/
│  ├─ samples/
│  └─ output/
├─ scripts/
│  └─ lib/
├─ tests/
├─ config/
├─ references/
│  ├─ legacy-gas/
│  ├─ php-notes/
│  └─ source-memos/
└─ tmp/
```

## 運用ルール

- この案件の作業は project root に移動してから行う
- Python 実行は `uv run python -m ...`
- 実データCSVは `data/raw/`
- seed は `data/seeds/`
- 生成物は `data/output/`
- 参考メモや旧資産の置き場は `references/`

## 例

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
uv run python -m scripts.transform_current_to_v0
```
