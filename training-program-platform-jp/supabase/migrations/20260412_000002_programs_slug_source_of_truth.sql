alter table public.programs
  add column if not exists slug text;

create or replace function public.slugify_program_value(raw_value text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(
        both '-'
        from regexp_replace(lower(coalesce(raw_value, '')), '[^a-z0-9]+', '-', 'g')
      ),
      ''
    ),
    'program'
  );
$$;

create or replace function public.ensure_unique_program_slug(
  raw_value text,
  current_program_id uuid default null
)
returns text
language plpgsql
as $$
declare
  base_slug text := public.slugify_program_value(raw_value);
  candidate text := base_slug;
  duplicate_counter integer := 2;
begin
  while exists (
    select 1
    from public.programs
    where slug = candidate
      and (current_program_id is null or id <> current_program_id)
  ) loop
    candidate := base_slug || '-' || duplicate_counter::text;
    duplicate_counter := duplicate_counter + 1;
  end loop;

  return candidate;
end;
$$;

create or replace function public.assign_program_slug()
returns trigger
language plpgsql
as $$
begin
  new.slug := public.ensure_unique_program_slug(
    case
      when new.slug is null or btrim(new.slug) = '' then new.title
      else new.slug
    end,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_programs_assign_slug on public.programs;

create trigger trg_programs_assign_slug
before insert or update of title, slug on public.programs
for each row
execute function public.assign_program_slug();

do $$
declare
  program_record record;
begin
  for program_record in
    select id, title
    from public.programs
    where slug is null or btrim(slug) = ''
    order by created_at, id
  loop
    update public.programs
    set slug = public.ensure_unique_program_slug(program_record.title, program_record.id)
    where id = program_record.id;
  end loop;
end;
$$;

alter table public.programs
  alter column slug set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'programs_slug_key'
      and conrelid = 'public.programs'::regclass
  ) then
    alter table public.programs
      add constraint programs_slug_key unique (slug);
  end if;
end;
$$;

comment on column public.programs.slug is
  'Canonical route slug and external program identifier for /programs/[programSlug] and /train?program=.';
