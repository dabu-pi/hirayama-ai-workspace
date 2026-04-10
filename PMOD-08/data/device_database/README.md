# data/device_database — 機器マスターデータベース

**最終更新:** 2026-04-10

---

## このフォルダの役割

物療機器の基本情報・仕様・使用状況を記録するマスターデータベース。

自院で保有している機器の情報と、学習・参照用の機器情報を蓄積する。

---

## ファイル構成

```
device_database/
├── README.md                    # このファイル
├── device_master_template.csv   # 機器登録テンプレート
└── （各機器の詳細ファイルを追加）
    例: device_low_frequency_001.md
        device_ultrasound_001.md
```

---

## 使い方

1. `device_master_template.csv` に自院保有機器を登録する
2. 詳細に調べたい機器は個別 .md ファイルを作成する
3. 機器分類の概要は `docs/DEVICE_CLASSIFICATION.md` を参照

---

## 優先して登録すること

1. 自院で実際に使用している機器（使用頻度順）
2. 導入を検討している機器
3. 学習目的で比較したい機器
