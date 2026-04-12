# screens

Last updated: 2026-04-12

## Current routes

### `/`

- Home entry for the current MVP
- Primary action links to `/programs`
- Secondary action links to `/train`
- Explains the current Programs -> Train -> Summary flow

### `/programs`

- Program library MVP route
- Uses a server-side helper: `lib/programs/program-list.ts`
- Current data source is `lib/programs/program-catalog.ts` mock catalog
- Shows loading, empty, and error states
- Program cards expose the minimum summary needed before a detail route exists:
  - title
  - level
  - goal
  - frequency
  - duration
- Keeps the visual tone aligned with Train and Summary

### `/train`

- Active workout session screen
- Supports logging, set editing, add exercise, and swap exercise
- Finish success redirects to `/workout-summary/[sessionId]`
- Supabase is still optional here and mock fallback remains for local MVP use

### `/exercise-history/[exerciseSlug]`

- Exercise history for the signed-in user and selected exercise
- Backed by Supabase reads through a server-side helper
- Shows loading, empty, and error states
- Sorted newest first

### `/workout-summary/[sessionId]`

- Completion summary for a finished workout session
- Only shows sessions that belong to the signed-in user
- Uses server-side loading
- Handles `unauthenticated`, `not_found`, `not_completed`, and `error` states
- Secondary navigation now returns to `/programs`

## Summary screen MVP fields

- Completion message
- Program title
- Week / day label
- Finished timestamp
- Completed exercise list
- Completed set count / total visible set count for each exercise
- Navigation back to Train and Programs

## Data-source memo

- Programs list currently uses a mock catalog so the library route can exist before live catalog management is ready
- Exercise History reads Supabase live data
- Workout Summary reads Supabase live data
- Train still keeps a mock fallback when Supabase is not configured
