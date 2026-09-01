-- Reclaim founder analytics. Run in Supabase SQL Editor.
-- Change interval '30 days' where a different reporting window is needed.

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

