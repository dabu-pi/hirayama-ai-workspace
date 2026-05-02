# tech-decision

最終更新: 2026-04-11

## 結論

この案件の初期実装は、**Next.js（React を使う Web アプリ基盤） + TypeScript（型付き JavaScript） + Next.js Route Handlers（同一アプリ内で作る API エンドポイント） + Supabase PostgreSQL（管理付き PostgreSQL 系DB） + Supabase Auth（認証基盤） + Vercel（アプリ公開基盤）** で進める。

要するに、**フロントエンド（画面側）とバックエンド（API側）を最初から別サービスに分けず、1つの Next.js アプリの中で始める**。  
DB と Auth（認証）は Supabase に寄せ、公開は Vercel に置く。  
これを `training-program-platform-jp` の**初期採用方針**として確定する。

---

## 比較した候補

| 候補 | 構成 | 良い点 | 懸念点 | 判定 |
|---|---|---|---|---|
| A | **Next.js + Supabase** | 1つのWebアプリとして始めやすい。スマホ向け UI を作りやすい。DB と Auth を早く揃えられる。静的モックから本実装へ移りやすい | Vercel と Supabase の 2 サービス運用になる | **採用** |
| B | React + FastAPI + PostgreSQL | フロントとバックの責務が明確。Python 系の API 実装がしやすい | 初期からフロントとバックを分けるぶん、実装・デプロイ・保守が重くなる | 不採用 |
| C | React + Express + PostgreSQL | JavaScript で統一できる。構成の理解は比較的しやすい | 認証、DB、デプロイを自前で組み合わせる量が増えやすい。Next.js ほど画面と API の一体運用がしにくい | 不採用 |

---

## 初期採用方針

### 1. 技術スタック

| 項目 | 採用方針 | 補足 |
|---|---|---|
| フロントエンド（画面側） | **Next.js App Router（Next.js の画面/ルーティング方式） + React + TypeScript** | スマホ優先 UI と管理画面を同じアプリ内で育てる |
| バックエンド（API側） | **Next.js Route Handlers（同一リポジトリ内 API）** | `docs/api-spec-workout-session.md` の API をこの中で実装する |
| DB（データ保存先） | **Supabase PostgreSQL** | `users` / `programs` / `workout_sessions` などの関係データと相性がよい |
| Auth（認証） | **Supabase Auth** | 最初から土台は入れる。ただし MVP では管理者 + テストユーザー中心で始める |
| Hosting / Deploy（公開・配置） | **Vercel に Next.js を配置、Supabase を外部サービスとして接続** | フロントと API を 1 回のデプロイで更新しやすい |
| Styling（見た目の組み方） | **CSS Modules（コンポーネント単位の CSS） + CSS Variables（デザイン変数）** | 既存プロトタイプの plain CSS（素の CSS）を移植しやすい |
| 状態管理（state management = 画面内データの持ち方） | **React 標準の `useState` / `useReducer` を基本** | 初期は Redux / Zustand のような全体状態ライブラリは入れない |

### 2. フロントとバックを最初から分けるか

**分けない。**

初期は 1 つの Next.js アプリの中に、

- 利用画面
- 管理画面
- API

をまとめて持つ。

理由は、今の段階では「複数サービスに分けるメリット」よりも、**画面修正と API 修正を同時に早く回せるメリット**のほうが大きいから。

今回の UI は「今日のワークアウト」画面が中核で、  
画面操作と API の往復が非常に密接である。

そのため初期は、

- 画面を直す
- API を直す
- DB を直す

を同じリポジトリで一気に進められる構成のほうが相性がよい。

### 3. 構成はできるだけ減らすべきか

**減らすべき。**

この案件は、最初に勝負すべきポイントが

- ワークアウト実行画面の使いやすさ
- Previous（前回記録）の見え方
- 履歴との行き来
- セット入力の気持ちよさ

にある。

したがって初期は、  
**「画面体験に直接効かない技術的な分割」は後ろに回す**。

Next.js + Supabase なら、

- Web アプリ本体
- API
- DB
- Auth

を少ない接続点で始められる。

### 4. 認証は最初から入れるか、後回しにするか

**完全に後回しにはしない。土台は最初から入れる。**

ただし、初期 MVP でやることは絞る。

初期方針:

- Supabase Auth を最初から導入する
- まずは **管理者ログイン** を成立させる
- 一般ユーザー向けの細かな登録導線は後続でもよい
- `users.role` で `admin` / `user` を分けられる前提を置く

これにより、

- 将来の複数ユーザー対応
- データの所有者分離
- 管理画面のアクセス制御

をあとから無理なく足せる。

### 5. DB は PostgreSQL 系でよいか

**PostgreSQL 系でよい。むしろ今回に合っている。**

理由:

- `users`
- `programs`
- `program_weeks`
- `program_days`
- `program_day_exercises`
- `workout_sessions`
- `workout_session_exercises`
- `workout_sets`
- `program_enrollments`

のように、**関係が明確なデータ**が中心だから。

今回の `docs/data-model.md` は、  
まさに **リレーショナルDB（表どうしの関係を厳密に持つDB）** 向けの設計になっている。

また、Previous の算出や履歴取得でも、

- 結合（複数テーブルをつなぐ処理）
- 並び替え
- 絞り込み

が重要になるため、PostgreSQL は相性がよい。

### 6. 静的モックから本実装へどう移るか

**Next.js + CSS Modules が一番自然に移れる。**

今あるプロトタイプは、

- HTML
- CSS
- JavaScript

で、画面構造と操作感がかなり具体的にできている。

この状態からは、

1. HTML を React コンポーネント（画面部品）へ分割する  
2. CSS を CSS Modules へ移す  
3. ダミーデータを API レスポンスへ置き換える  
4. `script.js` の操作を React の状態管理へ移す  

という流れが取りやすい。

Tailwind CSS（ユーティリティ中心の CSS 手法）を新たに導入して全面的に書き換えるより、  
**既存モックの構造を活かして本実装へ接続する**ほうが初期速度に向く。

---

## なぜこの案件ではこの構成がよいか

### 1. スマホ優先 UI と相性がよい

今回の中心は「今日のワークアウト」画面であり、  
1 画面の中で以下を滑らかに扱う必要がある。

- 前回記録の表示
- Target（目標回数）の表示
- Kg / Reps 入力
- 完了チェック
- ロック解除
- 種目履歴への遷移

Next.js + React なら、こうした**細かい UI 状態の切り替え**を扱いやすい。

### 2. API spec と矛盾しない

`docs/api-spec-workout-session.md` にある API は、  
そのまま Next.js Route Handlers で実装できる。

特に今回必要なのは、

- `POST /workout-sessions`
- `GET /workout-sessions/{id}`
- `PATCH /workout-sets/{id}`
- `POST /workout-sets/{id}/complete`
- `POST /workout-sets/{id}/unlock`
- `GET /exercises/{id}/history`

のような、**セッション単位・行単位の細かな更新API** である。

これは別バックエンドを立てなくても、同一アプリ内 API で十分始められる。

### 3. 将来の複数ユーザー対応へ伸ばしやすい

初期は単一管理者運用でも、

- Auth を最初から入れる
- `users` を先に置く
- `user_id` 前提の設計を崩さない

ことで、あとから一般ユーザーを広げやすい。

「今は簡単に、でも将来の伸びしろは残す」という条件に最も合う。

### 4. 運用が重くなりすぎない

FastAPI や Express を別で立てると、

- フロントのデプロイ
- API のデプロイ
- 環境変数管理
- 認証連携
- CORS（別ドメイン間通信の許可設定）

など、初期に増える運用項目が多い。

今回はまだ本実装の入口であり、  
まずは**体験の核を早く動かすこと**が優先なので、分離は早すぎる。

### 5. 管理画面も同じ基盤で持てる

管理者 1 名で始める前提があるため、

- 利用画面
- 管理画面

を別製品にする必要はまだない。

Next.js 内でルート（URL単位の画面区分）を分ければ、  
1つのアプリ内で十分管理できる。

---

## 今回確定した技術方針

### 採用スタックの要約

```text
Frontend:
  Next.js App Router + React + TypeScript

Backend:
  Next.js Route Handlers

Database:
  Supabase PostgreSQL

Auth:
  Supabase Auth

Hosting / Deploy:
  Vercel + Supabase

Styling:
  CSS Modules + CSS Variables

State management:
  React 標準（useState / useReducer）
```

### 実装ルール

| 項目 | 方針 |
|---|---|
| フロントとバックの分離 | 初期は分離しない。1アプリで持つ |
| API 実装場所 | Next.js Route Handlers に集約する |
| 認証の扱い | 最初から導入。ただし MVP は管理者中心で始める |
| `user_id` の扱い | API spec 上の仮置きは残してよいが、本実装ではセッション情報から取得する方向を優先する |
| 管理画面 | 同じ Next.js アプリ内で `/admin` 系ルートとして持つ |
| UI スタイリング | 既存 prototype の CSS を活かしながら移植する |
| グローバル状態ライブラリ | 初期導入しない。必要になるまで増やさない |

---

## 今回採用しない方針

### 1. React と FastAPI を最初から分ける構成

不採用理由:

- 初期にサービス分割コストが乗る
- デプロイ経路が増える
- API と UI の同時変更が遅くなる

将来、API 負荷やチーム分業が強くなった段階で再検討すればよい。

### 2. React と Express を別で持つ構成

不採用理由:

- 認証と DB と API のつなぎ込みを自前で増やしやすい
- Next.js を使うより「画面と API を一体で進めるうまみ」が少ない

### 3. 認証を完全に後回しにする方針

不採用理由:

- 将来の複数ユーザー化で付け替えコストが上がる
- 管理画面保護の土台が弱くなる

「全部のユーザー機能を今すぐ作る」は不要だが、  
**Auth の土台まで後回しにするのは避ける**。

---

## 実装開始時のアーキテクチャ方針

以下のような単一アプリ構成を前提にする。

```text
training-program-platform-jp/
  app/
    (user screens)
    (admin screens)
    api/
  docs/
  web/prototypes/
  lib/
    supabase/
  db/
    migrations/
```

補足:

- `app/` に利用画面・管理画面・API を持つ
- `lib/supabase/` に接続処理をまとめる
- `db/migrations/` に SQL migrations（DB変更履歴）を置く

※ まだ実装は始めないが、構造の考え方はこの方向で固定する。

---

## 実装前に残る未確定事項

| 項目 | 内容 |
|---|---|
| 認証画面の最小範囲 | 管理者ログインだけ先に作るか、テストユーザー切替も入れるか |
| 管理画面の MVP 範囲 | プログラム登録と種目マスタをどこまで初期実装に入れるか |
| `Add Set / Swap / Add Exercise` の実装順 | UI だけ先に置くか、MVP で API まで入れるか |
| PWA（ホーム追加できるWeb化）の着手時期 | 初期リリース時点で入れるか、MVP 後に回すか |
| DB migration 運用 | Supabase CLI（Supabase の管理コマンド）を標準にするか |
| テスト方針 | まず画面単位で進めるか、API から先に固めるか |

---

## 次に進むための実務判断

次フェーズでは、**この採用スタックを前提に「実装の骨組み」を切る**。

優先順:

1. Next.js アプリ雛形を作る  
2. Supabase プロジェクトを接続する  
3. `docs/data-model.md` をもとに DB schema（DB構造）を migration 化する  
4. `docs/api-spec-workout-session.md` の MVP API から Route Handlers を切る  
5. `web/prototypes/workout-session/` を React コンポーネントへ移植する  

この順番が、静的モックから本実装へ最も自然につながる。
