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

### Clean project

Use this order:

1. `supabase/schema.sql`
2. `supabase/data_foundation_upgrade.sql`
3. `supabase/upgrade_existing_schema.sql`
4. `supabase/product_analytics.sql` and then `supabase/product_analytics_v2.sql` if product analytics is required
5. the corresponding read-only verification scripts

The foundation step must come before `upgrade_existing_schema.sql` because older versions of `schema.sql` did not create `smoking_events`, while the upgrade expects that table to exist.

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
