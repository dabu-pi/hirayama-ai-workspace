# PROJECT_STATUS — HAIKI-05 廃棄物日報システム

最終更新: 2026-05-05

---

## 現在地

**フェーズ: 稼働中 / ローカル正本化 進行中（Script ID 待ち）**

- Google スプレッドシート上の GAS システムは稼働済み
- 2026-01〜04 分の月報 PDF は生成・提出済み（提出済み確認シートで確認済み）
- GAS は container-bound（スプレッドシート直結）。clasp clone 準備完了、**Script ID を取得次第即時実行可能**
- SPEC.md: spec ドキュメント v2026-02-25 の全内容をローカルに反映済み
- 名称変更: J16（月報テンプレ）を「あさご暮らしサポート」に変更済み（2026-05-05 ユーザー実施）
- GAS コード内の旧名称「マシンやさんグループ 便利屋事業部」残存有無は未確認

---

## 完了済み

- Google スプレッドシート作成・GAS 実装・稼働（フルサイクル確認済み）
- 2026-01〜04 月報: PDF_READY 済み
- SPEC.md 更新（2026-05-04 / 2026-05-05）
- gas ディレクトリ作成（clasp clone 受け皿として `waste-report-system/gas/` を準備済み）
- Drive 内 spec ドキュメント内容をローカル SPEC.md に完全反映
- バックアップスプレッドシート確認:
  - `【UI日報・月報のバックアップ】のコピー` ID: `1WSPieqO6iRMYvABvz8STFq5XrPPfbmB4Oba6VwG55kc`（2026-02-26 作成）

---

## 現在のシート構成

| シート名 | 状態 | 備考 |
|---|---|---|
| 収集運搬一覧 | 稼働中 | 2026/03/27 いくの喜楽苑（70kg燃やす、50kg不燃）1件 |
| 日報 | テンプレ原本 | 空（作業用は別シートに生成） |
| 月報 | テンプレ原本 | J16=「あさご暮らしサポート」に変更済み |
| 仕様書 | v2026-02-19h 確定 | ローカル SPEC.md と整合済み |
| 提出済み確認 | 6件ログ済み | 2026-01〜04 全 PDF_READY |
| 設定 | 年度選択=2026 | PDF出力フォルダ ID は要確認 |
| 年度積算_2026-02月分 | 全0 | データなし月（正常） |
| 年度積算_2026-03月分 | 実データあり | いくの喜楽苑 3月=120kg |
| 年度積算_2026-04月分 | 全0 | データなし月（正常） |

---

## Apps Script 管理状況

| 項目 | 状態 |
|---|---|
| GAS の場所 | コンテナバインド（スプレッドシート直結） |
| GAS ファイル構成 | `WR_core.gs` / `WR_autoSubmit.gs`（仕様書より） |
| clasp 管理 | **準備完了。Script ID 取得待ち** |
| ローカルコードコピー | なし（clasp clone 後に作成予定） |
| バックアップ | なし（Google 変更履歴のみ） |

### clasp clone 実行手順（Script ID 取得後に実行）

```powershell
# 1. Script ID を取得
#    スプレッドシート → 拡張機能 → Apps Script → プロジェクトの設定 → スクリプトID

# 2. gas ディレクトリで clone
cd C:\hirayama-ai-workspace\workspace\waste-report-system\gas
clasp clone <スクリプトID>

# 3. 旧名称検索
grep -r "マシンやさん" .
grep -r "便利屋事業部" .
grep -r "あさご暮らしサポート" .
grep -r "J16" .
grep -r "WR_AUTO_runMonthlyFiscalDraft" .
grep -r "GmailApp" .
grep -r "createDraft" .
```

---

## 次アクション

### 即時（Script ID を入手したら実行）

1. **[MUST] clasp clone でコードをローカルに取得**
   ```
   スプレッドシート → 拡張機能 → Apps Script → プロジェクトの設定 → スクリプトID
   cd waste-report-system\gas
   clasp clone <スクリプトID>
   ```

2. **[MUST] 旧名称残存確認**
   - 「マシンやさんグループ 便利屋事業部」が GAS コードに残っている場合
   - → 「あさご暮らしサポート」に修正して clasp push

3. **[MUST] 自動月次処理フロー確認**
   - `WR_AUTO_runMonthlyFiscalDraft` の実装内容を確認
   - 収集運搬一覧 → 年度積算 → PDF → Gmail下書き → ログ の流れをコードで確認

4. **[確認] 既存 PDF（02〜04月分）の名称について**
   - PDF は生成済み（提出済み）のため、過去分は **原則触らない**
   - 再提出が必要な場合のみ、年度積算シートを再生成してPDF化する

### 将来

- 2026-05 月報への対応（データ入力後に動作確認）
- 設定シートの PDF出力フォルダ ID 確認

---

## Drive フォルダ構成（確認済み）

| ファイル/フォルダ | Drive ID | 備考 |
|---|---|---|
| 本番スプレッドシート | `1QS-WXy692GrnHERAAZ2ZMX0b1bR-O1No7kqgPh7yBwQ` | 正本 |
| バックアップスプレッドシート | `1WSPieqO6iRMYvABvz8STFq5XrPPfbmB4Oba6VwG55kc` | 2026-02-26 作成 |
| 年度積算_2026-04.pdf | `1DaPdb95PBO7BQnI6-ysvpzaEGm7A-cDt` | 2026-05-01 生成 |
| 年度積算_2026-03.pdf | `13ooLJrb_eKCAFPpNYPzC3jxV8Yc6TzCL` | 2026-04-01 生成 |
| 年度積算_2026-02.pdf | `1BDW0remabJmPf91p-TEC2AkHZSQ--tFw` | 2026-03-01 生成 |
| spec ドキュメント（旧） | `1c41Lf44ZEWmqylWqIl_CFlcithokfXGFYfhJAIxa2kM` | v2026-02-25 確定版 |
| 親フォルダ | `12jb2rDkQa01R1wxm4Gl79sTEZROftrO2` | — |

---

## テスト状況

| テスト対象 | 状態 |
|---|---|
| 日報生成 | 本番稼働で動作確認済み（2026-01〜04） |
| 月報生成 | 本番稼働で動作確認済み |
| 年度積算生成 | 部分確認済み（03月分のみ実データあり） |
| PDF出力 | 確認済み（提出済み確認シートにリンクあり） |
| Gmail下書き作成 | 本番稼働で動作確認済み（毎月1日 21:00 自動実行） |

---

## 直近の重要判断

| 日付 | 内容 |
|---|---|
| 2026-05-04 | ローカル SPEC.md をシート内仕様書 v2026-02-19h に合わせて更新 |
| 2026-05-05 | SPEC.md を spec ドキュメント v2026-02-25 の全内容で更新 |
| 2026-05-05 | gas ディレクトリ作成。clasp clone 受け皿準備完了 |
| 2026-05-05 | J16（月報テンプレ）を「あさご暮らしサポート」に変更（ユーザー実施） |
| 2026-05-05 | 過去分 PDF（02〜04月分）は提出済みのため原則触らない方針を確認 |
