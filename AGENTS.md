# AGENTS.md

このファイルは、このワークスペースを Codex で安全に再開・継続するための共通運用ガイドです。
Claude Code を使う場合も、AI 共通ルールとして参照して構いません。

---

## 目的

- 3台のPCで GitHub を使って同じ作業を継続できるようにする
- AI が変わっても再開できるようにする
- 会話ではなくファイルに状態を残す

---

## 最初に読む順番

Codex は作業開始時に次の順で確認すること。

1. `README.md`
2. `PROJECTS.md`
3. `ROADMAP.md`
4. `docs/PROJECT_STATUS.md`
5. 対象プロジェクトの `README.md`
6. 対象プロジェクトの `PROJECT_STATUS.md`
7. 必要に応じて `spec.md` / `SPEC.md`

---

## GitHub 運用ルール

- GitHub を正本とする
- 作業開始前に `git status` と `git pull` を確認する
- 作業終了時は状態ファイルを更新してから commit / push する
- push 前の未共有変更を残したまま別PCへ移らない
- 同じファイルを複数PCで同時に触らない

---

## 状態管理ルール

各プロジェクトでは、可能な限り `PROJECT_STATUS.md` を維持する。
最低限、次の項目を入れる。

- 現在地
- 完了済み
- 次アクション
- 保留事項
- テスト状況
- 直近の重要判断

AI が再開時に会話履歴へ依存しないよう、重要事項は必ずファイルへ残す。

---

## ローカル専用ファイル

次のようなファイルは GitHub に上げない。

- `.env`
- `service_account.json`
- `.clasp.json`
- `.claude/settings.local.json`
- 各種鍵ファイル、トークン、認証JSON

必要なら各PCへ手動で配置する。

---

## Codex への基本指示

Codex に依頼するときは、必要なら次の形を使う。

```text
まず README.md、PROJECTS.md、ROADMAP.md、docs/PROJECT_STATUS.md と、
今回触るプロジェクトの README / PROJECT_STATUS / spec を読んでから作業してください。
作業前に git status を確認し、作業後は変更点・検証結果・次の作業を整理してください。
```

---

## PC を切り替える前の確認

- 状態ファイルを更新した
- 不要な差分がない
- commit した
- push した
- 次にやることがファイルに残っている

---

## 補助ドキュメント

- `docs/CODEX_MIGRATION_CHECKLIST.md`
- `SETUP.md`
- `CLAUDE.md`
- `docs/AI_DEV_ENV.md`

---

最終更新: 2026-03-11
