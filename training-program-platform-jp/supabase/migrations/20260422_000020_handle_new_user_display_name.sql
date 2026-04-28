-- Extend handle_new_user() to capture display_name from auth user metadata.
-- signUp() callers pass options.data.display_name; the trigger reads it from
-- new.raw_user_meta_data and stores a trimmed, non-empty value.
-- Existing rows are unaffected (on conflict do nothing).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
