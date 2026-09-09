# Reclaim production prototype

A mobile-first, dependency-free prototype based on the approved black/purple composite. It implements the complete journey in one runnable app: Namaste, Supabase auth, quit-profile onboarding, daily mood check-in, dashboard calculations, evidence-informed recovery timeline, momentum, insights, craving toolkit with box breathing and a five-minute timer, stage-matched community Circles, and savings goals.

## Run locally

From this folder, serve the static files with any local web server, for example:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`. The app remains local-first so interactions can still be tested if a newer backend table is unavailable.

## Supabase handoff

The app is connected to the configured Supabase project through the publishable client key in `config.js`. Never place a Supabase service-role or secret key in this client.

### Existing Reclaim project

Run `supabase/data_foundation_upgrade.sql` first. It is additive and safe to re-run: it does not drop or truncate user data. It reconciles the older repository schema with the production data model by:

- preserving `profiles.quit_date` as the frontend's canonical quit timestamp while copying legacy `quit_at` values when present;
- creating `smoking_events` if an older clean schema omitted it;
- creating the `health_milestones` table expected by cloud hydration;
- adding durable `daily_checkins` with idempotent client IDs, explicit grants, and user-owned RLS policies.

After applying it, run `supabase/verify_data_foundation.sql`. The final `foundation_ready` value should be `true`.

If the project has not already received the latest community upgrade, run `supabase/upgrade_existing_schema.sql` as well. That upgrade enables:

- stage circles for the first 72 hours, first week, first month, and 30+ days;
- threaded replies, private reports, bidirectional blocks, and moderation status;
- rotating weekly challenges with shared completion counts and badges;
- private saved posts in each user's **What helped me** library;
- durable attempt-number and personal-best tracking.

Use `supabase/verify_community_features.sql` as the read-only community check.

After schema/community upgrades and the product analytics scripts, run `supabase/security_cleanup_v1.sql` **last**. It removes legacy duplicate owner policies, replaces them with explicit authenticated owner policies, and resets client-facing grants to the least privileges the app currently uses. Re-run this cleanup after re-running an older schema upgrade so legacy grants or policies cannot be reintroduced.

### Clean project

Use this order:

1. `supabase/schema.sql`
2. `supabase/data_foundation_upgrade.sql`
3. `supabase/upgrade_existing_schema.sql`
4. `supabase/product_analytics.sql`
5. `supabase/product_analytics_v2.sql`
6. `supabase/product_analytics_v3.sql`
7. `supabase/security_cleanup_v1.sql`
8. the corresponding read-only verification scripts

The foundation step must come before `upgrade_existing_schema.sql` because older versions of `schema.sql` did not create `smoking_events`, while the upgrade expects that table to exist. The security cleanup intentionally runs last because older upgrade files contain historical grants/policies that the cleanup narrows to the current least-privilege model.

### Daily check-in durability

`checkin-sync.js` keeps the existing local-first UI intact while signed-in mood check-ins are written to `daily_checkins`. It assigns a stable client UUID to each local check-in so retries are idempotent, hydrates cloud check-ins back into browser storage, and falls back silently to local state if the backend table has not been installed yet.

This compatibility layer is intentionally separate from the large legacy `app.js`. Once `app.js` is modularized, check-in hydration should move into the central state/data module and this bridge can be removed.

Moderator controls appear only for accounts whose trusted Supabase `app_metadata.community_role` is `moderator` or `admin`. Never place this role in user-editable metadata. Moderators can review pending reports, dismiss them, or mark reported posts/replies as removed; ordinary users can report and block but cannot access the review queue.

## Calculation assumptions

- cigarettes avoided = elapsed days × baseline cigarettes/day
- money saved = cigarettes avoided × (pack price ÷ cigarettes/pack)
- time reclaimed = cigarettes avoided × configurable minutes/cigarette (default 11)

These values are estimates and deliberately labeled that way. Recovery milestones are not percentages or measurements; copy is sourced from public health guidance linked inside the Health screen.

Deployment managed through GitHub and Vercel.
Development preview branch enabled.


## Reduce and Track Smoking

`smoking-journey.js` adapts the existing pure reduction engine to calendar days, confirmed totals, dated reviews, historical targets and recent-log insights. `smoking-journey-ui.js` owns the two journey screens, log editor, full-day confirmation and review controls. Quit keeps its existing views and date picker.

- Reduce initializes from at least four confirmed days in the previous seven days, otherwise the onboarding estimate. The initial target and later stable reviews use the engine's 10%/minimum-one rule.
- Reviews open after seven calendar days and use at least four complete past days. Today's partial count and untracked days cannot count as successes. Stable weeks advance; mixed/struggling weeks hold; repeated struggling offers an explicit, optional +1 adjustment. Reviews cannot repeat on the same day or move below 1/day.
- Returning to Reduce starts a fresh review window and preserves the baseline and prior reviews. Days spent in another journey have no reduction target.
- Track supports the same logging, editing, deletion and completion controls without a reduction target. Patterns show their sample requirements and distinguish recorded totals from complete-day averages.
- New smoking mutations use stable UUIDs and an idempotent queue against the existing `smoking_events` table. Pending edits/deletions overlay cloud hydration and survive offline reloads. Account changes clear the prior user's plan, confirmations and pending mutations. Existing device-only logs are preserved.
- Plan history and day confirmations are device-local. The current target uses the existing profile field, but the full plan and confirmations do not restore on a new device. The UI labels this limitation. No database schema migration is required for the configured project; clean installs must grant authenticated users SELECT, INSERT, UPDATE and DELETE on smoking_events with user-owned RLS.

### Verification

```sh
node --test tests/foundation-regression.mjs tests/smoking-journey.test.mjs
```

Browser suite (requires Playwright and Chrome, with the app served on port 4173):

```sh
PLAYWRIGHT_PATH=/path/to/node_modules/playwright CHROME_PATH=/path/to/chrome node tests/smoking-journey.e2e.mjs
```

The browser suite uses simulated authenticated API responses and isolated browser storage. It exercises real UI code for logging, correction/deletion, offline retry, reload, confirmations, reviews, initial setup, account isolation, For You, Track and Quit navigation/date-picker controls. It does not write to a real Supabase account. Live database checks separately verified the existing smoking_events privileges and user-owned RLS.
