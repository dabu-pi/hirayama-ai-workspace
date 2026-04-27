-- G-4: gym_sponsors table + RLS
--
-- Design:
--   - Public read: anon + authenticated can SELECT when is_published = true.
--   - Admin write: insert / update / delete restricted to users with role = 'admin'.
--   - Admin full-read: admins can SELECT all rows including is_published = false.
--   - Application code uses createSupabaseAdminClient() (bypasses RLS) for the
--     /admin/gym-sponsors page, so admin SELECT policy is informational / safe.
--   - updated_at is kept current via trigger (reuses set_updated_at() from G-2).

begin;

create table public.gym_sponsors (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  description   text        not null default '',
  url           text,
  image_url     text,
  is_published  boolean     not null default true,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.gym_sponsors enable row level security;

-- Public: anyone can read published sponsors
create policy "Published sponsors are readable by everyone"
  on public.gym_sponsors
  for select
  to anon, authenticated
  using (is_published = true);

-- Admin: can read ALL sponsors (including unpublished)
create policy "Admins can read all sponsors"
  on public.gym_sponsors
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin: insert
create policy "Admins can insert sponsors"
  on public.gym_sponsors
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin: update
create policy "Admins can update sponsors"
  on public.gym_sponsors
  for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin: delete
create policy "Admins can delete sponsors"
  on public.gym_sponsors
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- set_updated_at() was created in G-2 (20260427_000023_gym_announcements.sql).
-- Using create or replace to be safe in case of partial rollbacks.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gym_sponsors_updated_at
  before update on public.gym_sponsors
  for each row execute procedure public.set_updated_at();

commit;
