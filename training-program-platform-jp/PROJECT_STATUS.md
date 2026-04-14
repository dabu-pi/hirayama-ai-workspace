# PROJECT_STATUS

最終更新: 2026-04-14（H-2 Session Detail 完了）

## 2026-04-14 H-2 — Session Detail

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSessionDetailSet` / `WorkoutSessionDetailExercise` / `WorkoutSessionDetailView` / `SessionDetailResult` 型追加 | **完了 ✅** |
| `lib/workout/session-detail.ts` — `getWorkoutSessionDetailView` 実装 | **完了 ✅** |
| `app/session-history/[sessionId]/page.tsx` — 動的ルートページ作成 | **完了 ✅** |
| `SessionDetailScreen.tsx` + `.module.css` — 詳細画面コンポーネント作成 | **完了 ✅** |
| `SessionHistoryScreen.tsx` — "View summary" → "View detail" リンク先を `/session-history/<id>` に変更 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/h2-session-detail-spec.md` 作成 | **完了 ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSessionDetailSet` / `WorkoutSessionDetailExercise` / `WorkoutSessionDetailView` / `SessionDetailResult` を追加 |
| `lib/workout/session-detail.ts` | 新規作成。`getWorkoutSessionDetailView(sessionId)` — 8クエリ（session owner guard → exercises → sets → program day/week/program） |
| `app/session-history/[sessionId]/page.tsx` | 動的ルートページ 新規作成（force-dynamic） |
| `components/history/SessionDetailScreen.tsx` | 詳細画面コンポーネント 新規作成 |
| `components/history/SessionDetailScreen.module.css` | 詳細画面スタイル 新規作成 |
| `components/history/SessionHistoryScreen.tsx` | "View summary →" → "View detail →"、リンク先を `/session-history/<id>` へ変更 |
| `docs/h2-session-detail-spec.md` | 新規作成 |

### 画面構成

- Hero: 日付 / プログラム名 — Week N / Day N / ステータスバッジ
- Stats Grid: Started / Finished / Sets Done（completed/total）
- Exercise List: エクササイズカード × N（T1/T2/T3 バッジ / Swapped バッジ / Added バッジ / セットテーブル）
- セットテーブル: # / Kg / Reps / Done（✓/—）/ Note（note があるエクササイズのみ列表示）
- 完了行: `color: --text-primary`、未完了行: `opacity: 0.5`

### OPEN ISSUES

| ID | 内容 |
|---|---|
| H-2b | セット編集（詳細画面からのインライン修正） |
| H-2c | 種目別パフォーマンスグラフ |
| H-3 | セッション削除・アーカイブ |

---

## 2026-04-14 D-4 — Program Re-enroll

### STATUS

| 項目 | 状態 |
|---|---|
| `firstProgramDayId` 型追加（`WorkoutSummaryView`） | **完了 ✅** |
| `selectFirstProgramDayId` 実装（`workout-summary.ts`） | **完了 ✅** |
| "Restart Program" CTA（`WorkoutSummaryScreen.tsx`） | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/d4-reenroll-spec.md` 作成 | **完了 ✅** |

### DISCOVERY

- `findOrCreateEnrollment` は completed enrollment を無視し、**新 enrollment を INSERT** — re-enroll コアロジックは既実装
- `UNIQUE INDEX` が `WHERE status='active'` のみに適用 → completed は複数保持可能
- 欠けていたのは「Summary から firstProgramDayId を受け取り、Restart Program CTA を出す」UIだけ

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `firstProgramDayId: string \| null` を追加 |
| `lib/workout/workout-summary.ts` | `selectFirstProgramDayId` 追加。`isProgramCompleted` 時のみ呼び出し（+2クエリ） |
| `components/summary/WorkoutSummaryScreen.tsx` | `restartUrl` 生成、完走時 actions を "Restart Program" + "Choose Another Program" に変更 |
| `docs/d4-reenroll-spec.md` | 新規作成 |

### 完走後の CTA 分岐

| 状態 | Primary | Secondary |
|---|---|---|
| 完走 + firstDayId あり | **Restart Program** → `/train?program=<slug>&programDayId=<firstDayId>` | Choose Another Program → `/programs` |
| 完走 + firstDayId なし | Browse Programs → `/programs` | — |

---

## 2026-04-14 S-1 — Exercise Swap MVP

### STATUS

| 項目 | 状態 |
|---|---|
| API（PATCH swap endpoint） | **実装済み ✅**（S-1 以前から） |
| `postSwapExercise` クライアント関数 | **実装済み ✅**（S-1 以前から） |
| UI modal（Add/Swap 共有） | **実装済み ✅**（S-1 以前から） |
| `was_swapped` DB 列 | **実装済み ✅**（S-1 以前から） |
| Train「Swapped」バッジ追加 | **完了 ✅** |
| Summary「Swapped this session」バッジ追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/swap-spec.md` 作成 | **完了 ✅** |

### DISCOVERY

S-1 のコア機能（API・クライアント・モーダル・型・DB）は実装済みだった。
今回追加したのは視覚フィードバック（Swapped バッジ）のみ。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `components/workout/WorkoutScreen.tsx` | `wasSwapped` 時に Swapped バッジ表示（`headerHint` を差し替え） |
| `components/workout/WorkoutScreen.module.css` | `.swappedBadge` スタイル追加 |
| `components/summary/WorkoutSummaryScreen.tsx` | `wasSwapped` 時に「Swapped this session」バッジ追加 |
| `components/summary/WorkoutSummaryScreen.module.css` | `.swappedBadge` スタイル追加 |
| `docs/swap-spec.md` | 新規作成（API仕様・UIフロー・blocker条件・スコープ外） |

### OPEN ISSUES

| ID | 内容 |
|---|---|
| S-2 | 恒久 swap（program day への書き戻し） |
| S-3 | 代替種目の自動推薦 |
| S-4 | `original_exercise_id` DB 列追加（元種目追跡） |

---

## 2026-04-14 H-1 — Session History（直近セッション一覧）

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSessionListItem` / `SessionHistoryResult` 型追加 | **完了 ✅** |
| `lib/workout/session-list.ts` 新規作成 | **完了 ✅** |
| `app/session-history/page.tsx` 新規作成 | **完了 ✅** |
| `components/history/SessionHistoryScreen.tsx` 新規作成 | **完了 ✅** |
| Home ページに Session History リンク追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/session-history-spec.md` 作成 | **完了 ✅** |

### 変更ファイル

| ファイル | 内容 |
|---|---|
| `types/workout.ts` | `WorkoutSessionListItem` / `SessionHistoryResult` 型追加 |
| `lib/workout/session-list.ts` | 新規 — `getSessionHistoryView()` / 5クエリで session リストを構築 |
| `app/session-history/page.tsx` | 新規 — Server Component（`force-dynamic`） |
| `components/history/SessionHistoryScreen.tsx` | 新規 — カードリスト UI / auth guard / empty state |
| `components/history/SessionHistoryScreen.module.css` | 新規 |
| `app/page.tsx` | "Session History" ボタン追加 |
| `docs/session-history-spec.md` | 新規 — 仕様書 |

### 表示分岐

| 状態 | 表示 |
|---|---|
| 未ログイン | "Sign in is required to view session history." |
| 0 件 | Empty state + Train へのリンク |
| 1 件以上 | カード一覧（実施日・ステータス・プログラム名・種目数） |
| completed | "View summary →" リンク表示 |

---

## 2026-04-14 D-2 — Summary → 次 day 直接 CTA

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSummaryView` に `nextProgramDayId` / `programSlug` 追加 | **完了 ✅** |
| `workout-summary.ts` で UUID と slug を解決・返却 | **完了 ✅** |
| `WorkoutSummaryScreen.tsx` に Go to Next Day CTA 追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/day-progression-spec.md` 更新（D-2 セクション追加） | **完了 ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `nextProgramDayId: string \| null` / `programSlug: string \| null` を追加 |
| `lib/workout/workout-summary.ts` | `ProgramRow` に `slug` を追加、`nextProgramDayId` を outer scope に保持して view に渡す |
| `components/summary/WorkoutSummaryScreen.tsx` | `nextTrainUrl` 生成ロジック追加、actions に "Go to Next Day" CTA 追加 |
| `docs/day-progression-spec.md` | D-2 セクション追加（CTA ロジック・URL 組み立て・表示分岐） |

### CTA 表示分岐

| 状態 | Primary | Secondary |
|---|---|---|
| 通常完了（next day あり） | **Go to Next Day** → `/train?program=<slug>&programDayId=<uuid>` | Back to Train / Browse Programs |
| program 完走 | Back to Programs | Browse Programs |
| program なしセッション | Back to Train | Browse Programs |

---

## 2026-04-14 D-3 — idempotency guard（同一 day 再実行対策）

### STATUS

| 項目 | 状態 |
|---|---|
| root cause 特定 | **完了 ✅** |
| `advanceEnrollmentAfterSessionComplete` に guard 追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/day-progression-spec.md` 更新 | **完了 ✅** |

### ROOT CAUSE

`advanceEnrollmentAfterSessionComplete` が `session.program_day_id` から next day を計算して enrollment を更新する際、`enrollment.current_program_day_id` がすでに先に進んでいるかを確認していなかった。

古い day の新規セッションを Finish すると enrollment が巻き戻る（regression）可能性があった。

### FIX

`enrollment.current_program_day_id !== session.program_day_id` の場合に早期 return を追加。

```typescript
if (enrollment.current_program_day_id !== session.program_day_id) {
  return;  // 既に advance 済み — no-op
}
```

### 動作マトリクス

| シナリオ | 修正後 |
|---|---|
| 通常の初回 Finish | 正常に advance ✅ |
| 同一 session 再 Finish | Finish route が early return → guard 未到達 ✅ |
| 古い day の新規 session を Finish | guard で skip → regression なし ✅ |
| 最終 day 完了後の新規 session Finish | enrollment が completed → active 検索で取得不可 → return ✅ |

---

## 2026-04-14 D-1 — day progression（Summary Up Next / Program Complete）

### STATUS

| 項目 | 状態 |
|---|---|
| DB の day advancement | **既存実装が稼働中**（`advanceEnrollmentAfterSessionComplete` / `findNextProgramDayId`） |
| `WorkoutSummaryView` 型拡張 | **完了 ✅** |
| `getWorkoutSummaryView` に next day 解決追加 | **完了 ✅** |
| Summary UI — Up Next / Program Complete | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| ローカル確認（`/programs` 4 本・filter・認証ガード） | **pass ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `isProgramCompleted` / `nextProgramDayLabel` 追加 |
| `lib/workout/workout-summary.ts` | `findNextProgramDayId` を呼び出し next day ラベルを解決。`buildSummaryView` に渡す |
| `components/summary/WorkoutSummaryScreen.tsx` | Up Next カード・Program Complete カード・hero 色・back リンク先を分岐 |
| `components/summary/WorkoutSummaryScreen.module.css` | `.heroCompleted` / `.nextUpCard` / `.completedCard` を追加 |
| `docs/day-progression-spec.md` | 仕様・edge case・未対応事項を新規作成 |

### Summary の表示分岐

| 状態 | 表示 |
|---|---|
| 通常完了（次 day あり） | Up Next: Week N / Day N（青カード）/ Back to Train |
| プログラム完走（最終 day） | 完走メッセージ（黄金カード）/ Back to Programs |
| session 未完了 / エラー | state ごとのメッセージ |

### 未対応（今後の課題）

- 同一 day 再実行で enrollment が 2 day 進む問題（D-3 候補）
- Summary → 次 day 直接リンク（D-2 候補）
- program 完走後の re-enroll フロー（D-4 候補）

---

## 2026-04-14 C-7 — Dumbbell Full Body Base（4本目 seed）

### STATUS

| 項目 | 状態 |
|---|---|
| seed SQL（dumbbell-full-body-base.sql） | **実装完了・commit 3551def ✅** |
| program-metadata.sql（general-fitness / dumbbell タグ追加） | **更新完了・commit 3551def ✅** |
| mock catalog エントリ（program-catalog.ts） | **追加済み ✅** |
| live Supabase 反映 | **fully closed ✅（2026-04-14）** |
| program creation フェーズ | **一時終了 ✅** |

### seed 構成

| 項目 | 内容 |
|---|---|
| slug | `dumbbell-full-body-base` |
| title | `Dumbbell Full Body Base` |
| level | `beginner` |
| frequency | `3 days / week` |
| duration | `4 weeks` |
| source_fidelity | `custom` |
| split | A/B 交互（W1: A/B/A → W2: B/A/B → W3: A/B/A → W4: B/A/B） |
| Day A | Goblet Squat T1 3×12 / DB Bench Press T1 3×10 / DB Row T2 3×10 |
| Day B | Romanian Deadlift T1 3×12 / DB Shoulder Press T1 3×10 / DB Curl T2 3×12 |

### 追加 tags

| slug | label | axis |
|---|---|---|
| `general-fitness` | General Fitness | goal |
| `dumbbell` | Dumbbell | equipment |

### live 反映手順（手動実行 2 本）

```
1. seed/programs/dumbbell-full-body-base.sql
2. seed/programs/program-metadata.sql
```

### live 確認項目（SQL 実行後）

| 確認項目 | 期待値 |
|---|---|
| `/programs` に 4本目が追加される | Dumbbell Full Body Base が表示される |
| filter chip に Dumbbell が追加される | equipment 軸 |
| filter chip に General Fitness が追加される | goal 軸 |
| `/programs/dumbbell-full-body-base` detail が表示される | 4 weeks × 3 days の week preview |
| 既存 3本（GZCLP / Starting Strength / Upper Lower）の表示が壊れない | 変化なし |

---

## 2026-04-14 C-4 / C-5 fully closed

### STATUS

| 項目 | 状態 |
|---|---|
| C-4 live（Upper Lower Base） | **fully closed ✅** |
| C-5 live（gzclp-base correction） | **fully closed ✅** |
| 原典準拠ルール | **live 反映済み ✅** |
| live SQL hold | **解除 ✅** |
| upper-lower-base tags | **live fix 完了 ✅** |

### live 確認結果（2026-04-14）

| ページ | 確認項目 | 結果 |
|---|---|---|
| `/programs` | 3本表示（GZCLP Base / Starting Strength Phase 2 Base / Upper Lower Base） | ✅ |
| `/programs` | Level filter（Beginner 2件 / Intermediate 1件）が成立 | ✅ |
| `/programs` | filter chips（Beginner / Intermediate / Barbell / Full Body / Strength / Upper / Lower / Squat Focus / Explosive） | ✅ |
| `/programs` | Upper Lower Base カード tags（Strength / Barbell / Upper / Lower） | ✅ |
| `/programs/starting-strength-base` | title = `Starting Strength Phase 2 Base` | ✅ |
| `/programs/starting-strength-base` | Level=Beginner / 3 days/week / 3 weeks | ✅ |
| `/programs/starting-strength-base` | tags = Strength / Barbell / Full Body / Squat Focus | ✅ |
| `/programs/gzclp-base` | title = `GZCLP Base` | ✅ |
| `/programs/gzclp-base` | Level=Beginner / 3 days/week / 4 weeks | ✅ |
| `/programs/gzclp-base` | tags = Strength / Barbell / Full Body | ✅ |

### upper-lower-base tags live fix メモ

- **symptom:** `/programs` 一覧で Upper Lower Base の tag badge が非表示。filter chips に `Upper / Lower` も未表示
- **root cause:** `program-metadata.sql` の upper-lower-base 分はローカル定義済みだったが、live DB に未適用だった（C-3a-live 時点では upper-lower-base が未存在のため反映できなかった可能性が高い）
- **fix scope:** live DB のみ。`upper-lower-base` の `program_tag_assignments` 3件を補修（strength/goal, barbell/equipment, upper-lower/split）。`upper-lower` tag master も必要に応じて補完
- **repo 変更:** なし（ローカル seed 定義に不足はなかった）
- **verification:** `/programs` 一覧で Upper Lower Base カードに tags 表示、filter chips に `Upper / Lower` 追加を確認 ✅

### 確定した原典準拠ルール

- `gzclp-base`: `source_fidelity = original`（Cody Lefever GZCLP base month 準拠）
- `starting-strength-base`: `source_fidelity = original`（Starting Strength Novice Program Phase 2 切り出し）
- `upper-lower-base`: `source_fidelity = custom`（単一原典なしの internal template）

---

## 2026-04-13 Program Source Audit

### STATUS

| 項目 | 状態 |
|---|---|
| audit | 完了 |
| seed correction | 完了 |
| live SQL hold | **解除（2026-04-14）** |

### この更新で固定した原則

- 有名プログラムは、まず原典準拠版を正本にする
- 派生版は別 slug / 別 title / 別 metadata で管理する
- 元ネタがある場合、期間・頻度・日割り・種目順・セット回数・進行ロジック・リセット条件を勝手に変えない
- live Supabase への手動 SQL 実行は、監査後の反映順が固まるまで保留する

### 今回の整理内容

- `seed/programs/gzclp-base.sql`
  - original GZCLP base month に合わせて 3 days / 4 weeks / A1-B1-A2-B2 / T1-T2-T3 構成へ修正
- `seed/programs/starting-strength-base.sql`
  - `Starting Strength Phase 2 Base` として整理
  - slug は route 互換のため `starting-strength-base` を維持
- `seed/programs/upper-lower-base.sql`
  - 単一原典なしの internal custom template と明示
- `supabase/migrations/20260413_000010_program_source_metadata.sql`
  - `source_program_name`
  - `source_fidelity` (`original` / `adapted` / `custom`)
  - `source_notes`
- `seed/programs/program-metadata.sql`
  - 3 program の source metadata を正本化

### 現在の分類

| slug | title | source_program_name | source_fidelity | live 反映 |
|---|---|---|---|---|
| `gzclp-base` | `GZCLP Base` | `GZCLP` | `original` | **live pass ✅** |
| `starting-strength-base` | `Starting Strength Phase 2 Base` | `Starting Strength Novice Program - Phase 2` | `original` | **live pass ✅** |
| `upper-lower-base` | `Upper Lower Base` | `null` | `custom` | **live pass ✅**（tags 要確認） |

### 参照

- `docs/program-source-audit.md`

## 2026-04-13 C-5 — live 反映直前段階

### STATUS

| 項目 | 状態 |
|---|---|
| gzclp-base correction SQL | 完了 |
| live runbook | 完了 |
| live Supabase 反映 | **手動実行待ち** |

### 作成・更新ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `seed/programs/gzclp-base-live-correction.sql` | NEW | 既存 gzclp-base を原典準拠構成へ安全に更新する SQL（transaction + pre/post-check 付き） |
| `docs/live-runbook-gzclp-correction.md` | NEW | live 反映の実行手順書（確認チェックリスト・ロールバック観点・実行順まとめ） |

### gzclp-base-live-correction.sql の設計

| 観点 | 内容 |
|---|---|
| slug | 維持（`gzclp-base`）— route / enrollment FK 継続性を保つ |
| program.id | 維持 — `workout_sessions.program_enrollment_id` FK を壊さない |
| transaction | `begin; ... commit;` で囲む。エラー時は自動ロールバック |
| 構造更新方式 | `program_weeks` を DELETE → CASCADE（days / exercises も消える）→ 再 INSERT |
| enrollment 安全性 | `program_enrollments.current_week/day` は integer 型 — FK なし。削除後も壊れない |
| `workout_sessions.program_day_id` | `SET NULL` FK のため、旧 day_id は NULL になる（許容範囲） |
| 事前ガード | `gzclp-base` slug が存在しない場合は EXCEPTION で即 ABORT |
| enrollment NOTICE | active enrollment がある場合は RAISE NOTICE で警告（ブロックしない） |

### live 反映 SQL 実行順

```
1. gzclp-base-live-correction.sql  STEP 0（pre-check）
2. gzclp-base-live-correction.sql  STEP 1（correction、transaction）
3. gzclp-base-live-correction.sql  STEP 2（post-check）
4. program-metadata.sql            （tags / assignments upsert）
5. upper-lower-base.sql            （upper-lower-base が未作成の場合のみ）
```

詳細は `docs/live-runbook-gzclp-correction.md` を参照。

最終更新: 2026-04-13（C-4 完了 / Upper Lower Base seed 追加 — live 反映は手動 SQL 実行待ち）

## 現在地

### 限定公開到達点（2026-04-13 時点）

| 項目 | 状態 |
|---|---|
| public programs 閲覧 | `/programs` / `/programs/[slug]` は未ログインで表示可 ✅ |
| auth 基盤 | Supabase Email/Password sign in / sign up + session cookie ✅ |
| アプリ側 owner guard | finish / summary / set mutation / add exercise / swap exercise = 本人のみ ✅ |
| DB 側制限 | user_id NOT NULL 復元 + RLS 全テーブル適用済み ✅ |
| live workout flow | Program Detail → StartSession → Train → Add/Swap → Finish → Summary 通し確認済み ✅ |
| Exercise History auth 強化 | admin client → server client 統一 / middleware で `/exercise-history/*` 保護 ✅ |
| B-7 live 確認 | 未ログイン redirect（2 slug）/ ログイン済み表示（2 slug）/ 公開ルート非影響 ✅ |
| **C-3b live 確認** | **✅ pass（2026-04-13）— badge 表示確認済み** |
| **C-3c live 確認** | **✅ pass（2026-04-13）— detail metadata 行確認済み** |
| **Phase B 限定公開判断** | **Go ✅（2026-04-13）** |
| **Phase C-1 seed 運用 docs 化** | **完了 ✅（2026-04-13）** |
| **限定公開準備（デプロイガイド）** | **完了 ✅（2026-04-13）** |
| **限定公開実施** | **開始済み ✅（2026-04-13）** |
| **本番 URL** | **`https://training-program-platform-jp.vercel.app`** |
| **Vercel Production Branch** | **✅ `feature/auto-dev-phase3-loop` に変更済み（2026-04-13）** |

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth** で MVP 実装を継続中
- `/train` は workout session の実行画面として利用中
- Exercise History は `/exercise-history/[exerciseSlug]` で Supabase 読込済み
- Finish 後は `/workout-summary/[sessionId]` へ遷移する
- Programs 一覧は `/programs`
- Program Detail MVP は `/programs/[programSlug]`
- Programs list / detail / train selection は Supabase `programs` 読込を土台にしている
- route 用 slug の正本は `programs.slug` に移行済み
- **Program Detail → StartSessionScreen → session 開始** の最小 MVP が完成した
- **限定公開を開始（2026-04-13）**
  - 本番 URL: `https://training-program-platform-jp.vercel.app`
  - Supabase Authentication → URL Configuration 設定済み
  - 招待制運用で live 導線確認を完了
- **Phase B の設計固定（Auth / user_id 必須化 / RLS / 移行順）が完了**
  - 設計メモ: `docs/auth-rls-design.md`
  - 方針: `programs` は public のまま、session / enrollment / summary / history は auth 必須へ戻す
  - 安全方針: user-scoped API は service role 前提にせず、`server client + RLS` を優先する
- **Phase B Step 1 ログイン基盤を実装**
  - `/programs` と `/programs/[programSlug]` は public 維持
  - `/login` を追加
  - middleware は `/workout-summary/*` のみ保護
  - session 開始 API は未ログイン時 401 を返す
- **Phase B Step 1 の live 再確認を実施**
  - `auth.users -> public.users` 自動作成 trigger の live 反映を確認
  - `/login` -> `/programs` の sign in 導線を再確認
  - `/workout-summary/*` の未ログイン保護を再確認
  - Program Detail -> StartSession の未ログイン 401 / ログイン後 201 を再確認
- **Phase B Step 2 を実装**
  - finish / workout summary / workout_sets / workout_session_exercises / session exercise mutation を本人限定へ変更
  - 未ログイン時は user-scoped API が 401 を返す
  - 他人の session / set / summary は 404 で触れない
  - `train-session.ts` / `workout-summary.ts` / `enrollment.ts` の `user_id null` 依存を縮小
- **Phase B Step 3 実装完了（2026-04-13）**
  - migration 000006: `workout_sessions` / `program_enrollments` の null user_id 行を削除（live Supabase 適用済み）
  - migration 000007: 両テーブルの `user_id` を NOT NULL に復元。`idx_program_enrollments_active_user_program` の WHERE 句から `user_id IS NOT NULL` を除去（live Supabase 適用済み）
  - migration 000008: 全テーブルに RLS を有効化 + ポリシー適用（live Supabase 適用済み）
    - public テーブル（programs/exercises/program_weeks/program_days/program_day_exercises）: anon + authenticated が SELECT 可
    - user テーブル（users/enrollments/sessions/session_exercises/sets）: `auth.uid() = user_id` に一致する行のみ操作可
  - コード変更: `session-access.ts` / `enrollment.ts` / `start-session.ts` の client 生成を常に server client へ統一（admin client は RLS を無視するため除去）
  - typecheck: pass / build: pass 確認済み（commit 07cf8c1）
- **Phase B Step 3 ローカル動作確認（2026-04-13）**
  - `/programs` — 未ログインで表示される（server error なし、console error なし）✅
  - `/programs/gzclp-base` — 未ログインで表示される ✅
  - `/workout-summary/*` — ローカル dev 環境（Supabase 未設定）では "Supabase is not configured" を表示（live では `/login` へリダイレクト期待）
  - サーバーログ: error なし ✅
  - コンソールログ: error なし ✅
  - 注: ローカル dev 環境では Supabase 接続なしのため mock catalog fallback が動作。live Supabase への full flow 確認は手動チェック待ち
- **Phase B B-5: Add Exercise / Swap Exercise コードレビュー完了（2026-04-13）**
  - Add Exercise (`POST /api/workout-sessions/[id]/exercises`)
    - 未認証 → `getAuthenticatedWorkoutUserId()` が null → 401 を返す（live 環境で動作）
    - 他人 session_id → `findOwnedWorkoutSession` が null → 404（Step 2 と同じ owner guard パターン）
    - 本人 session → INSERT `workout_session_exercises` + `workout_sets` → RLS INSERT ポリシーを通過する構造を確認
      - exercise INSERT: `workout_session_id = session.id`（検証済み session）→ `session.user_id = auth.uid()` ✅
      - set INSERT: 直前の exercise INSERT 後に実行 → チェーン (set→exercise→session→auth.uid()) が成立 ✅
  - Swap Exercise (`PATCH /api/workout-sessions/[id]/exercises/[exerciseId]`)
    - 未認証 → 401（同上）
    - 他人 session_id → 404（同上）
    - exercise lookup: `.eq("workout_session_id", session.id)` で自分のセッションのみ対象 ✅
    - blocking set check: RLS で自分の session の sets のみ可視 ✅
    - UPDATE `workout_session_exercises` → RLS UPDATE ポリシー通過 ✅
  - ローカル dev テスト（Supabase 未設定）: 500 を返す（env vars なしで `createSupabaseServerClient()` が throw するため。live 環境では 401 → 404 → 成功の期待動作を実装通り確認）
  - **live ブラウザ clickthrough（StartSession → Add Exercise → Swap Exercise → Finish → Summary）完了（2026-04-13）**
    - Program Detail → StartSession → Train → Add Exercise → Swap Exercise → Finish → Summary の通し確認済み ✅

## 完了済み

- Train 画面の基本機能
  - Delete / Complete / Unlock
  - Kg / Reps PATCH 更新
  - Previous history 表示
  - Add Set
- Add Exercise
  - `POST /api/workout-sessions/{id}/exercises`
  - modal UI 実装済み
- Swap Exercise
  - `PATCH /api/workout-sessions/{id}/exercises/{exerciseId}`
  - Add / Swap modal 共通化
  - blocking set がある場合は 409
- Exercise History
  - route: `/exercise-history/[exerciseSlug]`
  - loader: `lib/workout/exercise-history.ts`
  - `auth.getUser()` の `user_id` と `exercises.slug` で絞り込み
  - completed set のみ表示
  - `loading` / `empty` / `error` 実装済み
- Finish summary
  - route: `/workout-summary/[sessionId]`
  - loader: `lib/workout/workout-summary.ts`
  - finish API は `summaryPath` を返す
  - normal finish / `forceFinish=true` のどちらでも summary へ遷移
  - `unauthenticated` / `not_found` / `not_completed` / `error` を画面で分岐
- Programs 一覧 MVP
  - route: `/programs`
  - loader: `lib/programs/program-list.ts`
  - 正本は Supabase `programs`
  - 利用項目は `id` / `slug` / `title` / `description` / `duration_weeks` / `days_per_week` / `level` / `is_public`
  - card は title / level / goal / frequency / duration を表示
  - C-3b で metadata 表示を追加
    - required tags: `goal / equipment / split`
    - optional tag: `focus` は最大 1 件だけ表示
    - `starting-strength-base` は `Squat Focus` badge で `gzclp-base` と差が見える状態に更新
  - C-3b live 修正（2026-04-13）
    - 症状: badge が本番で表示されなかった（`program.tags` が `[]`）
    - 原因: `program_tag_assignments` → `program_tags` の PostgREST 複合 FK join がサイレントエラー
    - 修正: 2クエリ + メモリ結合に変更（`lib/programs/program-library.ts`）
- Program Detail metadata 表示（C-3c）
  - `/programs/[slug]` detail 画面に required tags + optional focus タグ行を追加
  - `ProgramDetailScreen.tsx` / `ProgramDetailScreen.module.css` を変更
  - 一覧と詳細で badge 見た目・意味を統一済み
- Programs filter UI（C-3d）
  - Level / Tag チップ型フィルターを `/programs` に追加
  - client-side AND 結合、Clear ×、0件時 empty state
  - `ProgramsScreen.tsx` に `"use client"` + `useState` / `useMemo`
  - local preview で動作確認済み
- 3本目プログラム seed（C-4）
  - `seed/programs/upper-lower-base.sql` 新規作成（4 weeks × 4 days / week、intermediate）
  - `seed/programs/program-metadata.sql` 更新（upper-lower タグ追加、3プログラム正本化）
  - `lib/programs/program-catalog.ts` mock エントリを `upper-lower-base` へ整合
  - filter の Level 絞り込み（Beginner / Intermediate）と Split タグ（Full Body vs Upper / Lower）が意味ある差分を持つ状態に
  - **live 反映は手動 SQL 実行待ち**: Supabase Dashboard で `upper-lower-base.sql` → `program-metadata.sql` の順で実行
  - `loading` / `empty` / `error` 実装済み
  - summary の戻り先を `/programs` に統一済み
- Program Detail MVP
  - route: `/programs/[programSlug]`
  - loader: `lib/programs/program-detail.ts`
  - 一覧と同じ Supabase `programs` 読込を使用
  - route param は `programs.slug` を使用
  - title / level / goal / frequency / duration / overview を表示
  - `loading` / `ready` / `not_found` / `error` を分岐
  - `/programs` の card から detail route へ遷移可能
  - detail から `/programs` へ戻れる
- Program Detail -> Train の選択連携
  - detail の `Go to Train` は `/train?program=[programSlug]&programDayId=[firstProgramDayId]`
  - `firstProgramDayId`: week 1 / day 1 の UUID を Supabase から解決
  - `firstProgramDayId` が null の場合は `programDayId` なしで遷移し、従来導線を維持
  - train 側 helper は `lib/workout/train-selection.ts`
  - `program` query 一致時のみ selected program title / source を表示
  - `program` query 不一致時のみ warning を表示しつつ current session を継続
  - query なしは従来どおり
- Programs 系 read path の DB slug 化
  - 共通 helper: `lib/programs/program-library.ts`
  - migration で `programs.slug` を追加し、backfill 後に `NOT NULL + UNIQUE` を付与
  - slug ルールは title を slugify し、重複時は `-2`, `-3` suffix で安定採番
  - insert / update で slug が未指定または空なら DB trigger で採番
  - Supabase 読込時は DB の `programs.slug` を使い、読込失敗時のみ `mock_catalog` fallback
  - `mock_catalog` fallback は mock 側の `slug` を維持
  - 読込成功で 0 件のときは empty / not_found / invalid をそのまま表示
- Home 導線
  - `/` は Programs を第一導線、Train を第二導線に整理済み
- **enrollment 最小実装**
  - helper: `lib/workout/enrollment.ts`
    - `findActiveEnrollment(programId, userId)` — active enrollment を検索
    - `findOrCreateEnrollment(programId, firstProgramDayId, userId)` — なければ作成
    - `resolveStartProgramDayId(programId, firstProgramDayId, userId)` — enrollment current day > first day の優先解決
    - `findNextProgramDayId(currentDayId)` — 同 week 次 day → 次 week day 1 → null（完了）の順で解決
    - `advanceEnrollmentAfterSessionComplete(sessionId)` — Finish 後に enrollment を進める
  - migration: `20260412_000004_enrollment_current_day_id.sql`
    - `program_enrollments.current_week/current_day` を削除
    - `program_enrollments.current_program_day_id uuid` を追加（day UUID 直接保持）
    - `program_enrollments.updated_at` を追加
    - `program_enrollments.user_id` を nullable 化（MVP、auth 整備後に戻す）
    - partial unique index: `(user_id, program_id) WHERE status='active' AND user_id IS NOT NULL`
  - Program Detail → `startProgramDayId` を enrollment ベースで解決（enrollment > firstProgramDayId > null）
  - `ProgramDetailView` に `startProgramDayId` / `hasActiveEnrollment` を追加
  - Finish 後に `advanceEnrollmentAfterSessionComplete` を呼び enrollment を次 day へ進める
  - 最終 day 完了時: `enrollment.status = 'completed'`、`current_program_day_id` は最後の day のまま維持（ゼロ化しない）
- **session 開始 MVP（program_day_id ベース）**
  - 開始単位: `program_day_id`（Week 1 / Day 1 の UUID）
  - `enrollment_id` は今回スコープ外（未使用）
  - helper: `lib/workout/start-session.ts::startSessionForDay()`
    - 重複防止: 同一 `program_day_id` の `in_progress` セッションが存在すれば即 `reused=true` を返す
    - `program_day_exercises` を読み込み `workout_session_exercises` + `workout_sets` を seed
    - `user_id` は auth があれば設定、なければ null（migration 3 で nullable 化）
  - helper: `lib/workout/start-session.ts::getProgramDayLabel(programDayId)`
    - `program_days.day_number` + `program_weeks.week_number` を JOIN して `"Week N / Day N"` を返す
    - Supabase 未接続時は `"Week 1 / Day 1"` にフォールバック
  - API: `POST /api/workout-sessions { program_day_id }` → `{ sessionId, reused }` を返す
  - 画面: `StartSessionScreen`（`components/workout/StartSessionScreen.tsx`）
    - Program タイトル / 動的 day ラベル（DB から取得）を表示
    - Start Workout ボタン → API 呼び出し → `/train?program=[slug]` へ遷移
    - Cancel → `/programs/[slug]` へ戻る
  - `/train` ルーティング:
    - `programDayId` あり + `in_progress` セッション存在 → `WorkoutScreen`
    - `programDayId` あり + セッションなし → `StartSessionScreen`
    - `programDayId` なし → 従来どおり `getCurrentWorkoutSessionView()`
- migration: `20260412_000003_nullable_session_user.sql`
- **Phase B 設計メモ更新（2026-04-12）**
  - auth 依存箇所の洗い出しを完了
  - `user_id` 必須化の DB / API / server / client 変更点を整理
  - RLS 最小設計案を整理
  - Workout Summary の auth なし暫定対応を戻す条件を明文化
  - 実装順を `1. login基盤 -> 2. user_id必須化 -> 3. NOT NULL + RLS` で固定
- **Phase B Step 1 実装（2026-04-12）**
  - migration: `20260412_000005_auth_user_profile_trigger.sql`
    - `auth.users -> public.users` 自動 insert trigger を追加
    - 既存 `auth.users` の backfill insert を追加
  - browser client: `lib/supabase/client.ts`
  - login page: `app/login/page.tsx`
    - Email / Password の sign in / sign up トグルを追加
    - 成功時は `/programs` に遷移
    - env 未設定 / auth エラーの表示あり
  - middleware: `middleware.ts`
    - `/workout-summary/*` だけを保護
    - `/programs` と `/programs/[programSlug]` は保護しない
  - session 開始の入口だけ先行保護
    - `lib/workout/start-session.ts`: 未ログイン時 `unauthenticated`
    - `POST /api/workout-sessions`: 401 を返す
    - `StartSessionScreen`: 401 時に `/login` 導線を表示

## 次アクション

1. **C-3c: Program Detail metadata 表示**
   - 一覧で使い始めた metadata を `/programs/[slug]` にも載せる
   - required / optional tag の見せ分けを detail で整理する
   - filter UI を入れる前に detail 側の情報密度を整える
2. **B-6: sign up 429 の再確認（低優先）**
   - live Supabase Auth の `over_email_send_rate_limit` により未通過（外部レート制限、実装不備ではない）
   - 時間経過後に再試行する
3. helper 旧形式 slug から DB slug への redirect 方針が必要かを判断する

## 保留事項

- Supabase 読込失敗時のみ `mock_catalog` fallback が残る
- `lib/programs/program-library.ts` / `lib/programs/program-detail.ts` は admin client のまま（programs は public RLS ポリシーがあるため実害なし。Phase C で server client 統一を検討）
- user-scoped な通常ユーザーフロー（train/summary/history）は server client + RLS に統一済み
- service role は通常ユーザーフローでは使用しない方針。管理処理専用に限定する
- Delete undo は MVP スコープ外
- live sign up は `over_email_send_rate_limit` が解消するまで再試行待ち（外部レート制限、実装不備ではない）
- 招待制運用のため、案内先 URL と配布アカウントの棚卸しを継続する

## Phase C 進捗

### 限定公開開始（完了 2026-04-13）

- Vercel 本番 URL: `https://training-program-platform-jp.vercel.app`
- Supabase URL Configuration を本番 URL に更新済み
- live 確認結果
  - `/programs` 表示成功
  - 未ログインで保護ページは `/login` へ redirect
  - ログイン後 `/exercise-history/squat` 表示成功
  - `/train` → Finish → `/workout-summary` 成功
  - `/exercise-history/overhead-press` に 5 セット履歴反映成功
- 判定: 限定公開は成功。次フェーズは C-2 に戻る

### 限定公開準備（完了 2026-04-13）

- `docs/limited-release-guide.md` — Vercel + Supabase 限定公開の全手順
  - 役割分担（Vercel / Supabase / GitHub）
  - 環境変数 3 つの用途・設定手順
  - Supabase Site URL / Redirect URL 設定
  - デプロイ手順（Vercel プロジェクト作成 → env 設定 → デプロイ → URL 設定）
  - 招待制ユーザー管理手順
  - スモークテスト（公開ルート / 認証フロー / ワークアウトフロー）
  - よくある失敗点
- `docs/limited-release-checklist.md` — 限定公開前チェックリスト（7セクション）
- `.env.example` — 環境変数テンプレートにコメント追加（用途・注意点を明記）

### C-1: seed 運用ルール docs 化（完了 2026-04-13）

- `docs/seed-program-guide.md` — プログラム追加の完全ガイド
  - 追加順序（exercises → programs → weeks → days → day_exercises）
  - 各テーブルの制約（slug 一意・order_index 一意・exercise_type 制約等）
  - UUID ハードコード禁止 / `do $$ ... $$` + `SELECT INTO` パターンを規定
  - idempotent 設計（同一 slug なら全体スキップ）
  - ローカル反映手順・確認クエリ・失敗しやすい点
  - 既存プログラムを壊さない更新方針
- `seed/programs/_template.sql` — 新規追加用テンプレート
  - 全プレースホルダーにコメント付き
  - 週 / 日 / 種目の構造を拡張しやすい形で記述
  - 確認クエリをコメントで同梱

### C-2 以降（更新 2026-04-13）

- C-2: 2本目のプログラム追加（Starting Strength Base を live 反映済み）
- C-3: プログラム難易度・タグ管理
- C-4: ユーザー進捗ダッシュボード

### C-2: 2本目プログラム追加（完了 2026-04-13）

- 候補: `Starting Strength Base`
- 判断理由
  - `GZCLP Base` と同じ初心者向けバーベル軸だが、`Starting Strength Base` は「スクワット毎回」「A/B 交互」「Power Clean を含む」構成で役割を分けやすい
  - 既存 seed の `squat / bench-press / overhead-press / deadlift` を再利用でき、追加種目は `power-clean` の 1 つだけで済む
- 適用結果
  - `seed/programs/starting-strength-base.sql`
  - service role 経由で live Supabase に反映済み（CLI / `psql` 未導入のため）
  - `starting-strength-base` program 作成済み
  - 3 weeks x 3 days、27 件の `program_day_exercises` を確認済み
  - `power-clean` を含む exercise 参照成立済み
- live 確認結果
  - `/programs` に `Starting Strength Base` 表示成功
  - `/programs/starting-strength-base` 表示成功
  - detail の `Go to Train` が `/train?program=starting-strength-base&programDayId=...` を指すことを確認
  - `/train` 入口で `Starting Strength Base` / `Week 1 / Day 1` / `Start Workout` を確認
- 補足
  - 初回適用時に Power Clean の日本語名と description が `?` で入ったため、live DB 上で日本語文字列を修正済み
  - 既存 `GZCLP Base` は `slug / title / level / is_public / duration_weeks / days_per_week` に変更なし

### C-2b: seed 原本整合（完了 2026-04-13）

- `seed/programs/starting-strength-base.sql` の日本語文字列を live 修正内容に合わせて更新
  - `power-clean.name_ja`
  - `program.description`
  - `program_days.progression_guide`
  - `program_days.notes`
- seed 内の実データ文字列は `U&'...'` の Unicode escape 形式へ変更し、文字コード差分の影響を受けにくくした
- `docs/seed-program-guide.md` に UTF-8 保存と SQL Editor 貼り付け時の注意を追記
- 正本方針を回復
  - repo の seed 原本 = live DB へ反映したい状態
  - live DB の手修正内容は seed 原本へ戻し込み済み

### C-3: プログラム metadata 設計（完了 2026-04-13）

- `docs/program-metadata-design.md` を追加し、`/programs` 比較用 metadata の仕様を固定
- level 方針
  - DB canonical value は `beginner / intermediate / advanced`
  - UI は `Beginner / Intermediate / Advanced` 表示
  - `novice` は現時点では採用しない
- tag 方針
  - required: `goal`, `equipment`, `split`
  - optional: `focus`
  - `level / days_per_week / duration_weeks` は tag に重複させない
- 既存 2 本への仮割り当て
  - `gzclp-base`: `strength`, `barbell`, `full-body`
  - `starting-strength-base`: `strength`, `barbell`, `full-body`, `squat-focus`, `explosive`
- 次は C-3 実装として schema / seed / `/programs` 表示反映へ進む

### C-3a: metadata 基盤実装（完了 2026-04-13）

- migration を追加
  - `supabase/migrations/20260413_000009_program_metadata_foundation.sql`
  - `programs.level` を `beginner / intermediate / advanced` の canonical value に正規化
  - `program_tags` / `program_tag_assignments` を追加
  - axis は `goal / equipment / split / focus` のみに制限
  - `goal / equipment / split` は `program_id + axis` の unique index で single-select 制御
  - public reference data として RLS の read policy を追加
- seed を追加
  - `seed/programs/program-metadata.sql`
  - `gzclp-base` と `starting-strength-base` に metadata を付与する idempotent seed
- read path を追加
  - `types/programs.ts`: `ProgramLevel`, `ProgramTag`, `levelKey`, `tags`
  - `lib/programs/program-library.ts`: program ごとに metadata tags を取得する土台を追加
  - metadata table 未適用時は warning を出しつつ tags を空配列にして既存 `/programs` を壊さない
  - `lib/programs/program-catalog.ts`: mock catalog は fallback 維持、metadata tags は空配列で非正本扱い
- 次は C-3b として `/programs` list / detail の metadata 表示を実装する

### C-3a-live: metadata live 反映（完了 2026-04-13）

- live Supabase へ反映済み
  - migration: `20260413_000009_program_metadata_foundation.sql`
  - seed: `seed/programs/program-metadata.sql`
- SQL 確認結果
  - `program_tags_count = 5`
  - `program_tag_assignments_count = 8`
  - `gzclp-base`: required `goal / equipment / split` が各 1
  - `starting-strength-base`: required `goal / equipment / split` が各 1、optional `focus = 2`
- live route 確認
  - `/programs`
  - `/programs/gzclp-base`
  - `/programs/starting-strength-base`
  - いずれも `Source: Supabase` で正常表示を確認

### C-3b: `/programs` metadata 表示（完了 2026-04-13）

- `components/programs/ProgramsScreen.tsx`
  - list card に `level` badge を維持
  - required tags を `goal -> equipment -> split` の順で表示
  - optional `focus` は最大 1 件だけ補助 badge として表示
- `components/programs/ProgramsScreen.module.css`
  - 既存 card デザインに合わせた最小 pill / badge を追加
- 表示差分
  - `gzclp-base`: `Strength / Barbell / Full Body`
  - `starting-strength-base`: `Strength / Barbell / Full Body + Squat Focus`
- local / live とも `/programs` 一覧で表示崩れなく比較性が上がった

---

## テスト状況

- `npm run typecheck`
  - pass
- `npm run build`
  - pass
- **限定公開 live 実施確認（2026-04-13 完了）**
  - 本番 URL: `https://training-program-platform-jp.vercel.app`
  - `/programs` 表示成功 ✅
  - 未ログインで保護ページは `/login` に redirect ✅
  - ログイン後 `/exercise-history/squat` 表示成功 ✅
  - `/train` → Finish → `/workout-summary` 成功 ✅
  - `/exercise-history/overhead-press` に 5 セット履歴反映成功 ✅
- **Phase B B-7: Exercise History auth 強化 + live 確認（2026-04-13 完了）**
  - 未ログイン `/exercise-history/squat` → `/login?next=%2Fexercise-history%2Fsquat` redirect ✅
  - 未ログイン `/exercise-history/overhead-press` → `/login?next=%2Fexercise-history%2Foverhead-press` redirect ✅（slug 変更でも `next` 正確）
  - ログイン済み `/exercise-history/squat` → T1 / Squat 表示（Supabase DB 取得）✅
  - ログイン済み `/exercise-history/bench-press` → T3 / Bench Press 表示（Supabase DB 取得）✅
  - 未ログイン `/programs` → redirect なし・一覧表示 ✅（middleware の公開ルート通過を確認）
  - 未ログイン `/programs/gzclp-base` → redirect なし・詳細表示 ✅
  - 画面崩れ・500 エラーなし ✅
- **Phase B B-7: Exercise History auth 強化 実装詳細（2026-04-13）**
  - `lib/workout/exercise-history.ts`: admin client 条件分岐を削除し、常に server client を使用
    - 変更前: `hasSupabaseServiceRoleEnv() ? createSupabaseAdminClient() : serverClient`
    - 変更後: `const queryClient = serverClient`
    - 不要になった `createSupabaseAdminClient` / `hasSupabaseServiceRoleEnv` import を削除
  - `middleware.ts`: matcher に `/exercise-history/:path*` を追加
    - 未ログイン時は `/login?next=/exercise-history/[slug]` へ redirect
    - 変更前: `matcher: ["/workout-summary/:path*"]`
    - 変更後: `matcher: ["/workout-summary/:path*", "/exercise-history/:path*"]`
  - `train-session.ts` / `workout-summary.ts`: B-3 で `createWorkoutQueryClient()` → server client 統一済み。追加変更なし
  - typecheck: pass / build: pass 確認済み（commit 後 live 確認推奨）
  - 認可境界の担保:
    - middleware で未ログイン遮断（redirect to `/login`）
    - `getExerciseHistoryView` 内で `auth.getUser()` による userId チェック（二重防衛）
    - `selectRecentUserSessions` で `.eq("user_id", userId)` — 本人セッションのみ取得
    - RLS: `workout_sessions` の SELECT ポリシー `auth.uid() = user_id` がクエリを本人に限定
    - 後続の `session_exercises` / `sets` クエリは本人セッション IDs を起点とするため他ユーザーデータ混入なし
- **Phase B B-3/B-4/B-5 live 手動確認（2026-04-13 完了）**
  - Program Detail → StartSession → Train → Add Exercise → Swap Exercise → Finish → Summary 通し確認 ✅
  - Supabase dashboard: null user_id = 0 件 / NOT NULL 制約 / RLS ポリシー適用済み ✅
  - 未ログイン時の 401 保護・他ユーザー session → 404 の動作確認 ✅
- **Phase B Step 3 ローカル dev 確認（2026-04-13）**
  - `/programs` — 未ログイン・Supabase 未設定環境で表示確認 ✅（mock fallback 動作）
  - `/programs/gzclp-base` — 未ログインで表示確認 ✅
  - `/workout-summary/test-session-id` — "Supabase is not configured" 表示（Supabase 未設定のため。live では `/login` リダイレクト期待）
  - server error: なし ✅ / console error: なし ✅
- **Phase B Step 2 local browser + live Supabase 確認（2026-04-12）**
  - sign in 相当
    - auth cookie を使った browser context で `/programs` 表示を確認
  - StartSession（本人）
    - user A / user B とも `POST /api/workout-sessions` が `201`
  - workout summary（未ログイン）
    - `/workout-summary/[sessionId]` は `/login?next=...` へ redirect
  - Finish（未ログイン）
    - `POST /api/workout-sessions/[id]/finish` が `401`
  - Finish（他人 session）
    - user A から user B の session finish は `404`
  - workout set complete（他人 set）
    - user A から user B の set complete は `404`
  - Finish（本人 session）
    - user A の session finish は `200`
    - `summaryPath` を返し、本人 summary を表示
  - workout summary（他人 session）
    - user A で user B の summary を開くと `Workout summary not found`
- **Phase B Step 1 live 手動確認（2026-04-12 再確認済み）**
  - `/programs`
    - 未ログインでも表示可
  - `/programs/gzclp-base`
    - 未ログインでも表示可
  - `/workout-summary/[sessionId]`
    - 未ログイン時は `/login?next=...` へ redirect されることを再確認
  - Program Detail -> StartSession（未ログイン）
    - `POST /api/workout-sessions` が `401` を返すことを確認
    - メッセージ「ログインするとワークアウトを開始できます。」と `/login` 導線表示を再確認
  - sign in
    - **pass**
    - fresh verified test user で `/login` -> `/programs` redirect を再確認
  - StartSession（ログイン済み）
    - **pass**
    - `POST /api/workout-sessions` が `201` を返し、`sessionId` を受け取れることを確認
    - `/programs/gzclp-base` -> `Go to Train` -> `Start Workout` 後に `/train?program=gzclp-base` へ遷移し、WorkoutScreen 表示を再確認
  - `public.users` 自動作成
    - **pass**
    - live Supabase で fresh verified test user 作成直後に `public.users(id)` 行が自動作成されることを確認
    - `20260412_000005_auth_user_profile_trigger.sql` の live 反映前提で再確認完了
  - sign up
    - **pending / external**
    - live Supabase Auth が引き続き `429 over_email_send_rate_limit` を返し、browser 上で `email rate limit exceeded` 表示
    - auth user は作成されず、外部レート制限継続中と判断
- **live Supabase E2E（2026-04-12 完了）**
  - Programs → GZCLP Base → StartSession → Train → Finish → Summary まで通し確認済み
  - DB: `workout_sessions.status = completed`, `program_enrollment_id` 紐付き確認済み
  - enrollment `current_program_day_id` は Day 2 に進行（SQL Editor で確認）

## 直近の重要判断

- Programs list / detail / train selection の正本は Supabase `programs` とする
- route 用 slug は helper 導出を廃止し、Supabase `programs.slug` を正本にする
- slug は title を base に slugify し、重複時は `-2`, `-3` suffix で安定採番する
- 既存 row は migration の backfill で埋め、今後の insert / update は DB trigger で補完する
- fallback は Supabase 読込失敗時のみ `mock_catalog` を使う。空データはそのまま empty / not_found / invalid として扱う
- Workout Summary の戻り先は `/` ではなく `/programs`
- `screens.md` と `PROJECT_STATUS.md` は日本語ベースで継続する
- **開始単位は `program_day_id`、enrollment_id は今回スコープ外とした**
  - 理由: enrollment フローを先に作ると scope が大きくなりすぎる。まず「選んだ day を開始できる」を優先した
- **`workout_sessions.user_id` を nullable にした（migration 3）**
  - 理由: 未認証 MVP では `public.users` FK を満たせないため。auth 整備後に戻す方針
- **Phase B の通常ユーザーフローでは service role を使わない方針に修正（2026-04-12）**
  - 理由: admin client は RLS を無視するため、`ログイン済み` チェックだけだと他人の session / set を触れる危険がある
  - user-scoped API / loader は `server client + cookie + RLS` を第一選択にする
- **Step 1 では public 導線を維持する判断（2026-04-12）**
  - `/programs` と `/programs/[programSlug]` は保護しない
  - まず `/workout-summary/*` と session 開始だけに auth を入れ、Phase A の閲覧導線を壊さない
- **Step 1 は完了扱いに更新（2026-04-12）**
  - `auth.users -> public.users` 自動作成 trigger の live 反映を確認
  - sign in / protected route / StartSession auth gate / StartSession logged-in success を再確認
  - browser sign up は `over_email_send_rate_limit` 継続中だが、外部レート制限による pending と判断し Step 1 の blocker から外す
- **Step 2 はアプリ側 owner guard を優先して実装（2026-04-12）**
  - RLS 前でも、finish / summary / set mutation / session exercise mutation は `user_id` と関連 session を必ず照合する
  - 未ログインは `401`、他人データは `404`、完了済み session への mutation は `409` で止める
- **Next.js 14 の fetch cache 問題を修正（2026-04-12）**
  - `createSupabaseAdminClient` / `createSupabaseServerClient` に `global.fetch` で `cache: 'no-store'` を設定
  - Server Component から Supabase を呼ぶとき Next.js が fetch 結果をキャッシュしていた
  - API Route は影響を受けないが Server Component（page.tsx）は同じ fetch URL をキャッシュする
  - `force-dynamic` はページのキャッシュを無効化するが fetch キャッシュは別途対処が必要
