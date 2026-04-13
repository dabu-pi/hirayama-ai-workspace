-- Keep public.users in sync with auth.users so user-owned rows can safely
-- reference public.users(id) after login-based flows are enabled.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill any existing auth users that were created before this trigger existed.
insert into public.users (id)
select auth_user.id
from auth.users as auth_user
left join public.users as public_user on public_user.id = auth_user.id
where public_user.id is null;
