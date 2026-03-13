# 患者管理Webアプリ SPEC

## 目的

Google スプレッドシートをデータストアにして、接骨院の患者情報をローカル Flask アプリから登録・閲覧・更新できるようにする。

## 現在の範囲

- 患者情報の登録・閲覧・編集
- 郵便番号からの住所補完
- 年齢計算
- Google Service Account 経由のスプレッドシート連携

## 現在地

- 状態: 進行中
- 段階: 実装
- 実行環境: ローカル Flask
- 正本スプレッドシート: `整骨院 電子カルテ`

## 直近の課題

- `requirements.txt` を実態に合わせて整理する
- `.env` 経由の認証設定へ移行する
- ローカル起動確認と依存関係の洗い出しを完了する

## 主要ファイル

- `app.py`
- `requirements.txt`
- `templates/index.html`
- `templates/register.html`
- `templates/edit.html`

## 次アクション

1. 認証情報の参照方法を `.env` ベースへ変更する
2. 起動手順を README と一致させる
3. 柔整毎日記録システムとの連携ポイントを整理する
