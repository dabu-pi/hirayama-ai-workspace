-- G-2: gym_announcements table + RLS
--
-- Design:
--   - Public read: anon + authenticated can SELECT when is_published = true.
--   - Admin write: insert / update / delete restricted to users with role = 'admin'
--     (defense-in-depth; application code also enforces this via requireAdminUserId).
--   - Admin full-read: admins can SELECT all rows including is_published = false.
--   - Application code uses createSupabaseAdminClient() (bypasses RLS) for the
--     /admin/gym-announcements page, so admin SELECT policy is informational / safe.
--   - updated_at is kept current via trigger.

begin;

create table public.gym_announcements (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null,
  body          text        not null default '',
  is_published  boolean     not null default false,
  display_order integer     not null default 0,
  published_at  timestamptz,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.gym_announcements enable row level security;

-- Public: anyone can read published announcements
create policy "Published announcements are readable by everyone"
  on public.gym_announcements
  for select
  to anon, authenticated
  using (is_published = true);

-- Admin: can read ALL announcements (including unpublished)
create policy "Admins can read all announcements"
  on public.gym_announcements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin: insert
create policy "Admins can insert announcements"
  on public.gym_announcements
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin: update
create policy "Admins can update announcements"
  on public.gym_announcements
  for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin: delete
create policy "Admins can delete announcements"
  on public.gym_announcements
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── updated_at trigger ───────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gym_announcements_updated_at
  before update on public.gym_announcements
  for each row execute procedure public.set_updated_at();

commit;
