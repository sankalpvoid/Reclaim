-- Reclaim additive baseline. Review against your existing schema before applying.
-- Nothing here drops or truncates existing objects.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  quit_at timestamptz,
  cigarettes_per_day numeric(6,2) check (cigarettes_per_day > 0),
  price_per_pack numeric(12,2) check (price_per_pack >= 0),
  cigarettes_per_pack integer check (cigarettes_per_pack > 0),
  minutes_per_cigarette numeric(6,2) not null default 11,
  currency_symbol text not null default '$',
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  attempt_number integer not null default 1 check (attempt_number > 0),
  best_streak_seconds bigint not null default 0 check (best_streak_seconds >= 0),
  journey_mode text not null default 'quit' check (journey_mode in ('quit','reduce','track')),
  daily_target integer check (daily_target is null or daily_target >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null check (mood in ('great','okay','struggling','craving')), note text,
  created_at timestamptz not null default now()
);
create table if not exists public.cravings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  trigger text, intensity smallint check (intensity between 1 and 5), toolkit text,
  duration_seconds integer check (duration_seconds >= 0), resisted boolean, created_at timestamptz not null default now()
);
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, target_amount numeric(12,2) not null check (target_amount > 0), archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(), name text not null, min_smoke_free_days integer not null default 0,
  max_smoke_free_days integer, description text, created_at timestamptz not null default now()
);
create table if not exists public.circle_members (
  circle_id uuid references public.circles(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(), primary key(circle_id,user_id)
);
create table if not exists public.circle_posts (
  id uuid primary key default gen_random_uuid(), circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, body text not null check (char_length(body) between 1 and 1000),
  topic text not null default 'reflection' check (topic in ('win','craving','advice','reflection')),
  author_name text not null default 'Community member' check (char_length(author_name) between 1 and 80),
  smoke_free_days integer not null default 0 check (smoke_free_days >= 0),
  is_featured boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.post_cheers (
  post_id uuid references public.circle_posts(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id,user_id)
);

alter table public.profiles enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.cravings enable row level security;
alter table public.savings_goals enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_posts enable row level security;
alter table public.post_cheers enable row level security;

insert into public.circles (id,name,min_smoke_free_days,description)
values ('00000000-0000-0000-0000-000000000001','Reclaim Together',0,'Shared peer support for every smoke-free stage.')
on conflict (id) do nothing;
create index if not exists circle_posts_created_at_idx on public.circle_posts (created_at desc);
create index if not exists circle_posts_user_id_idx on public.circle_posts (user_id);
create index if not exists post_cheers_post_id_idx on public.post_cheers (post_id);

grant select on table public.circles to authenticated;
grant select, insert, update, delete on table public.circle_posts to authenticated;
grant select, insert, delete on table public.post_cheers to authenticated;

do $$ begin
  create policy "own profile" on public.profiles for all using (auth.uid()=id) with check (auth.uid()=id);
  create policy "own checkins" on public.daily_checkins for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
  create policy "own cravings" on public.cravings for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
  create policy "own goals" on public.savings_goals for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
  create policy "circles readable" on public.circles for select to authenticated using (true);
  create policy "members visible to members" on public.circle_members for select using (auth.uid()=user_id or exists(select 1 from public.circle_members m where m.circle_id=circle_members.circle_id and m.user_id=auth.uid()));
  create policy "join circles" on public.circle_members for insert with check (auth.uid()=user_id);
  create policy "leave circles" on public.circle_members for delete using (auth.uid()=user_id);
  create policy "member posts readable" on public.circle_posts for select to authenticated using (true);
  create policy "member can post" on public.circle_posts for insert to authenticated with check ((select auth.uid())=user_id);
  create policy "author controls post" on public.circle_posts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
  create policy "author deletes post" on public.circle_posts for delete to authenticated using ((select auth.uid())=user_id);
  create policy "member cheers readable" on public.post_cheers for select to authenticated using (true);
  create policy "own cheers" on public.post_cheers for insert to authenticated with check ((select auth.uid())=user_id);
  create policy "remove own cheers" on public.post_cheers for delete to authenticated using ((select auth.uid())=user_id);
exception when duplicate_object then null; end $$;

create or replace function public.reclaim_metrics(p public.profiles, at_time timestamptz default now())
returns table(smoke_free_seconds bigint, cigarettes_avoided numeric, money_saved numeric, minutes_reclaimed numeric)
language sql stable as $$
  select greatest(0,extract(epoch from (at_time-p.quit_at)))::bigint,
    greatest(0,extract(epoch from (at_time-p.quit_at))/86400*p.cigarettes_per_day),
    greatest(0,extract(epoch from (at_time-p.quit_at))/86400*p.cigarettes_per_day*(p.price_per_pack/p.cigarettes_per_pack)),
    greatest(0,extract(epoch from (at_time-p.quit_at))/86400*p.cigarettes_per_day*p.minutes_per_cigarette)
$$;
