-- Reclaim session lifecycle v1
-- Separates one-time onboarding from returning-user check-ins.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Existing accounts predate this flag and have already used the original setup flow.
-- New profiles created after this migration keep the default false until the client
-- marks setup complete.
update public.profiles
set onboarding_completed = true
where onboarding_completed = false
  and created_at < now() - interval '1 minute';
