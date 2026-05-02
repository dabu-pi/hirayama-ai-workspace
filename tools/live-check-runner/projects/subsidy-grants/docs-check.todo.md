# subsidy-grants docs-check TODO

subsidy-grants-projects（独立 repo）に対するドキュメント確認の計画。

repo パス: C:/hirayama-ai-workspace/workspace/subsidy-grants-projects
GitHub: github.com/dabu-pi/subsidy-grants-projects

---

## 自動化候補（将来実装）

| 確認内容 | 方法 | 状態 |
|---|---|---|
| README.md が存在する | fs.existsSync | ⏸ |
| ROADMAP.md が存在する | fs.existsSync | ⏸ |
| 必須 md ファイルのリンク切れ確認 | markdown link checker | ⏸ |
| 重要ファイルの最終更新日確認 | git log | ⏸ |

---

## 実装方針

`docs-check.spec.ts` を作成し、Node.js の `fs` モジュールでファイル存在確認を行う。
Playwright は使わず（Web アプリではないため）、TypeScript スクリプトとして実装する。

```typescript
// 例（将来実装）
import fs from "fs";
import path from "path";

const repoPath = "C:/hirayama-ai-workspace/workspace/subsidy-grants-projects";

test("README.md が存在する", () => {
  expect(fs.existsSync(path.join(repoPath, "README.md"))).toBe(true);
});
```
