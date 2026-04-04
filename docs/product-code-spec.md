# 商品コード仕様書（現行確定版＋移行方針）

最終更新: 2026-04-04

## 目的

現行の `新規自動生成商品コード` の構造とマスタ定義、例外、実装上の問題点を整理し、新システムでも互換性を維持すべき部分と、設計として見直すべき部分を明確にする。

## 現行の商品コード構造

`ネットショップ商品一覧GAS.txt` の `createProductCode()` では、商品コードは次の順で連結される。

```text
商品コード = 店舗コード + メーカーコード + 仕入年コード + 通し番号3桁 + 部位コード
```

### コード例

| 商品コード例 | 分解 | 読み方 |
|---|---|---|
| `OOCY16003LG` | `OO` + `CY` + `16` + `003` + `LG` | 大阪本部 / CYBEX / 2016年仕入 / 通し番号003 / 脚 |
| `OOB116001AT` | `OO` + `B1` + `16` + `001` + `AT` | 大阪本部 / B1 / 2016年仕入 / 通し番号001 / その他 |
| `HYIC24909AT` | `HY` + `IC` + `24` + `909` + `AT` | 兵庫 / ICARIAN / 2024年仕入 / 通し番号909 / その他 |

## 構成要素の仕様

| 要素 | 元データ列 | 現行GASマスタ | 形式 | 現行仕様 |
|---|---|---|---|---|
| 店舗コード | `店舗` | `shops` 配列 | 2文字想定 | 店舗名をコード化。空欄は `AT` |
| メーカーコード | `メーカー名` | `makers` 配列 | 2文字中心だが例外あり | メーカー名をコード化。空欄は `OT` |
| 仕入年コード | `仕入れ年` | `buyYears` 配列 | 2文字 | `15`〜`35`、`MD`、空欄 `AT` |
| 通し番号 | `通し番号` | なし | 3桁ゼロ埋め | `('000' + 通し番号).slice(-3)` で末尾3桁 |
| 部位コード | `鍛える部位` | `bodyParts` 配列 | 0〜2文字 | 部位名をコード化。空欄は `AT`。`首` は空文字 |

## 店舗コード一覧

| 店舗名 | 店舗コード | WordPressカテゴリ |
|---|---|---|
| 空欄 | `AT` | 空 |
| 大阪本部 | `OO` | `shops,honbu` |
| 大阪粉浜 | `OK` | `shops,kohama` |
| 大阪今里 | `OI` | `shops,imazato` |
| 大阪山下 | `OY` | `shops,yamashita` |
| 埼玉 | `SA` | `shops,saitama` |
| 三重 | `MI` | `shops,mie` |
| 兵庫 | `HY` | `shops,hyogo` |
| 兵庫西脇 | `HN` | `shops,hyogo` |
| 山口 | `YA` | `shops,yamaguchi` |
| 愛媛 | `EH` | `shops,ehime` |
| 熊本 | `KU` | `shops,kumamoto` |
| メーカー直送 | `MD` | `shops,makerdirect` |

## 仕入年コード一覧

| 仕入れ年入力値 | 仕入年コード |
|---|---|
| メーカー直送 | `MD` |
| 空欄 | `AT` |
| MD | `MD` |
| 15 | `15` |
| 16 | `16` |
| 17 | `17` |
| 18 | `18` |
| 19 | `19` |
| 20 | `20` |
| 21 | `21` |
| 22 | `22` |
| 23 | `23` |
| 24 | `24` |
| 25 | `25` |
| 26 | `26` |
| 27 | `27` |
| 28 | `28` |
| 29 | `29` |
| 30 | `30` |
| 31 | `31` |
| 32 | `32` |
| 33 | `33` |
| 34 | `34` |
| 35 | `35` |

## 部位コード一覧

| 鍛える部位 | 部位コード | WordPressカテゴリ |
|---|---|---|
| 空欄 | `AT` | 空 |
| 首 | 空文字 | `trainingparts,neck` |
| 胸 | `CH` | `trainingparts,chest` |
| 背中 | `BK` | `trainingparts,back` |
| 腕 | `AM` | `trainingparts,arm` |
| 肩 | `SH` | `trainingparts,shoulder` |
| 腹 | `AB` | `trainingparts,ab` |
| 脚 | `LG` | `trainingparts,leg` |
| 尻 | `HP` | 空 |
| その他 | `AT` | `trainingparts,other` |
| マルチ | `AT` | `trainingparts,multi` |
| 有酸素運動 | `AT` | `trainingparts,aerobicexercise` |
| 備品 | `BI` | 空 |

## メーカーコード一覧

現行GAS `makers` 配列を正として整理した。表記ゆれが多いため、同一コードへ寄せている別名も併記する。

| メーカー表記 | メーカーコード | WordPressカテゴリ | 備考 |
|---|---|---|---|
| 空欄 | `OT` | 空 | 未設定時のデフォルト |
| ATLAS | `AL` | `maker,atlas` |  |
| B1 | `B1` | `maker,b1` |  |
| BODY MAKER | `Bm` | `maker,bodymaker` | 小文字混在 |
| BODY MASTERS / ボディマスター | `BM` | `maker,bodymasters` |  |
| BODY SOLID | `BS` | `maker,bodysolid` |  |
| BULL / ブル | `BL` | `maker,bull` |  |
| BOWFLEX | `BF` | `maker,bowflex` |  |
| CYBEX | `CY` | `maker,cybex` |  |
| COMPASS | `CP` | `maker,compass` |  |
| DYNA FORCE | `DF` | `maker,dynaforce` |  |
| EG | `EG` | `maker,eg` |  |
| ELEIKO | `EL` | `maker,eleiko` |  |
| FIGHTING ROAD / FIGHTINGROAD | `FR` | `maker,fightingroad` | 表記ゆれ吸収 |
| FLEX | `FL` | `maker,flex` |  |
| FREEMOTION | `FM` | `maker,freemotion` |  |
| GARAXY / ギャラクシー | `GX` | `maker,garaxy` | 綴りが `GALAXY` ではなく `GARAXY` |
| GOLDGYM | `GG` | `maker,goldgym` |  |
| GPI | `GP` | `maker,gpi` |  |
| GOLIATH LABS | `GL` | `maker,gl` |  |
| HANMER STRENGTH / HANMERSTRENGTH / HAMMER STRENGTH / HAMMERSTRENGTH / ハンマーストレングス | `HS` | `maker,hammerstrength` | 誤字・表記ゆれを広く吸収 |
| HIROTEC | `HR` | `maker,hirotec` |  |
| HOIST | `HT` | `maker,hoist` |  |
| ホイスト | `HOISUT` | `maker,hoist` | 6文字コードで、2文字前提を壊す例外 |
| HORIZON | `HZ` | `maker,horizon` |  |
| HS | `Hs` | `maker,hs` | 小文字混在 |
| ICARIAN | `IC` | `maker,icarian` |  |
| IGNIO | `Ig` | `maker,ignio` | 小文字混在 |
| Impulse | `IP` | `maker,impulse` |  |
| INTER RIHA | `IR` | `maker,interriha` |  |
| INSHAPE | `IS` | `maker,inshape` |  |
| IRON GRIP / IRONGRIP | `IG` | `maker,irongrip` |  |
| IROTEC | `IT` | `maker,irotec` |  |
| IVANKO | `IV` | `maker,ivanko` |  |
| KOMATSU | `KT` | `maker,komatsu` |  |
| コマツ | `KOMATSU` | `maker,komatsu` | 7文字コードで、2文字前提を壊す例外 |
| KEISER | `KS` | `maker,keiser` |  |
| LIFE FITNESS | `LF` | `maker,lifefitness` |  |
| LAFITNESS | `Lf` | `maker,lafitness` | 小文字混在 |
| MAGNUM / マグナム | `MG` | `maker,magnum` |  |
| MATRIX | `MX` | `maker,matrix` |  |
| MAXICAM | `MC` | `maker,maxicam` |  |
| MUSCLE CLAMP / マッスルクランプ | `MC` | `maker,muscleclamp` | `MAXICAM` と同じ `MC` で衝突 |
| NAUTILUS / Nautilus / ノーチラス | `NT` | `maker,nautilus` |  |
| NIPPYO | `NP` | `maker,nippyo` |  |
| NISHI | `NS` | `maker,nishi` |  |
| NO BRAND / NOBRAND / ノーブランド | `NB` | `maker,nobrand` |  |
| PARAMOUNT / パラマウント | `PM` | `maker,paramount` |  |
| POWER BLOCK | `PB` | `maker,powerblock` |  |
| POWERTECH | `pt` | `maker,powertech` | 小文字コード |
| PRECOR | `PR` | `maker,precor` |  |
| PT | `PT` | `maker,pt` |  |
| RB | `RB` | `maker,rb` |  |
| ReeBok | `RE` | `maker,re` |  |
| ROGUE | `RG` | `maker,rogue` |  |
| SCHWINN | `SW` | `maker,schwinn` |  |
| SENOH | `SN` | `maker,senoh` |  |
| STAR TRAC | `ST` | `maker,startrac` |  |
| STRONG DEPOT / STRONGDEPOT | `SD` | `maker,strongdepot` |  |
| TECA | `TC` | `maker,teca` |  |
| TECHNOGYM | `TG` | `maker,technogym` |  |
| TITAN | `TT` | `maker,titan` |  |
| THINK FITNESS | `TF` | `maker,thinkfitness` |  |
| TUFFSTUFF | `TS` | `maker,tuffstuff` |  |
| UNIVERSAL | `UV` | `maker,universal` |  |
| UESAKA | `US` | `maker,uesaka` |  |
| YORK | `YK` | `maker,york` |  |
| YY | `YY` | `maker,yy` |  |
| ZIVA / Ziva / ziva | `ZV` | `maker,ziva` |  |
| 酒井医療 | `SI` | `maker,sakaiiyaku` |  |
| 鍛錬 | `TR` | `maker,tanren` |  |
| その他 | `OT` | `maker,other` |  |

## 状態コード / 公開コード（参考）

商品コード本体には直接入らないが、商品反映の周辺仕様として WordPress 出力にも使われている。

| 状態入力 | product_status | WordPressカテゴリ |
|---|---|---|
| 新品 | `is_brandnew` | `status,brandnew` |
| 中古 | `is_used` | `status,used` |
| 展示品 / 展示 | `is_exhibit` | `status,exhibit` |
| 売却 / 売却済み / 売却済 | `is_sold` | `status,sold` |
| 未使用 / 未使用品 | `is_unused` | `status,unused` |
| リファービッシュ品 / リファービッシュ | 空文字 | `status,refurbish` |
| 旧モデル品 / 旧モデル | `is_prevmodel` | `status,prevmodel` |
| 空欄 | 空文字 | 空 |

| 公開状態入力 | post_status |
|---|---|
| 非公開 | `private` |
| 空欄 | `publish` |

## 空白・未設定時の扱い

| 入力項目 | 空欄時の現行扱い | 注意点 |
|---|---|---|
| 店舗 | `AT` | つまり未設定でも商品コード先頭2文字が入る |
| メーカー名 | `OT` | 未設定商品はすべて `OT` に寄る |
| 仕入れ年 | `AT` | 年未設定と店舗未設定が同じ `AT` になり、文脈なしでは意味が読みにくい |
| 鍛える部位 | `AT` | `その他` / `マルチ` / `有酸素運動` も `AT` に寄る |
| 通し番号 | `('000' + 値).slice(-3)` | 1000以上は末尾3桁だけ残るため、理論上は重複し得る |

## 例外・要注意ルール

| 種別 | 内容 | 影響 |
|---|---|---|
| メーカーコード長が固定でない | 多くは2文字だが、`ホイスト=HOISUT`、`コマツ=KOMATSU` のような長いコードが混在 | 商品コードの位置切り出しを「2+2+2+3+2固定」で行うと壊れる |
| メーカーコード衝突 | `MAXICAM=MC` と `MUSCLE CLAMP=MC` が同一コード | コードだけではメーカーを一意復元できない |
| 小文字混在 | `Bm`、`Hs`、`Ig`、`Lf`、`pt` などがある | 大文字正規化をすると現行コード互換が崩れる可能性 |
| 首の部位コードが空文字 | `首` は `''` | コード末尾に部位コードが付かない商品があり得る |
| 通し番号3桁切り詰め | `slice(-3)` で末尾3桁だけ残す | `1001` と `1` が同じ `001` になり得る |
| マスタ未一致時の前行値残り | `shopCode` / `makerCode` / `buyYearCode` / `bodyPartCode` を行ループ内で初期化していない | 未知の店舗名/メーカー名/部位名が入ると、前行の商品コード要素が流用される可能性がある |
| マスタ二重/三重管理 | `ルール` シート、GAS配列、PHP `Settings.php` の3箇所に近い情報がある | 一箇所だけ更新すると商品コード・サイトカテゴリ・表示がずれる |

## 商品コード仕様は将来も維持すべきか

### 維持した方がよいもの

- 既存商品との照合キーとして、現行 `SD商品コード` 文字列そのものは維持する
- 運用者が商品を口頭/メールで識別するときの慣れがあるなら、表示用コードとしても残す
- 既存見積・案件台帳・過去資料に埋まっているコードとの互換性を保つ

### 見直した方がよいもの

- 商品コードの各セグメントに業務ロジックを過度に背負わせない
- 未設定や例外で `AT` / 空文字 / 長いメーカーコードが混じる状態を、新規生成分ではそのまま増やさない
- メーカー・店舗・部位・年は、商品コード文字列から復元するのではなく、独立列/独立マスタで持つ
- 新システム内部の主キーは `product_id` など別IDを採用し、`sd_product_code` は業務上の外部コードとして保持する

## 新システムへの引継ぎ方針

| 項目 | 方針 |
|---|---|
| 既存商品コード | 既存行は現行 `新規自動生成商品コード` をそのまま `sd_product_code` として保存し、再計算で上書きしない |
| 新規商品コード生成 | 当面は現行互換の `店舗 + メーカー + 年 + 3桁連番 + 部位` を維持。ただしマスタ未一致時はエラーにして前行値流用を禁止する |
| コード構成要素 | `location_code`、`maker_code`、`purchase_year_code`、`serial_no`、`body_part_code` を独立列で保持し、生成結果と分離する |
| メーカーマスタ | `maker_name_raw`、`maker_name_normalized`、`maker_code`、`legacy_wp_category` を分け、表記ゆれを1箇所で管理する |
| コード長例外 | 既存データ互換のため旧コードは許容するが、新規マスタではメーカーコード長や衝突を再設計する |
| WordPressカテゴリ | 商品コード仕様から切り離し、サイト出力ビュー側の分類マッピングとして扱う |
| 検証 | 現行商品マスタの代表100件程度で、既存コードと新生成ロジックの一致テストを行う |

## 今回新たに確定したこと

- 現行商品コードは `店舗 + メーカー + 仕入年 + 通し番号3桁 + 部位` の順で、GAS `createProductCode()` が生成している。
- 空欄時のデフォルト値や、`首` の空部位コード、メーカー表記ゆれ、メーカーコード衝突など、現行の例外仕様を整理できた。

## まだ未確定のこと

- `ルール` シート側マスタと GAS配列の差分全量
- 既存商品コードに、`ホイスト=HOISUT` や `コマツ=KOMATSU` のような長いメーカーコードが実際にどれだけ含まれているか
- 通し番号が1000以上になった時の過去運用実績と、重複をどう扱ってきたか

## 設計に進めるようになった項目

- `products` / `maker_master` / `location_master` / `category_master` / `status_master` の列設計
- `sd_product_code` を保持しつつ、構成要素を独立列で管理する新データモデル

## 次の一手

1. `ルール` シートと GAS配列の差分表を作る。
2. 実データの `新規自動生成商品コード` をサンプリングし、例外コードと重複有無を確認する。
3. 新規発行分だけに適用する安全なコード生成バリデーション仕様を決める。

## すぐ実装着手できる候補

- `maker_master` / `location_master` / `body_part_master` / `purchase_year_master` のv0列定義
- `sd_product_code` 分解バリデータの試作
- 既存商品コードの一括検査スクリプト仕様作成
