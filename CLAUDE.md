# TransitMap — Claude Instructions

## Rules for every session

### Always update HANDOFF.md on every code change
After **every** code edit (prototype, worker, Swift app, or any other file), update `HANDOFF.md` before finishing the response:

- Bump **Prototype version** in the header when the prototype changes
- Add a row to the **Change Log** table: `| YYYY-MM-DD | vX.X | one-line description |`
- Update **Last updated** date in the header
- If a bug is fixed, add a note explaining what was broken and what fixed it
- When bumping the prototype version, also update `LAST_EDIT` in the prototype JS to the current date + Pacific Time (PT), format: `'YYYY-MM-DD · HH:MM PT'`
- Also update the `?v=X.X` query string in **both places** in `index.html` (the `<meta http-equiv="refresh">` and the `window.location.replace()` script) to match the new version — this busts the GitHub Pages CDN cache

This applies to every single commit, no exceptions.

### Worker deploys
After every `wrangler deploy`, confirm the deployed version ID in the response.

### Commit messages
Always end git commit messages with:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
