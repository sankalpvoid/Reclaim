# Reclaim production prototype

A mobile-first, dependency-free prototype based on the approved black/purple composite. It implements the complete journey in one runnable app: Namaste, Supabase auth, quit-profile onboarding, daily mood check-in, dashboard calculations, evidence-informed recovery timeline, momentum, insights, craving toolkit with box breathing and a five-minute timer, stage-matched community Circles, and savings goals.

## Run locally

From this folder, serve the static files with any local web server, for example:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`. Data persists in browser storage so every interaction can be tested without backend credentials.

## Supabase handoff

The app is connected to the configured Supabase project through the publishable client key in `config.js`. It automatically falls back to browser storage when a newer table or column has not been added yet.

For an existing Reclaim project, run `supabase/upgrade_existing_schema.sql` in the Supabase SQL editor after each delivered database upgrade. It is additive and safe to re-run: it does not drop or truncate existing data. The current upgrade enables:

- stage circles for the first 72 hours, first week, first month, and 30+ days;
- threaded replies, private reports, bidirectional blocks, and moderation status;
- rotating weekly challenges with shared completion counts and badges;
- private saved posts in each user's **What helped me** library;
- durable attempt-number and personal-best tracking.

After running it, use `supabase/verify_community_features.sql` as a read-only check. The six table columns should show their names, `stage_circle_count` should be `4`, and both readiness columns should be `true`.

Moderator controls appear only for accounts whose trusted Supabase `app_metadata.community_role` is `moderator` or `admin`. Never place this role in user-editable metadata. Moderators can review pending reports, dismiss them, or mark reported posts/replies as removed; ordinary users can report and block but cannot access the review queue.

For a clean project, run `supabase/schema.sql` first and then the additive upgrade so the newest community features are included.

Use the anon key only in the client. Never place a Supabase service-role key in this app.

## Calculation assumptions

- cigarettes avoided = elapsed days × baseline cigarettes/day
- money saved = cigarettes avoided × (pack price ÷ cigarettes/pack)
- time reclaimed = cigarettes avoided × configurable minutes/cigarette (default 11)

These values are estimates and deliberately labeled that way. Recovery milestones are not percentages or measurements; copy is sourced from CDC and American Cancer Society public guidance linked inside the Health screen.
