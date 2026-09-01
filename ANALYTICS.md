# Reclaim product analytics

This branch adds a separate, failure-safe analytics layer without changing Reclaim's visible experience.

## What is measured

- Sessions, returning sessions, onboarding start/completion and journey choice
- Home, Insights and Community views
- Cigarettes and cravings logged
- Craving support opened, tools started/completed and optional tool feedback
- Community interaction categories such as cheer, save, thread open or share start
- Optional controlled trigger categories if a category-only trigger UI is added later

Analytics never sends names, emails, passwords, community posts/replies, or free-text trigger notes. Browser and session UUIDs are pseudonymous. Signed-in users may have their Supabase user UUID attached so usage can be measured across devices; app clients cannot read the analytics table.

## Enable it safely

1. In the Supabase SQL Editor, run `supabase/product_analytics.sql`.
2. Deploy this feature branch to a preview.
3. Test the preview, then inspect aggregate results with `supabase/founder_analytics.sql`.
4. Only merge after the preview and queries are approved.

The database migration is additive. Until it is applied, analytics requests fail silently and do not interrupt app behavior.

## Local verification without polluting real data

Analytics is disabled on localhost by default. Add `?analytics-debug=1` to a local URL to print sanitized events in the browser console without sending them to Supabase.

## Important limitation

Detailed product actions cannot be reconstructed for activity that happened before this instrumentation was deployed. Existing Vercel traffic data may still show earlier visits, but event-level behavior begins when this code and database table are enabled.

