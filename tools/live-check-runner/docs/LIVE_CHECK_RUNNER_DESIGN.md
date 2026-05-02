# LIVE_CHECK_RUNNER_DESIGN.md

作成日: 2026-05-02
対象: tools/live-check-runner

---

## 目的

workspace 配下の全プロジェクトについて、HEAD /dev（またはローカル開発環境）の動作を自動確認する共通基盤を提供する。

- 手動の実機確認コスト削減
- clasp push / deploy 後のリグレッション検出
- スクリーンショット付きレポートの自動生成
- 将来的な orchestrator からの CLI 呼び出し対応

---

## 対象プロジェクト

| プロジェクト | type | 状態 |
|---|---|---|
| jrec-sf01 | gas-webapp | 最初の実用ターゲット |
| training-platform | nextjs | URL 確定次第 |
| subsidy-grants | docs | ドキュメント整合確認 |

---

## 配置理由

`workspace/tools/live-check-runner` に配置した理由:

1. jrec-sf01・training-platform・aios-orchestrator がすべて workspace repo 管理下
2. tools/ が workspace .gitignore に除外エントリなし（即 repo に乗る）
3. training-platform が独立 repo でなく workspace 管理下（参照パスが安定）
4. subsidy-grants-projects は独立 repo だが、config.json で参照パスを持てば十分
5. automation/orchestrator とは初期段階では分離し、将来 CLI として呼び出す形が安全

---

## repo 構成

| repo | remote | live-check-runner との関係 |
|---|---|---|
| workspace/ | github: hirayama-ai-workspace | live-check-runner を含む |
| workspace/subsidy-grants-projects/ | github: subsidy-grants-projects | config.json で参照するだけ |
| automation/ | github: hirayama-claude-orchestrator | 将来的に live-check-runner CLI を呼ぶ側 |

---

## Playwright 採用理由

| 項目 | 理由 |
|---|---|
| GAS Web App 対応 | Chromium ベースで Google 認証・iframe をある程度扱える |
| スクリーンショット | 失敗時の自動保存が組み込み機能で使える |
| 並列実行 | workers 設定で並列化可能（GAS は workers=1 推奨） |
| TypeScript | 型安全な spec 記述。tsconfig と統一 |
| レポート | HTML レポート・JSON 出力が標準装備 |
| エコシステム | 活発。Next.js との相性も良好 |

---

## 自動化できること

| 確認内容 | 備考 |
|---|---|
| ページ到達確認（HTTP 200 / 404 区別） | URL アクセス可否 |
| DOM 要素の存在確認 | フォームラベル・ボタン・テキスト |
| ページタイトル確認 | |
| ナビゲーションリンクの存在 | |
| viewport 変更によるモバイル表示確認 | |
| 失敗時スクリーンショット自動保存 | |
| JSON レポート自動出力 | PROJECT_STATUS.md 反映の材料 |

---

## 自動化しにくいこと

| 確認内容 | 理由 |
|---|---|
| Google 初回権限承認 | モーダル対話が必要 |
| GAS iframe 内の DOM 操作 | cross-origin iframe 制約 |
| 保存後の DB 値確認 | スプレッドシート読み取りが別途必要 |
| 入力フォームの完全な E2E（保存→再編集） | 認証・データ依存性が高い |

---

## 人間確認が残る範囲

以下は自動化しない設計にする（無理に自動化しない）:

- Google 認証 / 初回権限承認画面
- GAS iframe 内の保存動作確認
- 既存データを使った再編集フロー
- スプレッドシートへの実際の書き込み確認
- 見た目・UX の主観評価

---

## 将来的な orchestrator 連携方針

```text
現在（Phase LC-1）:
  人間 → npm run livecheck -- --project jrec-sf01 → 結果確認

Phase LC-2 以降:
  orchestrator → CLI 呼び出し → 結果を Discord に通知
  → PROJECT_STATUS.md 自動反映

automation/claude-openai-discord-orchestrator から:
  exec("npm run livecheck -- --project jrec-sf01 --suite smoke")
  → reports/results.json を読んで Slack/Discord に投稿
```

---

## レポート出力方針

```text
reports/
├─ html/          ← playwright show-report で表示
├─ screenshots/   ← 失敗時の自動スクリーンショット
│  ├─ chromium/
│  └─ mobile/
└─ results.json   ← 自動生成 JSON
```

- `reports/` は .gitignore で除外（生成物はコミットしない）
- `reports/.gitkeep` のみコミットしてディレクトリを保持
- 将来的に make-report.ts が results.json から Markdown レポートを生成し、PROJECT_STATUS.md に反映する

---

## screenshots 保存方針

- 失敗時のみ自動保存（playwright の screenshot: "only-on-failure" 設定）
- 保存先: `reports/screenshots/{project}/{test_title}.png`
- 成功時は保存しない（ディスク節約）
- 将来的に「全ステップのスクリーンショット取得モード」を追加可能（collect-screenshots.ts）
