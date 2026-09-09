-- Reclaim foreign-key index coverage.
-- Safe to re-run.

create index if not exists challenge_completions_user_idx
  on public.challenge_completions (user_id);

create index if not exists circle_posts_circle_idx
  on public.circle_posts (circle_id);

create index if not exists community_reports_post_idx
  on public.community_reports (post_id);

create index if not exists community_reports_reply_idx
  on public.community_reports (reply_id);

create index if not exists post_cheers_user_idx
  on public.post_cheers (user_id);

create index if not exists saved_posts_post_idx
  on public.saved_posts (post_id);
