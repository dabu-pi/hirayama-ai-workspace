# sd_product_code 実データ監査結果

## 対象

- 入力: `data/output/product_master_v0.full.csv`
- seed: `data/seeds/settings_*.csv`
- 出力: `data/output/sd_product_code_audit.csv`
- 有効商品行: 924件

## 集計結果

| status | 件数 |
|---|---:|
| ok | 775 |
| warning | 112 |
| error | 37 |

## warning 内訳

| 内容 | 件数 | 判断 |
|---|---:|---|
| メーカー旧コード `OT` が `OLYMPIC` / `OTHER` で重複 | 43 | 既存コード保持は許容、新規採番では要選択 |
| `LF` が `LAFITNESS` / `LIFE_FITNESS` で重複 | 18 | 旧コード例外として保留 |
| `HS` が `HAMMER_STRENGTH` / `HS` で重複 | 17 | 旧コード例外として保留 |
| `MC` が `MAXICAM` / `MUSCLE_CLAMP` で重複 | 13 | 既知の衝突。新規採番は自動確定しない |
| `BM` が `BODY_MAKER` / `BODY_MASTERS` で重複 | 12 | 旧コード例外として保留 |
| `IG` が `IGNIO` / `IRON_GRIP` で重複 | 5 | 旧コード例外として保留 |
| `PB` が `PB` / `POWER_BLOCK` で重複 | 3 | 旧コード例外として保留 |
| 旧 `首` 空部位コード | 1 | 既存互換として警告付き許容、新規採番では非空コードを検討 |

## error 内訳

| 内容 | 件数 | 代表例 | 判断 |
|---|---:|---|---|
| 年セグメントが `AT` で、`YY` / `MD` として解釈できない | 26 | `OOISAT041AT`, `OOIVAT060BK`, `ATBMAT175AT` | 旧例外候補。仕入年空欄時に `AT` が入った可能性があり、仕様判断を保留 |
| メーカー不一致 | 2 | `SANT21651AT`, `ATNT18190AT` | 商品名/メーカー名と既存コードが一致していない疑い。個別確認が必要 |
| 未知メーカー旧コード `KT` | 4 | `HYKT16087AT`, `HYKT21665AT` | `KOMATSU` 実コードが `KT` になっている旧例外候補。ルール表は `KO` のため保留 |
| 未知メーカー旧コード `US` | 5 | `HYUS20485AT`, `SAUS20473AT` | `UESAKA` 実コードが `US` になっている旧例外候補。ルール表は `UE` のため保留 |

## 実装で補正したこと

- `sd_product_code` パーサは入力コードを大文字化してから分解するように変更した
- `Bm`, `Hs`, `Ig`, `MIIg...` のような大小文字混在コードは、既存値を壊さず監査できるようになった
- `HOIST` の旧コード `HT` を seed に追加した

## まだ保留の値

- `KOMATSU=KT` を seed に正式追加するか、旧例外として別管理するか
- `UESAKA=US` を seed に正式追加するか、旧例外として別管理するか
- `年コード=AT` 行を「旧ルール上の例外」として許容するか、データ修正対象にするか
- `EVERLAST=EL` のように既存メーカーコードと衝突し得る未登録メーカーを seed に入れるか

## 実行コマンド

```powershell
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.audit_sd_product_code --input data\output\product_master_v0.full.csv --seed-dir data\seeds --output data\output\sd_product_code_audit.csv
```
## 2026-04-05 phase5B 再実行（案件フォルダ再編後）

### 集計

| status | 件数 |
|---|---:|
| ok | 774 |
| warning | 148 |
| error | 2 |

### 今回 warning に落とした旧コード

- `KT -> KO` (`KOMATSU`) 4件
- `US -> UE` (`UESAKA`) 5件
- 年コード `AT` 19件
- `EL` を `EVERLAST` の既存コードとして許容 1件
- `IV` を `LEGENDFITNESS` の既存コードとして許容 1件

### まだ error のまま残るもの

- `SANT21651AT`: expected `MX`, got `NT`
- `ATNT18190AT`: expected `PB`, got `NT`

### 判断

- 上記2件は seed で吸収せず、現行シート値または旧コードのどちらが正しいかを個別確認する
- `KT` / `US` / 年コード `AT` は既存データ互換として継続許容でよい
