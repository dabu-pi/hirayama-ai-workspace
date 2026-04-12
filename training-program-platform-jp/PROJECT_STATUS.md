# PROJECT_STATUS

Last updated: 2026-04-12

## Current position

- `training-program-platform-jp` is in active MVP implementation with **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth**
- `/train` renders workout sessions with existing logging and exercise operations
- Exercise History is connected to Supabase live reads at `/exercise-history/[exerciseSlug]`
- Finish now redirects to `/workout-summary/[sessionId]`
- Programs library MVP is available at `/programs`

## Completed

- Train screen base implementation
  - Delete / Complete / Unlock
  - Kg / Reps PATCH updates
  - Previous history display
  - Add Set
- Add Exercise
  - `POST /api/workout-sessions/{id}/exercises`
  - modal UI connected
- Swap Exercise
  - `PATCH /api/workout-sessions/{id}/exercises/{exerciseId}`
  - shared Add / Swap modal
  - returns 409 when blocking sets exist
- Exercise History live connection
  - route: `/exercise-history/[exerciseSlug]`
  - loader: `lib/workout/exercise-history.ts`
  - filters by signed-in `user_id` and selected `exercises.slug`
  - reads completed sets only
  - supports `loading`, `empty`, and `error`
- Finish summary flow
  - route: `/workout-summary/[sessionId]`
  - loader: `lib/workout/workout-summary.ts`
  - finish API returns `summaryPath`
  - train screen redirects to summary after normal finish or `forceFinish=true`
  - summary supports `unauthenticated`, `not_found`, `not_completed`, and `error`
- Programs library MVP
  - route: `/programs`
  - loader: `lib/programs/program-list.ts`
  - current source: `lib/programs/program-catalog.ts` mock catalog
  - cards show title, level, goal, frequency, and duration
  - supports `loading`, `empty`, and `error`
  - summary secondary action now returns to `/programs`
- Home route guidance
  - `/` now points users to Programs first and Train second

## Next actions

1. Implement program detail route and connect cards to a real destination
2. Replace the mock program catalog with Supabase-backed program list reads when schema and operations are ready
3. Validate the new routes against a live Supabase environment
4. Finalize Auth and RLS behavior for production use

## Pending / open items

- Programs detail route does not exist yet
- Program catalog is still mock data for MVP
- Service role / production auth setup is not finalized
- RLS policy design is still pending
- Delete undo flow is still out of scope for MVP

## Test status

- `npm run typecheck`
  - pass
- `npm run build`
  - pass

## Recent key decisions

- Use server-side helper loading for Programs as the same pattern used by Exercise History and Workout Summary
- Keep Programs data mock-backed for now so the route can serve as a stable navigation target before live catalog management exists
- Move Workout Summary secondary navigation from `/` to `/programs`
- Keep `/train` compatible with mock fallback while newer read-only routes use live Supabase data
