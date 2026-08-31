-- Additive upgrade for the existing Reclaim tables. Safe to re-run.
alter table public.profiles add column if not exists price_per_pack numeric(12,2) check (price_per_pack >= 0);
alter table public.profiles add column if not exists cigarettes_per_pack integer check (cigarettes_per_pack > 0);
alter table public.profiles add column if not exists minutes_per_cigarette numeric(6,2) not null default 11;
alter table public.profiles add column if not exists currency_symbol text not null default '$';
alter table public.profiles add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
alter table public.profiles add column if not exists attempt_number integer not null default 1 check (attempt_number > 0);
alter table public.profiles add column if not exists best_streak_seconds bigint not null default 0 check (best_streak_seconds >= 0);
alter table public.smoking_events add column if not exists event_type text not null default 'smoked' check (event_type in ('smoked','craving'));
alter table public.smoking_events add column if not exists resisted boolean;
alter table public.smoking_events add column if not exists toolkit text;
alter table public.smoking_events add column if not exists duration_seconds integer check (duration_seconds >= 0);

-- Reclaim Circles: additive shared community feed.
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_smoke_free_days integer not null default 0,
  max_smoke_free_days integer,
  description text,
  created_at timestamptz not null default now()
);
create table if not exists public.circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  topic text not null default 'reflection' check (topic in ('win','craving','advice','reflection')),
  author_name text not null default 'Community member' check (char_length(author_name) between 1 and 80),
  smoke_free_days integer not null default 0 check (smoke_free_days >= 0),
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.circle_posts add column if not exists topic text not null default 'reflection' check (topic in ('win','craving','advice','reflection'));
alter table public.circle_posts add column if not exists author_name text not null default 'Community member' check (char_length(author_name) between 1 and 80);
alter table public.circle_posts add column if not exists smoke_free_days integer not null default 0 check (smoke_free_days >= 0);
create table if not exists public.post_cheers (
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
insert into public.circles (id,name,min_smoke_free_days,description)
values ('00000000-0000-0000-0000-000000000001','Reclaim Together',0,'Shared peer support for every smoke-free stage.')
on conflict (id) do nothing;
create index if not exists circle_posts_created_at_idx on public.circle_posts (created_at desc);
create index if not exists circle_posts_user_id_idx on public.circle_posts (user_id);
create index if not exists post_cheers_post_id_idx on public.post_cheers (post_id);
alter table public.profiles enable row level security;
alter table public.savings_goals enable row level security;
alter table public.smoking_events enable row level security;
alter table public.circles enable row level security;
alter table public.circle_posts enable row level security;
alter table public.post_cheers enable row level security;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.savings_goals to authenticated;
grant select on table public.circles to authenticated;
grant select, insert, update, delete on table public.circle_posts to authenticated;
grant select, insert, delete on table public.post_cheers to authenticated;
do $$ begin create policy "users manage own profile" on public.profiles for all using (auth.uid()=id) with check (auth.uid()=id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users manage own savings goals" on public.savings_goals for all using (auth.uid()=user_id) with check (auth.uid()=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users manage own smoking events" on public.smoking_events for all using (auth.uid()=user_id) with check (auth.uid()=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated users read circles" on public.circles for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated users read community posts" on public.circle_posts for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "users create own community posts" on public.circle_posts for insert to authenticated with check ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users update own community posts" on public.circle_posts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users delete own community posts" on public.circle_posts for delete to authenticated using ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated users read cheers" on public.post_cheers for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "users add own cheers" on public.post_cheers for insert to authenticated with check ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users remove own cheers" on public.post_cheers for delete to authenticated using ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;

-- Community expansion: stage circles, threaded replies, safety, weekly challenges, and private saves.
alter table public.circle_posts add column if not exists moderation_status text not null default 'visible'
  check (moderation_status in ('visible','under_review','removed'));

create table if not exists public.post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  author_name text not null default 'Community member' check (char_length(author_name) between 1 and 80),
  moderation_status text not null default 'visible' check (moderation_status in ('visible','under_review','removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.circle_posts(id) on delete cascade,
  reply_id uuid references public.post_replies(id) on delete cascade,
  reason text not null check (reason in ('harmful','harassment','privacy','spam','other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending','reviewing','actioned','dismissed')),
  moderator_note text check (moderator_note is null or char_length(moderator_note) <= 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (((post_id is not null)::integer + (reply_id is not null)::integer) = 1)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  blocked_name text not null default 'Community member' check (char_length(blocked_name) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.saved_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,post_id)
);

create table if not exists public.community_challenges (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  title text not null check (char_length(title) between 1 and 100),
  description text not null check (char_length(description) between 1 and 500),
  badge_name text not null check (char_length(badge_name) between 1 and 80),
  target_count integer not null default 1 check (target_count > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_completions (
  challenge_id uuid not null references public.community_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Community member' check (char_length(display_name) between 1 and 80),
  completed_at timestamptz not null default now(),
  primary key (challenge_id,user_id)
);

-- Stable stage IDs let the frontend choose the correct circle without another lookup.
insert into public.circles (id,name,min_smoke_free_days,max_smoke_free_days,description)
values
  ('00000000-0000-0000-0000-000000000010','First 72 Hours',0,2,'Support for the first three smoke-free days.'),
  ('00000000-0000-0000-0000-000000000011','First Week',3,6,'Support for days three through six.'),
  ('00000000-0000-0000-0000-000000000012','First Month',7,29,'Support for the remainder of the first smoke-free month.'),
  ('00000000-0000-0000-0000-000000000001','30 Days & Beyond',30,null,'Long-term momentum and peer encouragement.')
on conflict (id) do update set
  name=excluded.name,
  min_smoke_free_days=excluded.min_smoke_free_days,
  max_smoke_free_days=excluded.max_smoke_free_days,
  description=excluded.description;

-- Place legacy all-stage posts into the most relevant stage without deleting them.
update public.circle_posts
set circle_id = case
  when smoke_free_days < 3 then '00000000-0000-0000-0000-000000000010'::uuid
  when smoke_free_days < 7 then '00000000-0000-0000-0000-000000000011'::uuid
  when smoke_free_days < 30 then '00000000-0000-0000-0000-000000000012'::uuid
  else '00000000-0000-0000-0000-000000000001'::uuid
end
where circle_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Seed one year of rotating weekly challenges. Re-running adds only missing weeks.
insert into public.community_challenges (week_start,title,description,badge_name,target_count)
select
  (date_trunc('week',current_date)::date + (series.week_number * 7)),
  case series.week_number % 4
    when 0 then 'THE THREE-MINUTE RESET'
    when 1 then 'CHANGE THE CUE'
    when 2 then 'RECLAIM TEN MINUTES'
    else 'NAME YOUR SMALL WIN'
  end,
  case series.week_number % 4
    when 0 then 'When a craving arrives, pause for three minutes before deciding what comes next. Share the pause, not private details.'
    when 1 then 'Change one routine linked to smoking: your route, drink, break spot, or after-meal ritual.'
    when 2 then 'Use ten reclaimed minutes for movement, music, rest, or a task you have been postponing.'
    else 'Notice and name one small smoke-free win each day this week.'
  end,
  case series.week_number % 4
    when 0 then 'Pause With Power'
    when 1 then 'Cue Breaker'
    when 2 then 'Time Reclaimer'
    else 'Small Wins Club'
  end,
  1
from generate_series(0,51) as series(week_number)
on conflict (week_start) do nothing;

create index if not exists post_replies_post_created_idx on public.post_replies (post_id,created_at);
create index if not exists post_replies_user_idx on public.post_replies (user_id);
create index if not exists community_reports_status_created_idx on public.community_reports (status,created_at);
create index if not exists community_reports_reporter_idx on public.community_reports (reporter_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id,blocker_id);
create index if not exists saved_posts_user_created_idx on public.saved_posts (user_id,created_at desc);
create index if not exists challenge_completions_challenge_idx on public.challenge_completions (challenge_id);

alter table public.post_replies enable row level security;
alter table public.community_reports enable row level security;
alter table public.user_blocks enable row level security;
alter table public.saved_posts enable row level security;
alter table public.community_challenges enable row level security;
alter table public.challenge_completions enable row level security;

-- Blocking must work in both directions without exposing another person's block list.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create or replace function private.community_block_exists(author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then true
    else exists (
      select 1 from public.user_blocks block
      where (block.blocker_id=(select auth.uid()) and block.blocked_id=author_id)
         or (block.blocker_id=author_id and block.blocked_id=(select auth.uid()))
    )
  end
$$;
revoke all on function private.community_block_exists(uuid) from public,anon;
grant execute on function private.community_block_exists(uuid) to authenticated;

create or replace function private.is_community_moderator()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt())->'app_metadata'->>'community_role','') in ('moderator','admin')
$$;
revoke all on function private.is_community_moderator() from public,anon;
grant execute on function private.is_community_moderator() to authenticated;

revoke all on table public.post_replies,public.community_reports,public.user_blocks,public.saved_posts,public.community_challenges,public.challenge_completions from anon;
grant select,insert,update,delete on table public.post_replies to authenticated;
grant select,insert,update on table public.community_reports to authenticated;
grant select,insert,delete on table public.user_blocks to authenticated;
grant select,insert,delete on table public.saved_posts to authenticated;
grant select on table public.community_challenges to authenticated;
grant select,insert,delete on table public.challenge_completions to authenticated;

-- Replace the old open-read post policy with moderation and bidirectional blocking.
drop policy if exists "authenticated users read community posts" on public.circle_posts;
drop policy if exists "member posts readable" on public.circle_posts;
drop policy if exists "users update own community posts" on public.circle_posts;
drop policy if exists "author controls post" on public.circle_posts;
do $$ begin create policy "visible unblocked community posts" on public.circle_posts for select to authenticated using ((moderation_status='visible' and not private.community_block_exists(user_id)) or private.is_community_moderator()); exception when duplicate_object then null; end $$;
do $$ begin create policy "moderators update community posts" on public.circle_posts for update to authenticated using (private.is_community_moderator()) with check (private.is_community_moderator()); exception when duplicate_object then null; end $$;

do $$ begin create policy "visible unblocked replies" on public.post_replies for select to authenticated using ((moderation_status='visible' and not private.community_block_exists(user_id)) or private.is_community_moderator()); exception when duplicate_object then null; end $$;
do $$ begin create policy "users create own replies" on public.post_replies for insert to authenticated with check ((select auth.uid())=user_id and exists (select 1 from public.circle_posts post where post.id=post_id and post.moderation_status='visible' and not private.community_block_exists(post.user_id))); exception when duplicate_object then null; end $$;
do $$ begin create policy "users delete own replies" on public.post_replies for delete to authenticated using ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "moderators update replies" on public.post_replies for update to authenticated using (private.is_community_moderator()) with check (private.is_community_moderator()); exception when duplicate_object then null; end $$;
do $$ begin create policy "moderators delete replies" on public.post_replies for delete to authenticated using (private.is_community_moderator()); exception when duplicate_object then null; end $$;

do $$ begin create policy "users read own reports and moderators read all" on public.community_reports for select to authenticated using ((select auth.uid())=reporter_id or private.is_community_moderator()); exception when duplicate_object then null; end $$;
do $$ begin create policy "users create own reports" on public.community_reports for insert to authenticated with check ((select auth.uid())=reporter_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "moderators review reports" on public.community_reports for update to authenticated using (private.is_community_moderator()) with check (private.is_community_moderator()); exception when duplicate_object then null; end $$;

do $$ begin create policy "users read own block list" on public.user_blocks for select to authenticated using ((select auth.uid())=blocker_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users create own blocks" on public.user_blocks for insert to authenticated with check ((select auth.uid())=blocker_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users remove own blocks" on public.user_blocks for delete to authenticated using ((select auth.uid())=blocker_id); exception when duplicate_object then null; end $$;

do $$ begin create policy "users read own saved posts" on public.saved_posts for select to authenticated using ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users save posts for themselves" on public.saved_posts for insert to authenticated with check ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users remove own saved posts" on public.saved_posts for delete to authenticated using ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;

do $$ begin create policy "authenticated users read challenges" on public.community_challenges for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated users see shared completions" on public.challenge_completions for select to authenticated using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "users complete challenges for themselves" on public.challenge_completions for insert to authenticated with check ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "users remove own challenge completion" on public.challenge_completions for delete to authenticated using ((select auth.uid())=user_id); exception when duplicate_object then null; end $$;
