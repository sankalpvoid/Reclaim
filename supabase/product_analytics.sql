-- Reclaim privacy-conscious product analytics.
-- Additive migration: safe to run after the existing Reclaim schema.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  client_created_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid not null,
  session_id uuid not null,
  event_name text not null check (event_name in (
    'session_started', 'returning_session', 'onboarding_started',
    'onboarding_completed', 'journey_mode_selected', 'home_viewed',
    'cigarette_logged', 'trigger_captured', 'craving_logged',
    'craving_support_opened', 'support_tool_started',
    'support_tool_completed', 'tool_feedback', 'insights_viewed',
    'community_viewed', 'community_engaged'
  )),
  journey_mode text check (journey_mode is null or journey_mode in ('quit', 'reduce', 'track')),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object')
);

comment on table public.analytics_events is
  'Pseudonymous product events only. Do not store names, email addresses, community text, trigger notes, or other free text.';

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);
create index if not exists analytics_events_event_time_idx
  on public.analytics_events (event_name, occurred_at desc);
create index if not exists analytics_events_anonymous_time_idx
  on public.analytics_events (anonymous_id, occurred_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id);
create index if not exists analytics_events_user_time_idx
  on public.analytics_events (user_id, occurred_at desc)
  where user_id is not null;

alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from anon, authenticated;
grant insert on table public.analytics_events to anon, authenticated;

drop policy if exists "anonymous users can submit anonymous analytics" on public.analytics_events;
create policy "anonymous users can submit anonymous analytics"
  on public.analytics_events for insert to anon
  with check (user_id is null);

drop policy if exists "signed in users can submit their analytics" on public.analytics_events;
create policy "signed in users can submit their analytics"
  on public.analytics_events for insert to authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- Intentionally no SELECT, UPDATE, or DELETE grants/policies for app users.
-- Founders should run aggregate queries in the Supabase SQL Editor.
