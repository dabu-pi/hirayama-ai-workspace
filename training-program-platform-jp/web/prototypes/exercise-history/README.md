# exercise-history — 静的UIプロトタイプ

## このモックの目的

「種目単体履歴」画面の静的UIプロトタイプ。
「今日のワークアウト」画面で種目名をタップしたときの遷移先として、
見た目・情報量・戻り導線をブラウザで確認するためのモック。
**本番実装ではない。**

---

## workout-session との関係

| 画面 | ファイル |
|---|---|
| 今日のワークアウト | `../workout-session/index.html` |
| 種目単体履歴（この画面）| `index.html` |

**遷移フロー:**

```
workout-session/index.html
  → 種目名タップ
    → exercise-history/index.html?name=Bench+Press&type=T1
      → ← 戻る
        → workout-session/index.html（history.back）
```

URL パラメータで種目名（`name`）とタイプ（`type`）を受け取る。

---

## 起動方法

```
npx serve ../  （prototypes/ を起点にサーブ）
```

または workout-session の serve 中に `../exercise-history/index.html?name=Bench+Press&type=T1` へ直接アクセス。

---

## ダミーデータ

| 種目 | 履歴件数 | 特記 |
|---|---|---|
| Bench Press | 4セッション | Set3 に AMRAP（最大回数）を含む |
| Squat | 4セッション | 重量増加の流れが確認できる |
| Lat Pulldown | 0件 | 空状態（初回）のUIを確認できる |
| その他の種目 | 2件（共通） | フォールバックデータ |

---

## 確認できる操作

| 操作 | 挙動 |
|---|---|
| 種目名タップ（workout-session 側）| この画面へ遷移 |
| ← 戻る | workout-session に戻る（history.back）|
| Lat Pulldown を開く | 空状態（記録なし）のUIを確認できる |
| AMRAP セット | オレンジ色でハイライト表示 |

---

## 未確定のまま残している点

- 履歴の件数制限（現在は全件表示）
- セット明細の折りたたみ表示の有無
- メモ欄の詳細表示
- グラフ（重量推移）の実装（MVP 以降）
- Previous の参照単位の確定（セット番号一致 / 種目内最新）

---

## ファイル構成

```
exercise-history/
├── index.html   — 画面構造
├── styles.css   — ダークテーマ（workout-session と共通変数）
├── script.js    — URL パラメータ読み込み・データ描画・遷移処理
└── README.md    — このファイル
```
