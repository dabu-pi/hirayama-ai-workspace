# 画像正本候補の探索メモ

最終更新: 2026-04-05

## 目的

700x700 派生画像生成に進む前に、自社商品画像と競合画像の「元画像の正本候補」を整理する。

## 候補一覧

| 候補場所 | 対象 | 根拠 | この環境で確認できたこと | 取得可能性 | 優先度 |
|---|---|---|---|---|---|
| 現行 `ネットショップ商品一覧` の `画像1〜3` | 自社 | 一見すると画像列名だが、phase5B で再監査した | 実CSVは非URL、live sheet spot check でも plain text | 低い | 低 |
| `sendHttpPost()` -> `https://machine-group.net/strongdepot-product-manager/generate.php` -> WordPress 系 | 自社 | `docs/current-system-overview.md`、`docs/wordpress-dependencies.md`、`docs/php-publish-flow.md` に反映経路あり | 入口URLと依存関係は確認済み、PHP実体は未回収 | 高い | 最優先 |
| WordPress メディア / 過去アップロード資産 | 自社 | ユーザー申告「過去は WordPress メディアフォルダに商品コードベースで保存」 | workspace / OneDrive の手元確認では未発見 | 中 | 最優先 |
| 旧ローカル控え / OneDrive フォルダ | 自社 | 過去運用の画像控えがローカル同期されていた可能性 | OneDrive 直下の粗い確認では強い手掛かりなし | 中 | 高 |
| Google Drive の自社画像フォルダ | 自社 | 今後は Drive へ寄せたい方針、すでに保管が始まっている可能性 | 競合側の Drive 痕跡は確認済みだが、自社用は未確認 | 中 | 高 |
| `STRONGDEPOT 競合サイトデータ` の Drive フォルダ `1Q0vGVu2N8Ouq8us0JIMSaH1oCdHVLiZl` | 競合 | `docs/current-system-overview.md` に `商品ID_画像枝番` 保存の記載あり | 競合画像は Drive 保存の痕跡が明確 | 高い | 高 |
| 競合系シート / GAS | 競合 | `recyfit` 取得フローと `downloadImages` の記載あり | 画像URLや Drive 保存ルールの存在は確認済み | 高い | 高 |

## 今回確認できたこと

### 自社商品画像

- 現行 `画像1〜3` は正本URLではない。
- WordPress / PHP 反映経路は今も設計上の重要依存として残っている。
- `generate.php` / `Settings.php` の実コードが見つかっていないため、自社画像の投入元と保存先は未確定。
- したがって、自社商品の正本候補は「旧 WordPress 反映資産」が最も有力。

### 競合画像

- 競合画像は `STRONGDEPOT 競合サイトデータ` 系で Drive に保存していた痕跡がある。
- `商品ID_画像枝番` という命名ルールが docs に残っているため、自社画像より探索しやすい。
- ただし、競合画像は自社商品のサイト表示画像とは役割が異なるため、正本設計を分けて考える方が安全。

## この環境で未確認のこと

- WordPress メディア配下の実ファイル
- サーバー上の `strongdepot-product-manager`
- 自社商品画像の Google Drive フォルダ
- 旧 PC / OneDrive 上の画像控え

## 優先アクション

1. `strongdepot-product-manager` の配置場所を特定する
2. WordPress メディアまたはそのエクスポート控えを回収する
3. Google Drive に自社商品画像フォルダがあるか確認する
4. 競合画像の保管系統は自社画像と別設計で扱う前提を固める
