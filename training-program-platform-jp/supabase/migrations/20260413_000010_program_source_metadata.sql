-- Program source metadata for audited public program seeds.
--
-- Goals:
--   1. Track the named source program (when one exists)
--   2. Track whether the stored seed is original / adapted / custom
--   3. Keep a short note explaining the fidelity decision

begin;

alter table public.programs
  add column if not exists source_program_name text,
  add column if not exists source_fidelity text,
  add column if not exists source_notes text;

alter table public.programs
  drop constraint if exists programs_source_fidelity_check;

update public.programs
set source_fidelity =
  case lower(trim(coalesce(source_fidelity, '')))
    when '' then null
    when 'original' then 'original'
    when 'adapted' then 'adapted'
    when 'custom' then 'custom'
    else null
  end;

alter table public.programs
  add constraint programs_source_fidelity_check
  check (
    source_fidelity is null
    or source_fidelity in ('original', 'adapted', 'custom')
  );

comment on column public.programs.source_program_name is
  'Canonical source program or phase name, e.g. GZCLP or Starting Strength Novice Program - Phase 2.';

comment on column public.programs.source_fidelity is
  'Seed fidelity classification. Allowed values: original, adapted, custom.';

comment on column public.programs.source_notes is
  'Short explanation of why the program is classified as original, adapted, or custom.';

commit;
