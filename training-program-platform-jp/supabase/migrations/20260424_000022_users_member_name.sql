-- Add member_name to public.users for admin-managed member identification.
--
-- Design intent:
--   member_name is the admin's authoritative record of who a user is.
--   It is managed exclusively by admins via /admin/members.
--   It is intentionally separate from display_name, which the user may
--   set freely (e.g. a nickname) and may be changed by the user in the future.
--
--   Use cases: account suspension, cancellation, support requests — any
--   situation where "who is this user" must be answered independently of
--   what display_name the user has chosen.
--
-- Existing rows default to NULL.
-- Admins can fill this in from the /admin/members page.

ALTER TABLE public.users
ADD COLUMN member_name text;

COMMENT ON COLUMN public.users.member_name IS
  'Admin-managed member name for identity verification. Not editable by the user. Separate from display_name.';
