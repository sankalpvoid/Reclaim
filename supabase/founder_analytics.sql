-- Reclaim founder analytics. Run in Supabase SQL Editor.
-- Change interval '30 days' where a different reporting window is needed.

-- Plain-language tester report. Signed-in people appear by their chosen name.
-- Visitors who never signed in remain anonymous by design.
with anonymous_identity as (
  select
    anonymous_id,
    max(user_id::text)::uuid as user_id
  from public.analytics_events
  group by anonymous_id
), identified_events as (
  select
    events.*,
    identity.user_id as resolved_user_id,
    coalesce(identity.user_id::text, 'anonymous:' || events.anonymous_id::text) as person_key
  from public.analytics_events as events
  join anonymous_identity as identity using (anonymous_id)
), per_person as (
  select
    events.person_key,
    events.resolved_user_id as user_id,
    min(events.occurred_at) as first_seen,
    max(events.occurred_at) as last_seen,
    count(distinct events.session_id) as sessions,
    (array_agg(events.journey_mode order by events.occurred_at desc)
      filter (where events.journey_mode is not null))[1] as current_journey,
    count(*) filter (where events.event_name = 'cigarette_logged') as cigarettes_logged,
    count(*) filter (where events.event_name = 'craving_logged') as cravings_logged,
    count(*) filter (
      where events.event_name = 'craving_logged'
        and events.properties->>'resisted' = 'true'
    ) as cravings_resisted,
    count(*) filter (where events.event_name = 'support_tool_completed') as support_tools_completed,
    count(*) filter (where events.event_name = 'insights_viewed') as insights_opened,
    count(*) filter (where events.event_name = 'community_engaged') as community_actions
  from identified_events as events
  where events.occurred_at >= now() - interval '30 days'
  group by events.person_key, events.resolved_user_id
)
select
  coalesce(nullif(btrim(profile.display_name), ''), 'Anonymous visitor') as "Person",
  case per_person.current_journey
    when 'quit' then 'Quit smoking now'
    when 'reduce' then 'Smoke less gradually'
    when 'track' then 'Track and understand smoking'
    else 'Not chosen yet'
  end as "Their plan",
  per_person.first_seen as "First used Reclaim",
  per_person.last_seen as "Last used Reclaim",
  per_person.sessions as "Times they opened Reclaim",
  per_person.cigarettes_logged as "Cigarettes they logged",
  per_person.cravings_logged as "Cravings they logged",
  per_person.cravings_resisted as "Cravings they resisted",
  per_person.support_tools_completed as "Craving tools completed",
  per_person.insights_opened as "Times they opened Insights",
  per_person.community_actions as "Community actions"
from per_person
left join public.profiles as profile on profile.id = per_person.user_id
order by per_person.last_seen desc;

-- 1. Reach and returning usage
select
  count(distinct anonymous_id) as unique_users,
  count(distinct session_id) as sessions,
  count(distinct session_id) filter (where event_name = 'returning_session') as returning_sessions
from public.analytics_events
where occurred_at >= now() - interval '30 days';

-- 2. Onboarding funnel and conversion
with funnel as (
  select
    count(distinct anonymous_id) filter (where event_name = 'session_started') as visited,
    count(distinct anonymous_id) filter (where event_name = 'onboarding_started') as started,
    count(distinct anonymous_id) filter (where event_name = 'journey_mode_selected') as chose_mode,
    count(distinct anonymous_id) filter (where event_name = 'onboarding_completed') as completed
  from public.analytics_events
  where occurred_at >= now() - interval '30 days'
)
select *,
  round(100.0 * started / nullif(visited, 0), 1) as visit_to_start_pct,
  round(100.0 * completed / nullif(started, 0), 1) as start_to_complete_pct
from funnel;

-- 3. Journey mix (latest selected mode per user)
with latest_mode as (
  select distinct on (anonymous_id) anonymous_id, journey_mode
  from public.analytics_events
  where journey_mode is not null
    and occurred_at >= now() - interval '30 days'
  order by anonymous_id, occurred_at desc
)
select journey_mode, count(*) as users,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as share_pct
from latest_mode
group by journey_mode
order by users desc;

-- 4. Activation: completed onboarding and performed a meaningful action
with users as (
  select anonymous_id,
    bool_or(event_name = 'onboarding_completed') as completed_onboarding,
    bool_or(event_name in ('cigarette_logged', 'craving_logged', 'support_tool_completed', 'insights_viewed')) as activated
  from public.analytics_events
  where occurred_at >= now() - interval '30 days'
  group by anonymous_id
)
select
  count(*) filter (where completed_onboarding) as onboarded_users,
  count(*) filter (where completed_onboarding and activated) as activated_users,
  round(100.0 * count(*) filter (where completed_onboarding and activated)
    / nullif(count(*) filter (where completed_onboarding), 0), 1) as activation_pct
from users;

-- 5. Feature usage
select event_name, count(*) as events, count(distinct anonymous_id) as users
from public.analytics_events
where occurred_at >= now() - interval '30 days'
group by event_name
order by users desc, events desc;

-- 6. Craving outcomes and support tool effectiveness
select
  properties->>'tool' as tool,
  count(*) filter (where event_name = 'support_tool_completed') as completions,
  count(*) filter (where event_name = 'tool_feedback' and properties->>'feedback' = 'yes') as helped,
  count(*) filter (where event_name = 'tool_feedback' and properties->>'feedback' = 'a_little') as helped_a_little,
  count(*) filter (where event_name = 'tool_feedback' and properties->>'feedback' = 'not_really') as not_really
from public.analytics_events
where occurred_at >= now() - interval '30 days'
  and event_name in ('support_tool_completed', 'tool_feedback')
group by properties->>'tool'
order by completions desc;

-- 7. Day 1, 3, and 7 return retention (calendar-day based)
with session_days as (
  select distinct anonymous_id, occurred_at::date as active_date
  from public.analytics_events
  where event_name = 'session_started'
), cohorts as (
  select anonymous_id, min(active_date) as first_date
  from session_days group by anonymous_id
), retention as (
  select c.anonymous_id, c.first_date,
    bool_or(s.active_date = c.first_date + 1) as d1,
    bool_or(s.active_date = c.first_date + 3) as d3,
    bool_or(s.active_date = c.first_date + 7) as d7
  from cohorts c join session_days s using (anonymous_id)
  where c.first_date <= current_date - 1
  group by c.anonymous_id, c.first_date
)
select count(*) as eligible_users,
  round(100.0 * count(*) filter (where d1) / nullif(count(*), 0), 1) as d1_pct,
  round(100.0 * count(*) filter (where d3) / nullif(count(*) filter (where first_date <= current_date - 3), 0), 1) as d3_pct,
  round(100.0 * count(*) filter (where d7) / nullif(count(*) filter (where first_date <= current_date - 7), 0), 1) as d7_pct
from retention;
