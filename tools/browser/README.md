# Reclaim browser automation

This folder keeps `agent-browser` isolated from the production app so browser tooling does not affect the Vercel build.

## One-time setup

From the repository root:

```sh
cd tools/browser
npm install
npm run browser:install
npm run browser:doctor
```

## Run Reclaim locally

In a separate terminal, from the repository root:

```sh
python3 -m http.server 4173
```

## Open and inspect Reclaim

From `tools/browser`:

```sh
npm run browser:open
npm run browser:snapshot
```

The snapshot prints interactive element references such as `@e1` and `@e2`. Use those refs with the local CLI, for example:

```sh
npx agent-browser click @e1
npx agent-browser fill @e2 "test@example.com"
```

Take a full-page screenshot with:

```sh
npm run browser:screenshot
```

After navigation or any major DOM update, run a fresh snapshot before using element refs again.

Close the browser session when finished:

```sh
npm run browser:close
```

## Recommended use in Reclaim

Use `agent-browser` for quick interactive inspection, reproducing UI bugs, screenshots, and AI-assisted browser debugging. Keep the existing Playwright-based E2E tests as the repeatable regression suite.

Do not put real account passwords, Supabase secret/service-role keys, or other production credentials into committed browser scripts or saved browser state.
