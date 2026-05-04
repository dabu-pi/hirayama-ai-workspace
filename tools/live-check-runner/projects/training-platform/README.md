# live-check-runner — training-platform

`training-program-platform-jp` の Playwright live-check スペック群。
本番 URL（`config.json` の `prodUrl`）に対して実行する。

## スペック一覧

| ファイル | 内容 |
|---------|------|
| `smoke.spec.ts` | 本番 URL 到達・タイトル確認（認証不要） |
| `custom-exercise-add.spec.ts` | カスタム種目 ADD フロー R1〜R8b（認証必要） |

## 実行方法

```bash
# training-platform スペック全体
npm run test:training

# ファイル指定
npx playwright test projects/training-platform/custom-exercise-add.spec.ts
```

認証が必要なスペックは環境変数を渡して実行する:

```bash
TRAINING_TEST_EMAIL=xxx@example.com \
TRAINING_TEST_PASSWORD=yourpassword \
npm run test:training
```

## 標準テストユーザー運用ルール

### 認証情報の管理

| 変数名 | 内容 |
|--------|------|
| `TRAINING_TEST_EMAIL` | テストユーザーのメールアドレス |
| `TRAINING_TEST_PASSWORD` | テストユーザーのパスワード |

**認証情報は絶対に git commit しない。**
- spec 内への直書き禁止
- `.env` / `.env.local` に記載する場合は `.gitignore` で除外されていることを確認する
- CI/CD で使う場合は Secret として登録する

### 標準テストユーザーの使用範囲

通常の実機確認・E2E確認は、このテストユーザーで行う:

- ログイン確認
- `/programs` / `/train` / `/gym` / `/profile` 画面確認
- カスタム種目作成・追加・SWAP 確認
- 自由作成セッション確認

### 削除系・破壊的テストには使わない

アカウント削除・`auth.users` 物理削除など、ユーザー自体を消すテストには **標準テストユーザーを使用しない**。

破壊的テストでは `SUPABASE_SERVICE_ROLE_KEY` を使って都度 disposable ユーザーを作成し、テスト後に削除する:

```typescript
// beforeAll: disposable ユーザー作成
const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
});

// afterAll: 削除
await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
  method: "DELETE",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
```

### テストデータの命名規則

テストで作成するカスタム種目・セッションなどには、判別しやすい名前をつける:

- 例: `テスト種目_R7_<timestamp>`, `Claude確認_<spec名>`
- タイムスタンプを含めることで同一ユーザーで複数回実行しても名前が衝突しない

## 環境変数一覧

| 変数名 | 必須 | 用途 |
|--------|------|------|
| `TRAINING_TEST_EMAIL` | 認証スペック実行時 | 標準テストユーザーのメール |
| `TRAINING_TEST_PASSWORD` | 認証スペック実行時 | 標準テストユーザーのパスワード |
| `SUPABASE_SERVICE_ROLE_KEY` | 破壊的テストのみ | disposable ユーザー作成・削除 |
| `NEXT_PUBLIC_SUPABASE_URL` | 破壊的テストのみ | Supabase プロジェクト URL |

smoke.spec.ts は環境変数不要（URL が config.json に設定されていれば動く）。

## config.json

```json
{
  "prodUrl": "https://training-program-platform-jp.vercel.app",
  "localUrl": "http://localhost:3000"
}
```

`prodUrl` が設定されていれば本番に対して実行する。未設定の場合は `localUrl`（事前に `npm run dev` が必要）。
