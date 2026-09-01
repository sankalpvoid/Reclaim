-- Reclaim actionable analytics v2.
-- Additive upgrade: expands the allowed event vocabulary without adding PII.

alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check check (event_name in (
    'session_started', 'returning_session', 'onboarding_started',
    'onboarding_completed', 'journey_mode_selected', 'home_viewed',
    'cigarette_logged', 'trigger_captured', 'craving_logged',
    'craving_support_opened', 'support_tool_started',
    'support_tool_completed', 'tool_feedback', 'insights_viewed',
    'community_viewed', 'community_engaged', 'screen_viewed',
    'quick_checkin_opened', 'checkin_completed', 'plan_editor_opened',
    'plan_saved', 'auth_started', 'auth_submitted',
    'insight_period_changed', 'momentum_tab_viewed',
    'dream_goal_started', 'dream_goal_created', 'dream_goal_delete_started',
    'community_story_shared', 'community_reply_shared', 'setback_logged',
    'session_summary', 'for_you_opened', 'for_you_action'
  ));

comment on table public.analytics_events is
  'Pseudonymous product events only. Never store email, names, passwords, community text, dream names, setback notes, or free-text triggers.';

-- Preserve the existing write-only client model.
alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from anon, authenticated;
grant insert on table public.analytics_events to anon, authenticated;
