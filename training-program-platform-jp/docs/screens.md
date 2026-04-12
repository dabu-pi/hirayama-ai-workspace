# screens

最終更新: 2026-04-12

## 現在の画面一覧

### `/`

- Home 相当の仮トップ
- 現状の主導線は `/train`
- Programs 専用 route が未実装のため、summary からの戻り先にも一時的に使う

### `/train`

- 現在の workout session を表示
- Kg / Reps 入力、Complete / Unlock / Delete、Add Set、Add Exercise、Swap Exercise を扱う
- Finish 成功後は `/workout-summary/[sessionId]` へ遷移

### `/exercise-history/[exerciseSlug]`

- 種目ごとの completed set 履歴を表示
- Supabase 実読込
- `loading` / `empty` / `error` state あり
- セッションは新しい順

### `/workout-summary/[sessionId]`

- workout session 完了後の記録完了サマリー画面
- 表示対象は completed 済み workout session
- 未完了 session は `not_completed` state
- 存在しない session または他ユーザー session は `not_found` state
- 未認証は `unauthenticated` state

## Workout Summary に表示する項目

- 完了メッセージ
- `program title`
- `week / day label`
- 完了時刻
- 実施した種目一覧
- 各種目の `completed set 数 / total visible set 数`
- 次の導線
  - `Back to Train`
  - `Back to Home`

## 戻り先の判断

- MVP では Programs 専用 route がまだない
- そのため summary の戻り先は `Home (/)` を採用
- Programs route 実装後に `Back to Home` を `Back to Programs` へ差し替える想定

## 実装メモ

- Exercise History と Workout Summary はどちらも App Router の server-side helper で Supabase を読む
- mock fallback が残るのは主に `/train` の Supabase 未設定時
- Workout Summary は実データ前提のため、未認証や存在不一致は state で案内する
