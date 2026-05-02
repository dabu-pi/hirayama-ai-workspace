-- Program metadata foundation for C-3a.
--
-- Goals:
--   1. Fix `programs.level` to canonical values:
--        beginner / intermediate / advanced
--   2. Add public program tag tables:
--        program_tags / program_tag_assignments
--   3. Keep DB as the source of truth for program comparison metadata
--   4. Expose tags as public reference data via RLS

begin;

-- ============================================================
-- programs.level canonicalization
-- ============================================================

alter table public.programs
  drop constraint if exists programs_level_check;

update public.programs
set level =
  case lower(trim(coalesce(level, '')))
    when '' then null
    when 'beginner' then 'beginner'
    when 'novice' then 'beginner'
    when 'intermediate' then 'intermediate'
    when 'advanced' then 'advanced'
    else null
  end;

alter table public.programs
  add constraint programs_level_check
  check (level is null or level in ('beginner', 'intermediate', 'advanced'));

comment on column public.programs.level is
  'Canonical level value for program comparison. Allowed: beginner, intermediate, advanced.';

-- ============================================================
-- program_tags
-- ============================================================

create table if not exists public.program_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  axis text not null check (axis in ('goal', 'equipment', 'split', 'focus')),
  description text,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (id, axis)
);

comment on table public.program_tags is
  'Program comparison tags. axis controls whether a tag represents goal, equipment, split, or optional focus.';

comment on column public.program_tags.axis is
  'Allowed axes: goal, equipment, split, focus.';

create index if not exists idx_program_tags_axis_sort_order
  on public.program_tags (axis, sort_order, label);

-- ============================================================
-- program_tag_assignments
-- ============================================================

create table if not exists public.program_tag_assignments (
  program_id uuid not null references public.programs (id) on delete cascade,
  tag_id uuid not null,
  axis text not null check (axis in ('goal', 'equipment', 'split', 'focus')),
  created_at timestamptz not null default now(),
  primary key (program_id, tag_id),
  constraint program_tag_assignments_program_tag_fkey
    foreign key (tag_id, axis)
    references public.program_tags (id, axis)
    on delete restrict
);

comment on table public.program_tag_assignments is
  'Assignments from programs to program_tags. goal/equipment/split are single-select per program; focus is multi-select.';

create index if not exists idx_program_tag_assignments_program_id
  on public.program_tag_assignments (program_id);

create index if not exists idx_program_tag_assignments_tag_id
  on public.program_tag_assignments (tag_id);

create unique index if not exists idx_program_tag_assignments_single_select_axis
  on public.program_tag_assignments (program_id, axis)
  where axis in ('goal', 'equipment', 'split');

-- ============================================================
-- RLS for public metadata tables
-- ============================================================

alter table public.program_tags enable row level security;
alter table public.program_tag_assignments enable row level security;

drop policy if exists "Program tags are readable by everyone"
  on public.program_tags;

create policy "Program tags are readable by everyone"
  on public.program_tags
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Program tag assignments are readable by everyone"
  on public.program_tag_assignments;

create policy "Program tag assignments are readable by everyone"
  on public.program_tag_assignments
  for select
  to anon, authenticated
  using (true);

commit;
