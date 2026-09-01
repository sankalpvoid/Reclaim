-- Store a signed-in tester's chosen display name once in their protected profile.
-- Names are not copied into analytics_events.

alter table public.profiles
  add column if not exists display_name text;

update public.profiles as profile
set display_name = left(nullif(btrim(coalesce(
  account.raw_user_meta_data->>'display_name',
  account.raw_user_meta_data->>'full_name',
  account.raw_user_meta_data->>'name'
)), ''), 80)
from auth.users as account
where profile.id = account.id
  and profile.display_name is null;

comment on column public.profiles.display_name is
  'User-chosen display name. Visible in founder-only SQL reports; never copied into product event properties.';

