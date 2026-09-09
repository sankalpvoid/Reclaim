-- Reclaim least-privilege cleanup.
-- Run after upgrade_existing_schema.sql on existing or clean projects.
-- Safe to re-run: it replaces legacy duplicate core policies and resets
-- client-facing grants to only the operations the current app uses.

-- Core owner tables: replace legacy PUBLIC/all policies with explicit
-- authenticated per-action policies using init-plan-safe auth.uid().

drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "users manage own profile" on public.profiles;
drop policy if exists "own profile" on public.profiles;
drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;

create policy "profiles select own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles insert own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);


drop policy if exists "Users can create their own savings goals" on public.savings_goals;
drop policy if exists "Users can delete their own savings goals" on public.savings_goals;
drop policy if exists "Users can update their own savings goals" on public.savings_goals;
drop policy if exists "Users can view their own savings goals" on public.savings_goals;
drop policy if exists "users manage own savings goals" on public.savings_goals;
drop policy if exists "own goals" on public.savings_goals;
drop policy if exists "savings goals select own" on public.savings_goals;
drop policy if exists "savings goals insert own" on public.savings_goals;
drop policy if exists "savings goals update own" on public.savings_goals;
drop policy if exists "savings goals delete own" on public.savings_goals;

create policy "savings goals select own"
  on public.savings_goals for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "savings goals insert own"
  on public.savings_goals for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "savings goals update own"
  on public.savings_goals for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "savings goals delete own"
  on public.savings_goals for delete
  to authenticated
  using ((select auth.uid()) = user_id);


drop policy if exists "Users can create their own smoking events" on public.smoking_events;
drop policy if exists "Users can delete their own smoking events" on public.smoking_events;
drop policy if exists "Users can update their own smoking events" on public.smoking_events;
drop policy if exists "Users can view their own smoking events" on public.smoking_events;
drop policy if exists "users manage own smoking events" on public.smoking_events;
drop policy if exists "own smoking events" on public.smoking_events;
drop policy if exists "smoking events select own" on public.smoking_events;
drop policy if exists "smoking events insert own" on public.smoking_events;
drop policy if exists "smoking events update own" on public.smoking_events;
drop policy if exists "smoking events delete own" on public.smoking_events;

create policy "smoking events select own"
  on public.smoking_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "smoking events insert own"
  on public.smoking_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "smoking events update own"
  on public.smoking_events for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "smoking events delete own"
  on public.smoking_events for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Keep RLS explicitly enabled on every client-facing application table.
alter table public.analytics_events enable row level security;
alter table public.challenge_completions enable row level security;
alter table public.circle_posts enable row level security;
alter table public.circles enable row level security;
alter table public.community_challenges enable row level security;
alter table public.community_reports enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.health_milestones enable row level security;
alter table public.post_cheers enable row level security;
alter table public.post_replies enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_posts enable row level security;
alter table public.savings_goals enable row level security;
alter table public.smoking_events enable row level security;
alter table public.user_blocks enable row level security;

-- Remove historical/default client grants, then restore the exact API surface.
revoke all on table public.analytics_events from anon, authenticated;
revoke all on table public.challenge_completions from anon, authenticated;
revoke all on table public.circle_posts from anon, authenticated;
revoke all on table public.circles from anon, authenticated;
revoke all on table public.community_challenges from anon, authenticated;
revoke all on table public.community_reports from anon, authenticated;
revoke all on table public.daily_checkins from anon, authenticated;
revoke all on table public.health_milestones from anon, authenticated;
revoke all on table public.post_cheers from anon, authenticated;
revoke all on table public.post_replies from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.saved_posts from anon, authenticated;
revoke all on table public.savings_goals from anon, authenticated;
revoke all on table public.smoking_events from anon, authenticated;
revoke all on table public.user_blocks from anon, authenticated;

grant insert on table public.analytics_events to anon, authenticated;
grant select on table public.health_milestones to anon, authenticated;

grant select, insert on table public.daily_checkins to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.savings_goals to authenticated;
grant select, insert, update, delete on table public.smoking_events to authenticated;

grant select on table public.circles to authenticated;
grant select, insert, update, delete on table public.circle_posts to authenticated;
grant select, insert, delete on table public.post_cheers to authenticated;
grant select, insert, update, delete on table public.post_replies to authenticated;
grant select, insert, update on table public.community_reports to authenticated;
grant select, insert, delete on table public.user_blocks to authenticated;
grant select, insert, delete on table public.saved_posts to authenticated;
grant select on table public.community_challenges to authenticated;
grant select, insert, delete on table public.challenge_completions to authenticated;
