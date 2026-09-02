-- Read-only verification for supabase/data_foundation_upgrade.sql.
with checks as (
  select
    to_regclass('public.profiles') is not null as profiles_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='quit_date'
    ) as quit_date_ready,
    to_regclass('public.smoking_events') is not null as smoking_events_exists,
    to_regclass('public.health_milestones') is not null as health_milestones_exists,
    to_regclass('public.daily_checkins') is not null as daily_checkins_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='daily_checkins' and column_name='client_id' and is_nullable='NO'
    ) as daily_checkin_client_id_ready,
    coalesce((select relrowsecurity from pg_class where oid='public.daily_checkins'::regclass), false) as daily_checkins_rls,
    exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='daily_checkins'
        and policyname='daily checkins select own' and cmd='SELECT'
    ) as daily_checkins_select_policy,
    exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='daily_checkins'
        and policyname='daily checkins insert own' and cmd='INSERT'
    ) as daily_checkins_insert_policy
)
select *,
  profiles_exists
  and quit_date_ready
  and smoking_events_exists
  and health_milestones_exists
  and daily_checkins_exists
  and daily_checkin_client_id_ready
  and daily_checkins_rls
  and daily_checkins_select_policy
  and daily_checkins_insert_policy as foundation_ready
from checks;
