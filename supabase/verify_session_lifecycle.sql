-- Read-only verification for Reclaim's onboarding + returning-session lifecycle.

with checks as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles'
        and column_name='onboarding_completed' and is_nullable='NO'
    ) as onboarding_flag_ready,
    to_regclass('public.daily_checkins') is not null as daily_checkins_exists,
    coalesce((
      select c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='daily_checkins'
    ),false) as daily_checkins_rls,
    exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='daily_checkins' and cmd='SELECT'
    ) as daily_checkins_select_policy,
    exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='daily_checkins' and cmd='INSERT'
    ) as daily_checkins_insert_policy,
    exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='profiles' and cmd in ('UPDATE','ALL')
    ) as profile_update_policy
)
select *,
  onboarding_flag_ready
  and daily_checkins_exists
  and daily_checkins_rls
  and daily_checkins_select_policy
  and daily_checkins_insert_policy
  and profile_update_policy as session_lifecycle_ready
from checks;
