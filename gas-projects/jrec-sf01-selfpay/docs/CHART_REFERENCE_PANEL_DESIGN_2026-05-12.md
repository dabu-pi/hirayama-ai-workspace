# Phase Chart-Ref-1 — 初回・前回カルテ参照パネル 設計・実装記録 2026-05-12

## 目的

2回目以降の来院カルテ入力時に、施術者が **初回カルテ** と **前回カルテ** を read-only で参照しながら当日入力できるようにする。

| 観点 | 内容 |
|---|---|
| 解決する課題 | 2回目以降の visitForm で「初回の主訴」「前回の所見」を別画面で開かないと確認できない |
| 効果 | 経過追跡・施術方針継続判断の負担を下げる。将来の AI 過去判定比較 (Phase AI-5) の足場にもなる |
| やらないこと（Phase Chart-Ref-1 では） | 自動コピー / 引用ボタン / AIプロンプトへの組み込み / 大規模履歴UI |

---

## 重要方針

- **自動コピーしない** — 初回内容を新規 visit に流し込むと、現在の状態ではない情報がそのまま残って誤記録の原因になる
- **read-only** — 参照表示のみ。当日のカルテ入力欄は当日の事実を記録する
- **既存機能を壊さない** — 保存・会計・Phase AI-4.5（保存済みAI評価再読込）に変更を入れない
- **個人情報は出さない** — 既存の患者サマリーカードと同じ範囲で扱う（追加で氏名・住所等を出すことはしない）

---

## データソース

| 項目 | シート | 列 |
|---|---|---|
| visitKey / patientId / 来院日 / 来院区分 / 主訴 / VAS / 次回方針 / 受傷起点 / 今回追記既往歴 / isDeleted | SelfPayVisits | 0 / 1 / 2 / 3 / 5 / 6 / 7 / 14 / 15 / 11 |
| 評価 / 所見 / 施術内容 / 使用機器 / 説明内容 / 禁忌確認 / 生活指導 / 次回予定 | SelfPayChart | 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9（visitKey は col 1）|

参照対象として **表示する6項目**: 主訴 / 評価 / 所見 / 施術内容 / 説明内容 / 生活指導 / 次回予定（+ 受傷起点 / 来院日）

---

## サーバー側設計

新規関数 `getChartReferencesForVisit(currentVisitKey, patientId)` を `JREC_SF01_Visit.gs` に追加。

### 判定ロジック

| 用語 | 定義 |
|---|---|
| 初回 (firstVisit) | 同一 patientId・isDeleted=false の中で **visitDate 最古**の visit |
| 前回 (previousVisit) | **編集モード**（currentVisitKey 指定あり）: 当該 visit より前の最新<br>**新規モード**（currentVisitKey 空）: 過去 visit 全体の最新 |
| 編集モードで当該が初回そのもの | `first = null`（自分自身を参照しない）|
| first と previous が同一 visit | `previous = null` に collapse（重複表示防止）|

### 返却 schema（RPC-safe・AI-4.5 の `toRpcSafeObject_` を再利用）

```
{
  ok: true,
  patientId: "P0001",
  currentVisitKey: "SPV_...",  // 新規時は ""
  firstVisit:    null | <visit>,
  previousVisit: null | <visit>,
  debug: {
    reason:                "ok" | "no patientId" | "visits sheet not found or empty"
                         | "no visits for patient" | "exception",
    totalVisitsForPatient: <number>,
    sortedVisitKeys:       Array<string>,
    isCurrentVisitInList:  boolean,
    error:                 ""
  }
}

<visit> = {
  visitKey, visitDate (YYYY-MM-DD), visitType, chiefComplaint, vas,
  nextPlan, injuryTrigger, relatedHistoryNote,
  chart: {
    assessment, findings, treatment, equipment,
    explanation, contraindication, lifestyle, nextAppointment
  }
}
```

すべて plain string / number / null / 配列 / オブジェクト。Date は ISO 文字列化。

---

## レンダリング方式

**サーバー側レンダリング**（buildPage_ で `t.chartRefs = getChartReferencesForVisit(...)` を渡し、HtmlService scriptlet で描画）を採用。

理由:
- ページロード 1 回で完結（追加 RPC 不要・AI-4.5 で苦戦した RPC null 問題と無関係）
- 過去 visit 件数は患者ごとに高々数十件のため、サーバー側 join は十分高速
- フロント側に新規 JavaScript ロジックを追加しない（既存 AI 関連 JS と独立）

---

## UI 配置

`visit-form.html` の **患者サマリーカード直後**（visitForm より前）に表示。
施術者は最初に参照を見てから下のフォームに入力できる順序。

```
┌─ 患者サマリーカード ──────────────┐
│  患者ID / 氏名 / 患者情報参照     │
└──────────────────────────────────┘
┌─ 過去カルテ参照（NEW）───────────┐ ← Phase Chart-Ref-1 で追加
│  read-only バッジ                │
│  ┌─ 📌 初回 [青] ────────────┐   │
│  │ 主訴 / 評価 / 所見 / 施術内容│   │
│  │ 説明内容 / 生活指導 / 次回   │   │
│  └─────────────────────────┘   │
│  ┌─ 🔁 前回 [緑] ────────────┐   │
│  │ ...                       │   │
│  └─────────────────────────┘   │
└──────────────────────────────────┘
┌─ 来院フォーム（既存）─────────────┐
│  当日の入力欄                     │
└──────────────────────────────────┘
┌─ AI評価補助カード（既存）─────────┐
└──────────────────────────────────┘
```

### 表示パターン

| 状態 | UI |
|---|---|
| first と previous の両方あり | 2ブロック表示（初回[青] + 前回[緑]）|
| first のみ（previous と同一 visit に collapse 済） | 1ブロック表示（初回[青]）|
| previous のみ（編集モードで当該が初回そのもの） | 1ブロック表示（前回[緑]）|
| どちらもなし & 当該が完全な初回 visit | 「📌 初回来院のため、参照できる過去カルテはありません。」黄色注意カード |
| どちらもなし & 新規モード & 過去 visit ゼロ | パネル全体を非表示 |

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Visit.gs` | `getChartReferencesForVisit(currentVisitKey, patientId)` 追加（line 483〜）|
| `JREC_SF01_Main.gs`  | `buildPage_` visitForm case に `t.chartRefs = getChartReferencesForVisit(vkParam \|\| "", idParam);` を 1 行追加（line 92）|
| `visit-form.html`    | 患者サマリーカード直後に「過去カルテ参照」カードを scriptlet で描画（line 76〜158）|

`saveAIAssessment_` / `runAIAssessment` / 保存ロジック / OpenAI 呼び出し / PII 除外ポリシーには **変更なし**。

---

## clasp push verify

`clasp pull` を temp dir に投げて local↔server を diff:

| ファイル | 結果 |
|---|---|
| `JREC_SF01_Visit.gs`     | local と完全一致 |
| `JREC_SF01_Main.gs`      | local と完全一致 |
| `visit-form.html`        | local と完全一致 |

- server line 483: `function getChartReferencesForVisit(currentVisitKey, patientId) {`
- server line 92:  `t.chartRefs = getChartReferencesForVisit(vkParam || "", idParam);`
- server visit-form line 76: `<!-- Phase Chart-Ref-1: 初回 / 前回カルテ参照パネル（read-only） -->`

---

## 検証手順（HEAD /dev で人間が実施）

URL（HEAD deploymentId 使用）:
```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001
```

確認項目:

1. ✅ 「過去カルテ参照」カードが患者サマリーの直下に表示される
2. ✅ 初回カルテ・前回カルテのうち、対象患者に存在するものが表示される
3. ✅ 当日の入力欄（主訴・評価・施術内容など）は **空のまま / 当該 visit の保存内容のまま**（自動コピーされていない）
4. ✅ Phase AI-4.5 の保存済みAI評価再表示が壊れていない（青バナー出る）
5. ✅ 保存ボタンで通常通り update できる
6. ✅ 初回 visit のみ持つ患者で開くと「初回来院のため参照なし」黄色カードが出る
7. ✅ 過去 visit を持たない新規モード ({...}?page=visitForm&id={新規patientId}) で開くと、参照カードは非表示（または「参照なし」表示）

PASS なら → versioned deploy @41 を作成し PROJECT_STATUS / ROADMAP / 本 doc を CLOSED 化。
FAIL なら → 動かない条件と Console / 画面の様子を共有して狙い撃ち修正。

---

## deploy 判断

- HEAD /dev で人間検証 PASS まで本番 @41 deploy しない
- deploy description（PASS 後）:
  ```
  @41 - Phase Chart-Ref-1: first and previous chart reference panel
  ```

---

## 次フェーズ候補

| 候補 | 内容 | 優先度 |
|---|---|---|
| Phase Chart-Ref-2 | 必要項目だけ「引用」できるボタン追加（手動コピー）| 中 |
| Phase AI-5       | AI判定で初回・前回との差分・改善傾向・悪化傾向を出せるようにする | 高（Chart-Ref-1 の上に乗る）|
| Phase 6-M        | CSV / 印刷 / 監査レポート | ⏸ |
