-- G-5: gym_consultation_requests table + RLS
--
-- Design:
--   - Public INSERT: anon + authenticated can submit requests (user_id optional).
--   - User SELECT: authenticated users can read their own requests (user_id = auth.uid()).
--   - Admin: full SELECT / UPDATE / DELETE access.
--   - Application code uses createSupabaseAdminClient() for admin page queries,
--     and for public inserts to ensure atomicity regardless of RLS.
--   - updated_at is kept current via trigger (reuses set_updated_at() from G-2).

begin;

create table public.gym_consultation_requests (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        references auth.users(id) on delete set null,
  requester_name  text        not null,
  contact         text        not null default '',
  request_type    text        not null default 'trainer_consultation',
  preferred_date  text        not null default '',
  message         text        not null default '',
  status          text        not null default 'new',
  admin_note      text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint gym_consultation_requests_request_type_check
    check (request_type in ('trainer_consultation', 'personal_training', 'other')),
  constraint gym_consultation_requests_status_check
    check (status in ('new', 'contacted', 'closed'))
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.gym_consultation_requests enable row level security;

-- Public: anyone (including anon) can submit a request
create policy "Anyone can submit consultation requests"
  on public.gym_consultation_requests
  for insert
  to anon, authenticated
  with check (true);

-- User: can read their own requests when logged in
create policy "Users can read own consultation requests"
  on public.gym_consultation_requests
  for select
  to authenticated
  using (user_id = auth.uid());

-- Admin: can read all requests
create policy "Admins can read all consultation requests"
  on public.gym_consultation_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin: update (status, admin_note)
create policy "Admins can update consultation requests"
  on public.gym_consultation_requests
  for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin: delete
create policy "Admins can delete consultation requests"
  on public.gym_consultation_requests
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

create trigger gym_consultation_requests_updated_at
  before update on public.gym_consultation_requests
  for each row execute procedure public.set_updated_at();

commit;
