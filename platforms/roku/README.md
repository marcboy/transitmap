# TransitMap — Roku

## Status: stub (not yet built)

## Overview
Roku is the most different platform of the five — it uses **BrightScript** (a proprietary
language) and **SceneGraph** (XML UI framework). There is no native HTML5 web app support.

## Two options

### Option A: Roku Direct Publisher (no code)
Roku's "Direct Publisher" can display a web video feed or a simple feed-based channel.
**Not applicable for TransitMap** — we need a live animated map, not a video feed.

### Option B: BrightScript + SceneGraph (full rebuild)
Build a native Roku channel from scratch:
- UI defined in XML (SceneGraph)
- Logic in BrightScript
- The Cloudflare Worker API is still useful — BrightScript can make HTTP calls
- City switching uses the Roku remote (same conceptual UX as D-pad nav)
- IAP via [Roku Pay](https://developer.roku.com/docs/developer-program/roku-pay/overview.md)

### Option C: Roku Web Browser (experimental)
Roku has a hidden browser channel accessible via developer mode. Some devs use this
to load web apps, but it's unsupported and can't be shipped on the Roku Channel Store.

## Recommendation
Build Option B when Roku is prioritised. The Cloudflare Worker API layer is platform-agnostic
and will work as-is. The rendering logic (Leaflet map + Canvas) needs a full BrightScript rewrite.
The city/route data can be consumed from the same `/trains/:city` endpoint.

## When ready to build
1. Sign up at [developer.roku.com](https://developer.roku.com)
2. Enable Developer Mode on a Roku device
3. Install `roku-deploy` npm package for upload automation
4. Build against the Cloudflare Worker API — no other backend needed
