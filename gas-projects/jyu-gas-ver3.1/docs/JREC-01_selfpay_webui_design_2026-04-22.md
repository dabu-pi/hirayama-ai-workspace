# JREC-01 自費明細入力 Web UI 化 — 設計整理

作成日: 2026-04-22  
対象ブランチ: `feature/auto-dev-phase3-loop`  
ステータス: **設計完了 / 実装未着手**

---

## 1. 現行ダイアログ構成の棚卸し

### 1-1. 使用ファイル

| ファイル | 役割 |
|---|---|
| `selfPayDialog.html` | モーダルダイアログ UI（HtmlService 経由） |
| `Ver3_core.js` | 全保存・読み込みロジックを収容 |

### 1-2. 関数マップ（ダイアログ版）

```
メニュー「自費明細入力」
  └─ openSelfPayDialog_V3()          ← UIから呼ぶエントリポイント
       ├─ B2/B4 から patientId / treatDate を読み取り
       ├─ buildVisitKey_() でvisitKey生成
       ├─ readSelfPayDetailsForVisit_V3_() で既存データ取得
       └─ showModalDialog("selfPayDialog") でダイアログ表示

selfPayDialog.html（初期化）
  └─ google.script.run.getCurrentVisitKey_V3()
       ├─ getActive() で対象シートを取得
       ├─ B2/B4/B5/B7/B8/D8 から文脈情報を収集
       ├─ readSelfPayDetailsForVisit_V3_() で既存明細を取得
       └─ {visitKey, patientId, treatDate, accountingType, chronicFlag,
            nextReservation, isGymMember, existItems} を返す

selfPayDialog.html（マスタ読み込み）
  └─ google.script.run.getSelfPayMenuMaster_V3()
       ├─ JBIZ スプレッドシートを openById で参照
       ├─ 「価格設定_v2」シートから確定行のみ取得
       └─ [{menuId, menuName, unitPrice, memberPrice}, ...] を返す

selfPayDialog.html（保存）
  └─ google.script.run.saveSelfPayDetailsFromDialog_V3(visitKey, itemsJson, contextJson)
       ├─ JSON.parse → saveSelfPayDetails_V3_() を呼ぶ
       │    ├─ deleteSelfPayDetailRows_V3_()  ← visitKey 一致行を全削除
       │    ├─ appendSelfPayDetailRow_V3_()   ← 各行を label-based で追記
       │    ├─ updateSelfPayDisplay_V3_()     ← D7（メニュー集計） / F7（合計金額） を更新
       │    └─ updateH8Status_V3_()          ← H8（N件保存済 / 未入力） を更新
       └─ "OK" or "ERROR: ..." を返す
```

### 1-3. セル連動

| セル | 役割 | 保存時の更新 |
|---|---|---|
| B2 | 患者表示文字列（検索用列の値） | Phase 2 Web UI が setValue |
| C2 | 患者ID（`=IFERROR(TRIM(LEFT(B2,...)))` 数式） | B2 変更で自動再計算 |
| B4 | 来院日 | Phase 2 Web UI が setValue |
| B5 | ジム会員フラグ（チェックボックス） | 手動入力 or 未来 Web UI 化対象 |
| B7 | 会計区分（自費のみ/保険のみ/混合） | 手動 |
| D7 | 自費メニュー集計テキスト（表示専用） | `updateSelfPayDisplay_V3_` が更新 |
| F7 | 自費合計金額（表示専用） | `updateSelfPayDisplay_V3_` が更新 |
| H8 | 自費明細保存状態（「N件保存済」/「未入力」） | `updateH8Status_V3_` が更新 |

### 1-4. ダイアログ特有の機能（Web App で要対応）

| 機能 | ダイアログ実装 | Web App での対応方針 |
|---|---|---|
| ダイアログを閉じる | `google.script.host.close()` | 成功状態UI + 「戻る」リンクに置き換え |
| visitKey の取得 | `getCurrentVisitKey_V3()` でアクティブシートから読む | URL パラメータで渡す（`?visitKey=...`） |
| 全件削除確認 | `window.confirm()` | ブラウザ confirm のまま利用可 |

---

## 2. ダイアログ版 vs Web UI 版の差分

### 再利用できる資産（変更不要）

| 資産 | 再利用可否 | 理由 |
|---|---|---|
| `getSelfPayMenuMaster_V3()` | ✅ そのまま | 公開関数 / google.script.run で呼べる |
| `saveSelfPayDetailsFromDialog_V3()` | ✅ そのまま | 公開関数 / JSON 引数で外部から呼べる |
| `saveSelfPayDetails_V3_()` | ✅ そのまま（内部） | 既存保存ロジック全体が流用可能 |
| `readSelfPayDetailsForVisit_V3_()` | ✅ そのまま（内部） | 既存読み込みロジック全体が流用可能 |
| `deleteSelfPayDetailRows_V3_()` | ✅ そのまま（内部） | 変更なし |
| `appendSelfPayDetailRow_V3_()` | ✅ そのまま（内部） | label-based 実装済み |
| `updateSelfPayDisplay_V3_()` | ✅ そのまま（内部） | D7/F7 更新ロジック |
| `updateH8Status_V3_()` | ✅ そのまま（内部） | H8 更新ロジック |
| selfPayDialog.html の JS ロジック | ✅ 概ね流用 | addRow / updateSubtotal / updateTotal / doSave のバリデーション部分 |
| selfPayDialog.html の CSS | ✅ 流用 + 拡張 | スタンドアロンページ向けに padding/フォントを調整するだけ |

### 追加・変更が必要なもの

| 対象 | 変更内容 |
|---|---|
| `doGet(e)` | URL パラメータ `page=selfpay` でページ分岐を追加 |
| `getCurrentVisitKey_V3()` | Web App 向けに visitKey を引数で受け取る版を別途追加 |
| `selfPayDialog.html` | **変更しない**（既存ダイアログは維持） |
| `selfPayWeb.html` | 新規作成。ダイアログ版を Web App 対応に改変したもの |

---

## 3. Web UI 化の対象範囲

**今回の範囲（最小）:**

```
患者検索 → 患者選択（Phase 2 完了）
    ↓
自費明細入力（今回の対象）
    ├─ visitKey を URL パラメータで受け取る
    ├─ メニューマスタ読み込み（getSelfPayMenuMaster_V3 流用）
    ├─ 既存明細読み込み（新関数 getSelfPayDataByVisitKey_V3 経由）
    ├─ 明細行の追加 / 削除 / 小計計算
    ├─ 保存（saveSelfPayDetailsFromDialog_V3 流用）
    └─ 成功状態表示（ダイアログの host.close() の代替）
```

**今回の範囲外（維持）:**

| 対象 | 方針 |
|---|---|
| 既存ダイアログ（selfPayDialog.html） | 削除しない。メニューから引き続き使える |
| 帳票出力・集計連動 | 変更なし |
| D7/F7/H8 の更新ロジック | 既存関数がそのまま動く |
| 来院登録（saveVisit_V3） | 変更なし |
| B7 会計区分 / B8 慢性フラグ / D8 次回予約 | Web UI では読み取りのみ（手動入力を前提） |

---

## 4. 新規追加が必要な関数（最小）

### `getSelfPayDataByVisitKey_V3(visitKey)`

`getCurrentVisitKey_V3()` はアクティブシートから visitKey を生成するが、
Web App では URL パラメータで明示的に渡したい。

```javascript
// 追加する関数のシグネチャ（Ver3_core.js に追加）
function getSelfPayDataByVisitKey_V3(visitKey) {
  // visitKey を引数で受け取り、シートから対応する patientId / treatDate / 文脈情報を読み返す
  // 既存の readSelfPayDetailsForVisit_V3_ と getCurrentVisitKey_V3 の処理を分離・再利用
  // 戻り値は getCurrentVisitKey_V3 と同形式（HTML側の初期化コードを流用できるようにする）
}
```

### `doGet(e)` のページ分岐

```javascript
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || "search";
  if (page === "selfpay") {
    var visitKey = (e && e.parameter && e.parameter.visitKey) || "";
    return HtmlService.createHtmlOutputFromFile("selfPayWeb")
      .setTitle("自費明細入力 — JREC-01");
  }
  // デフォルト: 患者検索ページ
  return HtmlService.createHtmlOutputFromFile("patientSearch")
    .setTitle("患者検索 — JREC-01")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

---

## 5. selfPayWeb.html の設計（新規作成）

### selfPayDialog.html との差分のみを記録

| 項目 | ダイアログ版 | Web App 版 |
|---|---|---|
| visitKey の取得方法 | `getCurrentVisitKey_V3()` をコール | `getSelfPayDataByVisitKey_V3(visitKey)` をコール（visitKey は URL param から取得） |
| URL param の取得 | 不要 | `google.script.run.getUrlParam_V3()` or HTML テンプレート埋め込み |
| キャンセル | `google.script.host.close()` | `history.back()` or 患者検索ページへリンク |
| 保存成功後 | `google.script.host.close()` | 成功状態 div を表示（「保存完了 — 閉じるか来院登録へ」） |
| ページサイズ | 600×420px のダイアログ | フルページ（viewport 対応） |
| フォントサイズ | ダイアログ向けの小さめ設定 | モバイル向けに 14〜16px |

### URL param 渡し方の選択肢

| 方法 | 実装 | 長所 | 短所 |
|---|---|---|---|
| A. HTML テンプレートで visitKey 埋め込み | `createTemplateFromFile().evaluate()` | クライアントJS が不要 | `createHtmlOutputFromFile` から変更が必要 |
| B. `google.script.run` でサーバーから取得 | 追加 1 round-trip | 既存コードパターンと一致 | 1回余分な呼び出し |
| C. URL ハッシュ使用 | `location.hash` で取得 | サーバー不要 | GAS Web App の URL 仕様を確認必要 |

**推奨: 方法 A（HTMLテンプレート）**
- `selfPayWeb.html` を `createTemplateFromFile()` で処理し、visitKey を `<?= visitKey ?>` で埋め込む
- クライアント JS での余分な round-trip をなくせる
- selfPayDialog.html は `createHtmlOutputFromFile` のままなので影響なし

---

## 6. 実装ステップ（最小単位）

| ステップ | 内容 | 難易度 |
|---|---|---|
| **Step 1** | `getSelfPayDataByVisitKey_V3(visitKey)` を `Ver3_core.js` に追加 | 低（既存関数の切り出し） |
| **Step 2** | `doGet(e)` に `page=selfpay` 分岐追加（visitKey をテンプレートに渡す） | 低 |
| **Step 3** | `selfPayWeb.html` を新規作成（selfPayDialog.html を Web App 対応に改変） | 中（close の代替・テンプレート変数） |
| **Step 4** | `patientSearch.html` に「自費明細入力」リンクを追加（選択後に ?page=selfpay&visitKey=xxx へ遷移） | 低 |
| **Step 5** | 実機確認・Markdown 記録 | — |

**次に実装する最小単位: Step 1 から開始**
- `getSelfPayDataByVisitKey_V3(visitKey)` 1関数を追加する
- `doGet` の分岐と `selfPayWeb.html` の骨格を作成して clasp push → 動作確認
- selfPayDialog.html は一切触らない

---

## 7. リスク

| リスク | 内容 | 対策 |
|---|---|---|
| `getActiveSpreadsheet()` の Web App 挙動 | bound script なら動くが、getSelfPayDataByVisitKey_V3 は明示的な visitKey 受け取りで回避 | 引数渡しを徹底 |
| visitKey の URL パラメータ漏洩 | access=MYSELF のため自分以外アクセス不可 | Phase 3 以降で access 拡張時に再評価 |
| selfPayDialog.html との重複メンテ | selfPayWeb.html と selfPayDialog.html が別々に存在することになる | 共通ロジックを GAS 関数側に集約する設計を維持。HTML の JS は最小限 |
| B7/B8/D8 の値が Web UI から操作できない | 会計区分・慢性フラグ等はシートから読むのみ（手動入力前提） | Phase 3 でフォーム化対象として記録しておく |
| テンプレート変数インジェクション | visitKey は GAS 側で生成するため外部入力でない | doGet で受け取った visitKey は形式チェックを挟む（`/^\w+_\d{4}-\d{2}-\d{2}$/` 等） |

---

## 8. Dashboard / Run_Log 反映要否

**不要。**

本ドキュメントは設計記録のみで、コード変更・シート変更なし。
実装（Step 1〜5）着手時に `de -ProjectId JREC-01` で反映する。

---

## 参照

- 患者検索 Web UI: `docs/JREC-01_phase1_webui_2026-04-22.md`
- 患者選択 → シート反映: `docs/JREC-01_phase2_webui_2026-04-22.md`
- Web UI 段階移行全体設計: `docs/JREC-01_WebUI_段階移行設計_2026-04-22.md`
- 自費明細 label-based 実装: `docs/JREC-01_selfPay_label_based_2026-04-22.md`
