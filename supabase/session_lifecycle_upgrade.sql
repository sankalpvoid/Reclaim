-- Reclaim session lifecycle v1
-- Separates one-time onboarding from returning-user check-ins.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Production introduced this flag in migration 20260902165428. Only accounts that
-- already existed before that migration are legacy users that should be backfilled as
-- complete. Keeping a fixed cutoff makes this file safe to re-run later without
-- silently completing onboarding for newer accounts that abandoned setup midway.
update public.profiles
set onboarding_completed = true
where onboarding_completed = false
  and created_at < timestamptz '2026-09-02 16:54:28+00';
