-- Reclaim Reduce cross-device state.
-- Keeps the current plan snapshot, applied reviews, and day-completeness assertions
-- durable without changing the local-first smoking_events model.

create table if not exists public.reduction_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version smallint not null default 1 check (version >= 1),
  baseline integer not null check (baseline >= 1),
  baseline_source text not null default 'your estimate' check (char_length(baseline_source) between 1 and 80),
  current_target integer not null check (current_target >= 1),
  stage integer not null default 1 check (stage >= 1),
  status text not null default 'active' check (status in ('active','paused','completed')),
  started_on date not null,
  review_start date not null,
  last_review_status text check (last_review_status is null or last_review_status in ('collect_more_data','stable','mixed','struggling')),
  last_review jsonb,
  target_history jsonb not null default '[]'::jsonb check (jsonb_typeof(target_history) = 'array'),
  minimum_automatic_target integer not null default 1 check (minimum_automatic_target >= 1),
  reduction_rate numeric(5,4) not null default 0.1000 check (reduction_rate >= 0 and reduction_rate <= 1),
  review_window_days integer not null default 7 check (review_window_days between 1 and 31),
  target_changed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.reduction_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_on date not null,
  review_start date not null,
  target integer not null check (target >= 1),
  next_target integer not null check (next_target >= 1),
  status text not null check (status in ('collect_more_data','stable','mixed','struggling')),
  logged_days integer not null check (logged_days >= 0 and logged_days <= 7),
  average numeric(8,3),
  choice text not null check (choice in ('continue','adjust','hold')),
  created_at timestamptz not null default now(),
  primary key (user_id, reviewed_on, review_start)
);

create table if not exists public.daily_smoking_confirmations (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  status text not null check (status in ('complete','smoke_free','untracked')),
  recorded_count integer not null default 0 check (recorded_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  check (status <> 'smoke_free' or recorded_count = 0)
);

create index if not exists reduction_reviews_user_reviewed_idx
  on public.reduction_reviews (user_id, reviewed_on desc);

alter table public.reduction_plans enable row level security;
alter table public.reduction_reviews enable row level security;
alter table public.daily_smoking_confirmations enable row level security;

drop policy if exists "reduction plans select own" on public.reduction_plans;
drop policy if exists "reduction plans insert own" on public.reduction_plans;
drop policy if exists "reduction plans update own" on public.reduction_plans;
drop policy if exists "reduction plans delete own" on public.reduction_plans;
create policy "reduction plans select own" on public.reduction_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy "reduction plans insert own" on public.reduction_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reduction plans update own" on public.reduction_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reduction plans delete own" on public.reduction_plans for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "reduction reviews select own" on public.reduction_reviews;
drop policy if exists "reduction reviews insert own" on public.reduction_reviews;
drop policy if exists "reduction reviews update own" on public.reduction_reviews;
drop policy if exists "reduction reviews delete own" on public.reduction_reviews;
create policy "reduction reviews select own" on public.reduction_reviews for select to authenticated using ((select auth.uid()) = user_id);
create policy "reduction reviews insert own" on public.reduction_reviews for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reduction reviews update own" on public.reduction_reviews for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reduction reviews delete own" on public.reduction_reviews for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "daily smoking confirmations select own" on public.daily_smoking_confirmations;
drop policy if exists "daily smoking confirmations insert own" on public.daily_smoking_confirmations;
drop policy if exists "daily smoking confirmations update own" on public.daily_smoking_confirmations;
drop policy if exists "daily smoking confirmations delete own" on public.daily_smoking_confirmations;
create policy "daily smoking confirmations select own" on public.daily_smoking_confirmations for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily smoking confirmations insert own" on public.daily_smoking_confirmations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily smoking confirmations update own" on public.daily_smoking_confirmations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily smoking confirmations delete own" on public.daily_smoking_confirmations for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.reduction_plans from anon, authenticated;
revoke all on table public.reduction_reviews from anon, authenticated;
revoke all on table public.daily_smoking_confirmations from anon, authenticated;

grant select, insert, update, delete on table public.reduction_plans to authenticated;
grant select, insert, update, delete on table public.reduction_reviews to authenticated;
grant select, insert, update, delete on table public.daily_smoking_confirmations to authenticated;

comment on table public.reduction_plans is 'Canonical current Reduce-plan snapshot for cross-device restoration.';
comment on table public.reduction_reviews is 'Durable applied Reduce reviews for plan history and future personalization.';
comment on table public.daily_smoking_confirmations is 'User assertions that a smoking day is complete, smoke-free, or intentionally incomplete; recorded_count is the known count at assertion time.';
