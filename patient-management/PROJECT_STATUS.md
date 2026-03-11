# PROJECT_STATUS.md — 患者管理Webアプリ

最終更新: 2026-03-11

---

## 現在地

- プロジェクト: 患者管理Webアプリ
- ディレクトリ: `patient-management/`
- 状態: 開発中（プロトタイプ）
- 実行方式: ローカル Flask

---

## 概要

Google スプレッドシートをデータストアとして使う Flask 製の患者管理アプリ。
患者情報の登録・閲覧、郵便番号からの住所補完、年齢計算を行う想定。

---

## 完了済み

- `app.py` に Flask アプリ本体がある
- `templates/` に主要画面テンプレートがある
- Google スプレッドシート連携前提の構成がある
- README に基本目的と起動方法が記載されている

---

## 次アクション

- `requirements.txt` を実態に合わせて整備する
- `.env` と `service_account.json` 前提の起動手順を固める
- 実際にローカルで起動確認し、必要な依存関係を洗い出す
- 患者検索やフィルタリングなどの次機能を整理する

---

## 保留事項

- `service_account.json` は各PCで個別配置が必要
- `.env` の実運用ルールが未完成
- 柔整GASの患者IDスキーマとの共通化は未着手

---

## テスト状況

- 自動テストファイルは未確認
- ローカルでの起動確認が前提
- 実運用には認証情報配置後の手動確認が必要

---

## 重要ファイル

- `README.md`
- `app.py`
- `requirements.txt`
- `templates/index.html`
- `templates/register.html`
- `templates/edit.html`

---

## 再開メモ

作業再開時は、まず `README.md` と `app.py` を確認する。
次に認証情報の配置状況と `.env` 前提を確認し、起動できる状態かどうかを先に判断する。
