# TransitMap — Claude Instructions

## Rules for every session

### Always update HANDOFF.md on every code change
After **every** code edit (prototype, worker, Swift app, or any other file), update `HANDOFF.md` before finishing the response:

- Bump **Prototype version** in the header when the prototype changes
- Bump **Worker version** in the header when the worker changes
- Add a row to the **Change Log** table: `| YYYY-MM-DD | vX.X | one-line description |`
- Update **Last updated** date in the header
- If a bug is fixed, add a note explaining what was broken and what fixed it
- When bumping the prototype version, also update `LAST_EDIT` in the prototype JS to the **actual current Los Angeles time** — run `TZ='America/Los_Angeles' date '+%Y-%m-%d · %H:%M PT'` to get the exact value, format: `'YYYY-MM-DD · HH:MM PT'`
- When bumping the worker version, also update `WORKER_VERSION` constant in `cloudflare-worker/index.js` (e.g. `'w4.2'` → `'w4.3'`)
- Also update the `?v=X.X` query string in **both places** in `index.html` (the `<meta http-equiv="refresh">` and the `window.location.replace()` script) to match the new version — this busts the GitHub Pages CDN cache

This applies to every single commit, no exceptions.

### Always push to GitHub after every code change
After updating HANDOFF.md, commit **all changed files** and push to GitHub:

1. `git add` the changed files (prototype, worker, HANDOFF.md, index.html, CLAUDE.md — whatever changed)
2. Commit with a one-line message describing the change
3. `git push origin main`

Do this automatically — do not ask for permission. Every session ends with a push.

### Worker deploys
After every `wrangler deploy`:
1. Confirm the deployed version ID in the response.
2. **Always warm the cache** — run this immediately after deploy to populate KV before the first real user request:
```bash
BASE="https://transitmap.marcboyer-public.workers.dev"
for ep in /trains/paris /trains/nyc /trains/helsinki /trains/sydney /trains/tokyo; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$ep")
  echo "$ep → HTTP $STATUS"
done
```
(Cloudflare purges the edge cache on every deploy. KV survives deployments but takes one successful compute to populate after a cold start.)

### Roku build version
Every time any Roku file is changed (`platforms/roku/**`), bump `ROKU_VERSION` in `platforms/roku/components/MapScene.brs` (e.g. `"r1.0"` → `"r1.1"`). Also update the **Roku version** field in the HANDOFF.md header. Rebuild `platforms/TransitMap-roku.zip` as part of the same commit.

### Commit messages
Always end git commit messages with:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
