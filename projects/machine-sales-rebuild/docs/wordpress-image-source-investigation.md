# WordPress画像回収可能性調査

最終更新: 2026-04-05

## 目的

`machine-group.net` の公開側から、WordPress メディア由来の画像 URL と商品ページの対応をどこまで回収できるかを確認する。

## 今回確認したURL

- `https://machine-group.net/`
- `https://machine-group.net/products/hycy26924at/`
- `https://machine-group.net/products/hynt23899at/`

## 今回確認できた事実

### 1. 公開トップページに WordPress メディア由来の画像パターンがある

トップページの新着商品カードで、次のような対応を確認した。

| 商品ページURL | 画像URL断片 | 見えた規則 |
|---|---|---|
| `https://machine-group.net/products/hycy26924at/` | `wp-content/uploads/HYCY26924AT_1.png` | slug は小文字商品コード、画像は大文字商品コード + `_1` |
| `https://machine-group.net/products/hynt23899at/` | `wp-content/uploads/HYNT23899AT_1.jpg` | 同上 |
| `https://machine-group.net/products/hyot23888at/` | `wp-content/uploads/HYOT23888AT_1.jpg` | 同上 |

トップページのHTML断片では、少なくとも 13 件の商品カードで

- `/products/<小文字の商品コード>/`
- `wp-content/uploads/<大文字の商品コード>_1.<拡張子>`

の組み合わせが見えた。

### 2. 商品詳細ページに画像ギャラリーと商品コードが同居している

詳細ページ 2 件で、次の情報を確認した。

- `og:url` は `/products/<小文字の商品コード>/`
- ギャラリー画像は `../../wp-content/uploads//<大文字の商品コード>_<枝番>.<拡張子>`
- ページ内テーブルに商品コード表示がある
- hidden input `product-code` にも同じ商品コードが入っている

確認例:

| 商品ページURL | 商品コード表示 | 画像例 |
|---|---|---|
| `https://machine-group.net/products/hycy26924at/` | `HYCY26924AT` | `HYCY26924AT_1.png`, `HYCY26924AT_2.png` |
| `https://machine-group.net/products/hynt23899at/` | `HYNT23899AT` | `HYNT23899AT_1.jpg`, `HYNT23899AT_2.jpg` |

### 3. 公開画像URLは実際に取得できる

サンプル確認:

| URL | 確認結果 |
|---|---|
| `https://machine-group.net/wp-content/uploads/HYCY26924AT_1.png` | `200` |
| `https://machine-group.net/wp-content/uploads/HYNT23899AT_1.jpg` | `200` |
| `https://machine-group.net/wp-content/uploads/HYCY26924AT_1.jpg` | `404` |

このため、公開HTMLに見える URL をそのまま回収候補にできる可能性は高い。ただし、拡張子違いの当て推量は危険。

### 4. `og:image` は補助情報としては弱い

`hycy26924at` の詳細ページでは

- `og:image = ../../wp-content/uploads//HYCY26924AT_1.jpg`
- 実際のギャラリー本文 = `HYCY26924AT_1.png`, `HYCY26924AT_2.png`

になっていた。実ファイル確認では `.jpg` は `404`、`.png` は `200` だった。

したがって、回収時の優先順位は

1. 本文ギャラリーの `img src`
2. サムネイル画像
3. hidden `product-code`
4. `og:image`

の順にする方が安全。

## 今回の観察から分かるURLパターン

### 商品ページ

```text
https://machine-group.net/products/{sd_product_code_lower}/
```

### 画像URL

```text
https://machine-group.net/wp-content/uploads/{SD_PRODUCT_CODE_UPPER}_{seq}.{ext}
```

例:

```text
https://machine-group.net/wp-content/uploads/HYCY26924AT_1.png
https://machine-group.net/wp-content/uploads/HYCY26924AT_2.png
https://machine-group.net/wp-content/uploads/HYNT23899AT_1.jpg
https://machine-group.net/wp-content/uploads/HYNT23899AT_2.jpg
```

## 今回のサンプルで見えなかったもの

- `uploads/yyyy/mm/` の日付フォルダ
- `-300x300` / `-700x700` のサイズサフィックス
- `srcset` によるサイズ違い配信

少なくとも今回見た公開HTMLでは、`uploads` 直下に商品コードベースのファイルが置かれているように見える。

## 商品との紐付け可能性

現時点では、`sd_product_code` による紐付け可能性が高い。

根拠:

- 商品ページ slug が商品コード小文字
- ページ内商品コード表示が商品コード大文字
- 画像ファイル名が商品コード大文字 + 枝番

この 3 点が一致している。

## 回収元候補としての評価

### 使える点

- 公開HTMLだけで商品ページと画像URLの対応がある程度拾える
- 商品コードベースで機械的に結び付けやすい
- 1商品複数画像の痕跡がある

### 弱い点

- `og:image` と本文ギャラリーで拡張子が食い違う例がある
- 公開されていない商品、売却済み商品、下書き商品の画像は拾えない可能性がある
- WordPress 側で手作業更新された履歴があるため、公開HTMLだけでは元画像の完全性を保証できない

## 現時点の判断

`machine-group.net` の WordPress メディアは、**過去資産の回収元候補としては現実的**。

ただし、**今後の正本そのものとしては弱い**。

したがって、

- 短期: WordPress 公開画像から回収可能性を検証する
- 中期: 回収した画像を Google Drive 正本へ寄せる

という二段構えが妥当。

## 小規模回収テスト結果

2026-04-05 時点で、公開商品 6 件を対象に小規模回収テストを実施した。

- 対象商品数: 6
- 成功商品数: 6
- 失敗商品数: 0
- 保存できた画像枚数: 15
- 抽出元: すべて本文ギャラリー `img src`

商品別の取得結果:

| sd_product_code | slug | 取得枚数 | 主な拡張子 | 結果 |
|---|---|---:|---|---|
| `HYCY26924AT` | `hycy26924at` | 2 | png | 成功 |
| `HYNT23899AT` | `hynt23899at` | 2 | jpg | 成功 |
| `HYMX26923AT` | `hymx26923at` | 2 | png | 成功 |
| `HNOT24914AT` | `hnot24914at` | 2 | jpg | 成功 |
| `HYNT23900AT` | `hynt23900at` | 2 | jpg | 成功 |
| `HYOT23888AT` | `hyot23888at` | 5 | jpg | 成功 |

保存先は次の一時回収構造にそろえた。

```text
data/raw-images/wordpress-recovery-sample/<sd_product_code>/<元URLのファイル名>
```

例:

```text
data/raw-images/wordpress-recovery-sample/HYCY26924AT/HYCY26924AT_1.png
data/raw-images/wordpress-recovery-sample/HYOT23888AT/HYOT23888AT_5.jpg
```

補足:

- 回収画像は一時回収物としてローカル保存し、Git 管理対象にはしていない
- 元URL、HTTP status、保存先は `data/output/wordpress_recovery_results.csv` に残している

## 小規模回収で安定していたルール

- 商品ページURLは `/products/<sd_product_code小文字>/`
- ページ内 hidden `product-code` は target の `sd_product_code` と一致した
- 本文ギャラリー `img` の `src` から、商品コードを含む `wp-content/uploads/<SD_PRODUCT_CODE>_<seq>.<ext>` を安定して拾えた
- `jpg` / `png` 混在でも、HTMLに出ている実URLをそのまま使えば問題なかった

## 小規模回収で不安定または未確認の点

- `og:image` は本文ギャラリーと拡張子が食い違う例があるため、主ソースにしない
- 今回の 6 件はすべて公開商品で、非公開商品や売却済み商品の回収可否は未確認
- 今回は `srcset` 優先取得が必要なページには当たらなかった
- 公開HTMLだけで全件分の元画像が揃うかはまだ不明

## 公開商品の全件回収結果

2026-04-05 時点で、`product_master_v0.full.csv` から抽出した `public` 商品 66 件を対象に、公開側の全件回収を実施した。

- 対象商品数: 66
- 成功商品数: 66
- 失敗商品数: 0
- 保存画像総数: 163
- 画像0枚商品数: 0

画像枚数分布:

| 画像枚数 | 商品数 |
|---:|---:|
| 1枚 | 21 |
| 2枚 | 16 |
| 3枚 | 16 |
| 4枚 | 7 |
| 5枚 | 3 |
| 6枚 | 2 |
| 7枚 | 1 |

拡張子分布:

| 拡張子 | 枚数 |
|---|---:|
| jpg | 149 |
| png | 14 |

保存先:

```text
data/raw-images/wordpress-public/<sd_product_code>/<元URLファイル名>
```

manifest:

- `data/output/public_image_manifest.csv`

回収結果:

- `data/output/wordpress_recovery_public_results.csv`
- `data/output/wordpress_recovery_public_failures.csv`
- `data/output/wordpress_public_recovery_summary.csv`

## 公開商品の全件回収で安定していたルール

- 対象抽出は `publish_status=public` かつ `sold_out_flag=False`
- 商品ページURLは `/products/<sd_product_code小文字>/`
- ページ内 hidden `product-code` と `sd_product_code` の整合が取れていた
- 本文ギャラリー `img src` から `wp-content/uploads/<SD_PRODUCT_CODE>_<seq>.<ext>` を安定して取得できた
- 画像ファイル名の連番で manifest の `image_seq` を組めた
- `jpg` / `png` 混在でも、HTMLに出ている URL をそのまま使えば問題なかった

## 公開商品の全件回収で見えたこと

- 公開商品の範囲では、WordPress 公開側を「回収元」として実務上使える水準にある
- 少なくとも今回の `public` 66 件については、次フェーズの 700x700 生成に必要な元画像入力を揃えられた
- 一方で、これはあくまで公開商品に限った話であり、非公開・売却済み・下書き相当までは保証しない

## 次にやること

1. 公開商品について、700x700 派生画像生成フェーズへ進む
2. 非公開商品・売却済み商品の画像が WordPress から拾えるかどうかを別経路で確認する
3. `strongdepot-product-manager` / 旧 WordPress 資産の実体を引き続き探索する
