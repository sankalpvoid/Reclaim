-- Read-only verification for the expanded Reclaim Circles upgrade.
select
  to_regclass('public.post_replies') as post_replies,
  to_regclass('public.community_reports') as community_reports,
  to_regclass('public.user_blocks') as user_blocks,
  to_regclass('public.saved_posts') as saved_posts,
  to_regclass('public.community_challenges') as community_challenges,
  to_regclass('public.challenge_completions') as challenge_completions,
  (
    select count(*)
    from public.circles
    where id in (
      '00000000-0000-0000-0000-000000000010'::uuid,
      '00000000-0000-0000-0000-000000000011'::uuid,
      '00000000-0000-0000-0000-000000000012'::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid
    )
  ) as stage_circle_count,
  exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='circle_posts'
      and column_name='moderation_status'
  ) as moderation_ready,
  exists (
    select 1 from public.community_challenges
    where week_start=date_trunc('week',current_date)::date
  ) as current_challenge_ready;
