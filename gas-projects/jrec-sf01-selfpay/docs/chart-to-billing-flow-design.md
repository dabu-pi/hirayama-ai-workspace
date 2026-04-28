# Phase 5-D: カルテ連動会計フロー 設計書

**作成日:** 2026-04-28
**対象:** JREC-SF01 自費カルテ・会計システム
**ステータス:** 将来タスク（未実装）

---

## 1. 背景・目的

### 現在のフロー（課題あり）

```
カルテ記録（visit-form.html）
  ↓ 保存
患者詳細画面（patient-detail.html）
  ↓ 会計ボタンを手動で押す
会計入力画面（billing-form.html）
  ↓ メニューを手動で選択・入力
会計確定
```

**課題:**
- カルテ入力と会計入力が完全に分離しており、二度手間になる
- カルテに記録した施術内容と会計のメニューを別途入力するため、入力漏れが起きやすい
- 施術後すぐに会計したい場合でも、一旦詳細画面へ戻る必要がある

### 目指すフロー

```
カルテ記録（visit-form.html）
  ↓ 保存後に「会計へ進む」ボタン（オプション）
会計入力画面（billing-form.html）← 施術内容から候補を自動入力
  ↓ 人間が確認・修正してから確定
会計確定
```

---

## 2. 設計方針

| 方針 | 内容 |
|---|---|
| 人間確認必須 | カルテ内容を即請求確定にしない。会計画面で人間が確認・修正してから確定 |
| 自動候補生成 | 施術内容から会計候補（メニューコード・数量）を自動生成。プリセット設定可能 |
| 内部は明細保持 | SelfPayItems の明細は1行ずつ保持。領収書への合算表示は UI 層で制御 |
| 既存フローを壊さない | 既存の patient-detail → billing-form フローはそのまま維持 |
| 段階的実装 | まず「カルテから会計へのリンク（prefill）」のみ実装し、後で候補生成を追加 |

---

## 3. 実装フェーズ案

### Phase 5-D-1: 最小実装（visit-form → billing-form リンク）

カルテ保存後に「会計へ進む」ボタンを追加し、`billing-form.html?visitKey=XXX` へ遷移するだけ。

```
visit-form.html
  → 保存成功後に「この来院を会計する →」ボタンを表示
  → billing-form.html?visitKey=SPV_... へリンク
```

**変更ファイル:** `visit-form.html` のみ（ボタン追加）

---

### Phase 5-D-2: 会計候補のプリセット自動入力

カルテに記録した施術内容（visitType / chiefComplaint 等）をもとに、
MenuMaster から適切なメニューを候補として billing-form に事前入力する。

**候補生成ロジック（案）:**

| カルテ情報 | 対応メニュー候補（例）|
|---|---|
| visitType = "初診" | SELFPAY_INITIAL |
| visitType = "継続" | SELFPAY_CONTINUE20 |
| chiefComplaint に "腰" を含む | SELFPAY_LUMBAR_OPTION |

**設定場所:** Settings シートまたは MenuMaster の visitType 連携列

**変更ファイル:**
- `JREC_SF01_Visit.gs` に `getVisitMenuSuggestions(visitKey)` を追加
- `billing-form.html` に候補プリセット表示を追加

---

### Phase 5-D-3: 合算表示（将来）

複数明細を内部保持しつつ、患者向け表示・領収書を合算表示できる UI を追加。

---

## 4. 影響を受ける既存コンポーネント

| コンポーネント | Phase 5-D-1 | Phase 5-D-2 |
|---|---|---|
| `visit-form.html` | ✅ ボタン追加 | ✅ 候補プリセット連携 |
| `billing-form.html` | 変更なし | ✅ 事前入力対応 |
| `JREC_SF01_Visit.gs` | 変更なし | ✅ getVisitMenuSuggestions 追加 |
| `JREC_SF01_Billing.gs` | 変更なし | 変更なし |
| `JREC_SF01_Setup.gs` | 変更なし | △ MenuMaster に visitType 列追加の可能性 |

---

## 5. 未解決事項（実装前に確認が必要）

| # | 確認事項 |
|---|---|
| 1 | カルテ保存後に「毎回」会計誘導ボタンを出すか、「押したときだけ」プリセット入力するか |
| 2 | 候補生成ロジックをコードに書くか、Settings/MenuMaster で設定可能にするか |
| 3 | 候補を「自動確定」ではなく「確認画面に表示して選択」にするか |
| 4 | 既存の billing-form の prefill はどの形式で渡すか（URL パラメータ or GAS 関数） |

---

## 6. 実装優先度・前提

| 項目 | 内容 |
|---|---|
| 実装優先度 | 低（Phase 5-C / Deployment 整理 / Phase 6-A の後に検討） |
| 前提 | Phase 5-B CLOSED ✅ |
| 先行 Phase | Phase 5-C（領収書フロー）または Phase 6-A（患者基本情報編集）を先行推奨 |
