# TransitMap — Handoff Document

> **Last updated:** 2026-05-28  
> **Prototype version:** v4.14 (worker w4.6)  
> **Repo:** https://github.com/marcboy/transitmap  
> **Live Prototype:** https://marcboy.github.io/transitmap/  
> **Cloudflare Worker:** https://transitmap.marcboyer-public.workers.dev  

---

## What This Is

An ambient, art-like live transit map showing real subway train positions across multiple cities. Designed as a beautiful background display for Apple TV, smart TVs, lobbies, and homes.

---

## Live Status

| City | Data | Source | Status |
|---|---|---|---|
| New York | ✅ Real trains | MTA GTFS-RT (free, no key) | **Live** |
| Paris | ✅ Real trains | IDFM PRIM SIRI Lite estimated-timetable | **Live** |
| Seattle | ⏳ Real trains | Sound Transit OBA | **Needs OBA key** |
| Helsinki | ✅ Real trains | HSL GTFS-RT vehicle positions (free, no key) | **Live** |
| Sydney | ✅ Real trains | TfNSW GTFS-RT vehicle positions (prefix route IDs: NSN/ESI/APS/etc.) | **Live** |
| Tokyo | ✅ Real trains | ODPT API (TokyoMetro + Toei, JSON, station midpoint interpolation) | **Live** |
| Shinkansen | ✅ Timetable-driven | Official JR schedules (all lines) | **Live** |

---

## Architecture

```
MTA GTFS-RT (free, open)
IDFM PRIM (free key: wrangler secret put IDFM_API_KEY)     ──▶  Cloudflare Worker
Sound Transit OBA (free key: wrangler secret put OBA_API_KEY)    (transitmap.marcboyer-public.workers.dev)
                                                                         │
                                                                         ▼
                                                              prototype polls /trains/:city
                                                              every 15 seconds
                                                                         │
                                                              ┌──────────┴──────────┐
                                                              ▼                     ▼
                                                    HTML Prototype           SwiftUI App
                                                  (GitHub Pages)         (Apple TV/iPad/iPhone)
```

**Worker endpoints:**
- `GET /health` — instant health check, no feed fetching
- `GET /trains/nyc` — all MTA subway lines, inferred from stop coordinates
- `GET /trains/paris` — all RATP metro lines, timetable-inferred positions (needs IDFM_API_KEY)
- `GET /trains/seattle` — Sound Transit Link, real GPS (needs OBA_API_KEY)
- `GET /paris/debug` — debug: inspects raw SIRI Lite response for metro line 1

---

## Repository Structure

```
transitmap/
├── prototype/
│   └── transitmap-prototype.html     ← Single-file HTML prototype (v2.1)
├── cloudflare-worker/
│   ├── index.js                      ← Worker: all cities, protobuf decoder
│   └── wrangler.toml                 ← name="transitmap", main="index.js"
├── ios-app/
│   └── TransitMap/
│       ├── TransitMapApp.swift
│       ├── Config/CityConfig.swift   ← All city/line/feed config
│       ├── Models/TransitModels.swift
│       ├── Services/TransitAPIService.swift
│       ├── Services/TransitViewModel.swift
│       ├── AdManager/AdManager.swift
│       └── Views/
│           ├── TransitMapView.swift
│           └── CitySelectorView.swift
└── HANDOFF.md                        ← This file
```

---

## Prototype — How It Works

**File:** `prototype/transitmap-prototype.html` (self-contained, open in any browser)

### Key constants at top of JS section:
```javascript
const WORKER_URL = 'https://transitmap.marcboyer-public.workers.dev'; // worker URL
const VERSION    = 'v2.1';
const LAST_EDIT  = '2026-05-27 04:34 UTC';  // updated on every push
```

### Data flow:
1. On load, calls `fetchRealTrains()` immediately
2. `setInterval` polls again every **15 seconds**
3. Worker returns `{ city, count, trains: [{id, line, color, lat, lng, status}] }`
4. Trains with a previous known position **lerp smoothly** to new position over 15s
5. Cities without a live feed (Tokyo) use **simulated trains** on route paths
6. On API failure, falls back gracefully — last known positions held

### Version stamp:
Bottom-right corner shows `v2.1 · built 2026-05-27 04:34 UTC`  
Top-left shows city name, train count, and **local time in the city's timezone**

### Ad system:
- Triggers every **5 minutes** automatically
- Map shrinks to left 50%, ad panel slides in from right
- Auto-dismisses after 30 seconds, or user clicks Dismiss
- `closeAd()` calls `resizeCanvas()` + `leafletMap.invalidateSize()` through 700ms transition

---

## Cloudflare Worker — How It Works

**File:** `cloudflare-worker/index.js` (516 lines, self-contained, no npm dependencies)

### NYC (MTA):
- Fetches all **8 GTFS-RT feeds** concurrently (1/2/3, A/C/E, B/D/F/M, G, J/Z, N/Q/R/W, L, S)
- Feeds are **trip update format** — no GPS coordinates
- Position inferred from **next stop ID** → lookup in `STOPS` table (built-in, ~100 stations)
- Field numbers discovered via debug: `entity.id` = plain string, `routeId` = field 5, `stopId` = field 4
- Returns ~300-400 trains when MTA system is running

### Paris (IDFM):
- Feed: `https://prim.iledefrance-mobilites.fr/marketplace/estimated-timetable?LineRef=ALL`
- Auth header: `apikey: YOUR_KEY`
- PRIM does **not** publish a GTFS-RT vehicle positions feed — uses SIRI Lite estimated timetable
- Each `EstimatedVehicleJourney` has one `EstimatedCall` with the next stop's `StopPointRef`
- `StopPointRef` format: `STIF:StopPoint:Q:XXXXX:` — worker extracts Q-number, looks up coords from `PARIS_STOPS_BY_ID` (805 stops from IDFM `arrets-lignes` dataset)
- Line IDs: `STIF:Line::C01371:`–`C01384:` = M1–M14; M3b=`C01386`, M7b=`C01387`
- Returns ~800–900 trains when Paris Metro is running

### Seattle (Sound Transit OBA):
- Feed: `https://api.pugetsound.onebusaway.org/api/gtfs_realtime/vehicle-positions-for-agency/40.pb?key=KEY`
- **Vehicle positions feed** — real GPS coordinates
- Filters to `1-Line` (red) and `2-Line` (blue) only
- **Status: needs OBA API key**

### Protobuf decoder:
- Custom inline `PB` class — no dependencies
- Handles wire types 0 (varint), 2 (length-delimited), 5 (32-bit float)
- Decodes: `FeedMessage → FeedEntity → TripUpdate/VehiclePosition → StopTimeUpdate/Position`

---

## Secrets Required

Set via `wrangler secret put SECRET_NAME`:

| Secret | Used for | How to get |
|---|---|---|
| `IDFM_API_KEY` | Paris RATP metro | https://prim.iledefrance-mobilites.fr → account → API key |
| `OBA_API_KEY` | Seattle Sound Transit | Email open_transit_data@soundtransit.org |

Current key values are set — run `wrangler secret list` to verify.

---

## Deploy / Update Workflow

```bash
# 1. Make changes to cloudflare-worker/index.js
cd ~/transitmap/cloudflare-worker
git pull

# 2. Deploy worker
wrangler deploy

# 3. Prototype auto-deploys via GitHub Pages on push
# Just push prototype/transitmap-prototype.html and GitHub does the rest

# Set/update a secret
wrangler secret put IDFM_API_KEY
wrangler secret put OBA_API_KEY
```

---

## NYC Route Accuracy

Routes are built from **official MTA GTFS stop coordinates** — same data the real-time feed references. Each line's path is the ordered sequence of real station lat/lng values from the STOPS table. This ensures train dots always fall on their line.

Lines covered: 1, 2, 3, 4, 5, 6, 7, A (×2 branches: Far Rockaway + Lefferts/Howard Beach), C, E, B, D, F, M, G, J, Z, L, N, Q (×2), R, W, S

---

## Paris — How It Works

PRIM does not publish a GTFS-RT vehicle positions feed. The correct endpoint is the **SIRI Lite estimated timetable**, which returns one `EstimatedCall` per active vehicle journey (the next stop). The worker extracts the `StopPointRef` Q-number and looks up coordinates from an embedded 805-stop table built from the IDFM `arrets-lignes` open data dataset.

> ⚠️ Rotate the IDFM API key — it was visible in earlier chat history.

---

## Resuming This Work

### Where things stand (2026-05-28 end of session)

**Prototype:** v4.2 — Paris, NYC, Seattle polling live; Shinkansen timetable-driven; Tokyo simulated.  
**Worker:** w3.8 — deployed `e1e74bbc`. All three live cities cache correctly. Paris no longer 503s.

**What's working well:**
- NYC: ~300–400 trains, protobuf decoded, cached 15s, fast (60ms warm)
- Paris: ~800 trains, clock-driven animation using timetable segments (`seg` object), cached 60s fresh + 300s stale fallback — no more 503s under load
- Shinkansen: 9 service types, clock-driven from JR schedule data, no API needed
- On-screen fetch log panel (top-right) with per-city success/fail counters

**Immediate next things to do (in priority order):**

1. **Rotate the IDFM API key** — it was visible in earlier chat history. Go to https://prim.iledefrance-mobilites.fr → account → regenerate → `wrangler secret put IDFM_API_KEY`

2. **Seattle live data** — just needs an OBA key. Email open_transit_data@soundtransit.org, then `wrangler secret put OBA_API_KEY`. Worker endpoint is already implemented at `/trains/seattle`.

3. **Paris route accuracy** — trains animate correctly but positions don't snap to the metro lines because the route-constrained animation (`projectOnRouteT`) is only active for NYC/Seattle. Paris uses straight-line interpolation between stop coordinates. To fix: extend `stepTrains` clock-driven branch to also project onto the nearest Paris route polyline.

4. **Paris line paths** — a Python generator script exists at `prototype/paris_routes_gen.py`. Run it and paste the output into the prototype to replace the hand-drawn route polylines with accurate IDFM coordinates.

5. **More trains visible in Paris** — currently 42% of journeys get a `seg` (usable timetable segment), up from 11%. The remaining 58% either have only 1 call in PRIM (can't interpolate — need 2 stops to form a segment) or their stop Q-IDs aren't in our 805-stop lookup table. To investigate: hit `/paris/debug` and look for stop IDs that return null from `lookupParisStopById`.

6. **Tokyo live data** — ODPT API, free key at https://developer.odpt.org. Add `/trains/tokyo` worker endpoint.

### Key technical context for next session

**Paris animation — how it works:**
Worker parses SIRI Lite `EstimatedCalls` per journey, finds the segment where `now` falls between `tDep` (stop A departure) and `tArr` (stop B arrival), returns `seg: {aLat,aLng,tDep,bLat,bLng,tArr}`. Client computes `t = (Date.now()-tDep)/(tArr-tDep)` and lerps. Works correctly even on stale cached responses because all timestamps are absolute UTC ms.

**Paris 503 fix (w3.8) — what we did:**
- `_tsCache` Map memoizes `new Date(s).getTime()` — reduced from ~24,000 allocations to near-zero per compute
- Two-tier cache: 60s `cacheKey` + 300s `staleKey`; on failure the stale response is served
- Fallback segment search is now O(1) (only checks calls[0]→calls[1])

**Worker version history shortcuts:**
- NYC was broken by CPU limit → fixed in w3.5 (Cache API + TextDecoder reuse)
- Paris was broken by CPU limit → fixed in w3.8 (timestamp memo + stale fallback)
- Both patterns: free-tier Workers has 10ms CPU limit; fix = cache aggressively and memoize expensive operations

---

## Platform Build Plan

| Track | Platforms | Stack | Status |
|---|---|---|---|
| 1 | Apple TV, iPad, iPhone | SwiftUI + MapKit + AdMob | ✅ Code written, not in Xcode |
| 2 | Samsung TV, LG TV | React + Tizen / webOS + GAM | 🔲 Not started |
| 3 | Android TV, Fire TV | Kotlin + Compose + AdMob | 🔲 Not started |
| 4 | Roku | BrightScript + RAF | 🔲 Lowest priority |

---

## iOS/tvOS App Setup (when ready)

```bash
# 1. Install tools
brew install protobuf swift-protobuf

# 2. Generate protobuf types
curl -O https://raw.githubusercontent.com/google/transit/master/gtfs-realtime/proto/gtfs-realtime.proto
protoc --swift_out=. gtfs-realtime.proto
# → adds GtfsRealtime.pb.swift to project

# 3. Xcode: new SwiftUI project, add tvOS target
# 4. Add Swift packages:
#    https://github.com/apple/swift-protobuf
#    https://github.com/googleads/swift-package-manager-google-mobile-ads
# 5. Copy all Swift files from ios-app/TransitMap/ into Xcode project
# 6. Add AdMob App IDs to Info.plist (GADApplicationIdentifier)
# 7. Replace test Ad Unit IDs in AdManager.swift
```

---

## Adding a New City

1. Add city config to `prototype/transitmap-prototype.html` CITIES object:
   ```javascript
   london: {
     name: 'London', center: [51.509, -0.118], zoom: 12,
     timezone: 'Europe/London',
     lines: [{id:'Central', name:'Central', color:'#E32017'}, ...],
     routes: [{id:'Central', color:'#E32017', path:[[51.52,-0.05],...]}],
   }
   ```
2. Add worker endpoint `/trains/london` in `index.js`
3. Add city button in prototype HTML
4. Add to `fetchRealTrains()` city condition

Cities ready to add (all have GTFS-RT feeds):
- **London** — TfL Unified API (free key at https://api.tfl.gov.uk)
- **Chicago** — CTA GTFS-RT (free, no key)
- **San Francisco** — 511 SF Bay (free key at https://511.org/open-data/token)
- **Tokyo** — ODPT (free key at https://developer.odpt.org)

---

## Change Log

| Date | Version | Change |
|---|---|---|
| 2026-05-28 | v4.14 | City switcher: dropdown "More ▾" + dynamic last-3 quick buttons; pickCity() tracks recents |
| 2026-05-28 | v4.13 | Tokyo: fix ODPT URL (v4 not 4), single-fetch all operators, handle null toStation, add Arakawa tram — worker w4.6; note: key covers Toei only (no TokyoMetro) |
| 2026-05-28 | v4.12 | Tokyo: switch from simulated to real ODPT data (ODPT JSON API, station midpoint positioning) — worker w4.5 |
| 2026-05-28 | v4.11 | Helsinki Metro: M2 now red (#E4003A) to distinguish from M1 orange — worker w4.4 |
| 2026-05-28 | v4.10 | Helsinki: add trams (1–15, green) + commuter rail (I/K/L/P/R/T/U/X/Y/Z) with individual colors + route paths — worker w4.3 |
| 2026-05-28 | v4.9 | Fix Sydney route ID matching — TfNSW uses prefix format (NSN_, ESI_, APS_, etc.) not T1/T4; added T3/T5/T9 to legend; 134 trains live |
| 2026-05-28 | v4.8 | Add Helsinki (HSL Metro M1/M2, free GTFS-RT) and Sydney (TfNSW T1/T2/T4/T8/Metro M1) — prototype routes + city buttons + worker w4.2 fetch functions |
| 2026-05-28 | v4.7 | Remove ad system — all ad CSS, HTML panel, and JS scheduling removed; fade-cover retained for city-switch transition |
| 2026-05-28 | v4.6 | Fix version stamp format consistency: both lines now use YYYY-MM-DD · HH:MM PT (toPT() was producing MM/DD/YYYY format via toLocaleString) |
| 2026-05-28 | v4.5 | Version stamp: added second line showing worker version + data timestamp in PT (e.g. "w4.1 · data 05/28/2026 · 15:44 PT"). Worker now returns workerVersion field in all city responses; WORKER_VERSION constant added to worker. Prototype uses toPT() helper (Intl.DateTimeFormat with America/Los_Angeles) to convert updatedAt UTC → PT |
| 2026-05-28 | v4.4 | Paris animation rework — snap-to-route: instead of projecting both segment endpoints to route T values (caused jumps on symmetric/curved lines), now interpolates position in lat/lng space between the two stop coordinates, then snaps the interpolated point to the nearest point on the route polyline each frame. Simpler, more robust, eliminates wrong-direction and wrong-section artifacts. Added snapToRoute() helper; removed segTA/segTB |
| 2026-05-28 | w4.1 | Paris: prevent trains skipping multiple stations — PRIM omits intermediate stops so adjacent time-sorted pairs can span 3-4 physical stations. Added distance cap: pairs more than 0.013° apart (~1.44km N-S, ~0.96km E-W at 48.8°N) are rejected. Paris Metro max legitimate inter-station ≈ 950m (La Défense→Esplanade). Both active-segment and fallback loops now use validPair() check. Deployed d3af5ffd |
| 2026-05-28 | v4.3 | Paris route-constrained animation: trains now move along their metro line polyline instead of flying in a straight line between stop coordinates. At fetch time, both segment endpoints (aLat/aLng and bLat/bLng) are projected onto the route polyline via projectOnRouteT → stored as segTA/segTB. stepTrains interpolates routeAtT(path, segTA + t*(segTB-segTA)) each frame. Straight-line fallback kept for trains with no route path |
| 2026-05-28 | w4.0 | Fix NYC self-reinforcing 503 loop: same thundering-herd pattern as Paris — compute fails CPU limit → cache.put never runs → cache never refreshes → every request is a miss → loop. Fix: two-tier cache (30s fresh + 300s stale fallback); on compute failure serve stale instead of 503. Cache TTL 15s→30s. Deployed d8c63575 |
| 2026-05-28 | w3.9 | Fix Paris trains not moving: PRIM returns EstimatedCalls in stop-sequence order (not time order) — bidirectional/loop lines produce pairs like 22:32→22:30→22:34→22:28 so every tArr>tDep check failed. Fix: sort calls by departure time before processing, take 10 calls instead of 5, restore full fallback loop. Result: 14→63 actively moving trains, 11%→42% with valid seg. M14 (automated) at 95%. Deployed 34952ab4 |
| 2026-05-28 | w3.8 | Fix Paris intermittent 503 (thundering herd + CPU limit): (1) module-level timestamp memoization (_tsCache Map) cuts ~24,000 new Date() calls per compute to near-zero; (2) two-tier cache — 60s fresh key + 300s stale-fallback key; PRIM failure now serves last good response instead of 503; (3) fallback loop shortened from O(n) to O(1) by only checking calls[0]→calls[1]. 10/10 parallel requests return 200. Deployed e1e74bbc |
| 2026-05-28 | v4.2 | Paris clock-driven animation: worker now returns timetable segment endpoints (aLat/aLng/tDep → bLat/bLng/tArr); client uses Date.now() to interpolate continuously — no velocity, no ID matching. Worker also returns upcoming segments (train departing soon) so 25% of trains have a segment vs 6% before. Cap at 180s filters PRIM multi-station gaps. Median segment 97s = correct Metro speed |
| 2026-05-28 | w3.7 | Paris interpolation: worker returns seg {aLat,aLng,tDep,bLat,bLng,tArr} per train; fallback builds upcoming call[0]→call[1] segment so trains animate automatically when departure time passes; cap 180s filters multi-station PRIM gaps; calls slice 3→5 |
| 2026-05-28 | v4.1 | Fetch stats panel: per-city success/fail counters (✓/✗ + %) displayed in fetch-log panel; resets at midnight (daily); skips don't count as attempts |
| 2026-05-28 | v4.0 | Route-constrained animation: trains advance along their route polyline instead of dead-reckoning in lat/lng space. projectOnRouteT() snaps each reported position onto the track; routeSpeed (ΔrouteT/ms from last 2 fetches) drives per-frame motion. Trains never drift off their line. Direction is natural from sign of speed. No route path = stays at reported position |
| 2026-05-28 | v3.9 | Dead-reckoning animation: replaced 15s lerp (froze when complete) with velocity extrapolation — measure speed from last 2 fetches, continue at that rate until next fetch corrects position. Trains now move continuously. First fetch has v=0; velocity resets on each new fetch pair. Cap at 120s to prevent runaway drift |
| 2026-05-28 | v3.8 | Fix status pill showing stale data from previous city: switchCity() now immediately sets correct label per city type ("Connecting…" for live cities, "Simulated · Tokyo Metro" for Tokyo, kept Timetable for Shinkansen), and triggers an immediate fetch instead of waiting up to 15s |
| 2026-05-28 | w3.6 | Fix Paris intermittent 503: add Cache API on /trains/paris response (20s TTL) — same CPU-limit issue as NYC w3.5. Cold: ~2.5s, warm: ~60ms. No more 503s under rapid-fire load |
| 2026-05-28 | w3.5 | Fix NYC worker error 1102 (CPU limit): cache final decoded JSON via Cache API (15s TTL) so protobuf decode runs once per datacenter not per poll; reuse single TextDecoder; str() now zero-copy (subarray not slice); MTA feed cache TTL 10s→30s. Result: 363ms cold → 59ms warm |
| 2026-05-28 | v3.7 | Fix fetching broken by AbortSignal.timeout() browser incompatibility: replaced with AbortController+setTimeout; added on-screen fetch log panel (top-right) showing timestamp, city, result, and duration for last 8 attempts |
| 2026-05-28 | v3.6 | Fix frequent fetch failures: add _fetchInFlight guard (prevents overlapping polls), AbortSignal.timeout(12s) on prototype fetch, PRIM cache TTL 15s→30s, cap interpolation to first 3 calls per journey |
| 2026-05-28 | w3.3 | Paris worker: interpolate train position between stops using ExpectedArrivalTime/ExpectedDepartureTime from SIRI EstimatedCalls — trains no longer snap to fixed stop points but move smoothly between stations based on real timetable timing |
| 2026-05-28 | v3.5 | Tokyo map rebuilt from OpenStreetMap station coordinates — all 13 lines (9 Tokyo Metro + 4 Toei) redrawn with real station lat/lng; Oedo loop path corrected; zoom adjusted to 12 to show full network |
| 2026-05-28 | v3.4 | South Bellevue departure board: now fetches live OBA real-time data (stop 40_E09-T2, /departures/south-bellevue worker endpoint); shows "Live · Sound Transit" badge when predicted times available; falls back to schedule if OBA key unavailable |
| 2026-05-28 | v3.3 | Seattle pane: departure board (bottom-left) showing next 4 trains from South Bellevue → Westlake on 2 Line; clock-driven from Sound Transit schedule (12-min peak / 24-min off-peak); updates every minute; hidden on other city panes |
| 2026-05-28 | v3.2 | Fix M11 and M14 route paths: M11 adds Jourdain + 3 eastern extension stations (Montreuil-Hôpital, La Dhuys, Rosny-Bois-Perrier); M14 adds 4 southern extension stations (Villejuif-Gustave Roussy, Hôpital Bicêtre, Maison Blanche, Olympiades) bridging the gap to L'Haÿ-les-Roses |
| 2026-05-28 | v3.1 | Paris live data working: switched from non-existent GTFS-RT feed to PRIM SIRI Lite estimated-timetable; 805-stop ID lookup table; correct STIF line IDs; ~850 trains live |
| 2026-05-28 | v3.0 | Paris Metro routes rebuilt from official IDFM station coordinates — all 16 lines accurate (M1–M14, M3b, M7b), replacing hand-crafted approximations off by up to ~800m |
| 2026-05-27 | v2.9 | Fix: LAST_EDIT timestamp was showing 17:30 PT (future); corrected to 11:20 PT |
| 2026-05-27 | v2.8 | Shinkansen timetable engine: 9 service types, clock-driven positions, no API key needed |
| 2026-05-27 | v2.7 | Fix GitHub Pages stale cache: no-cache meta tags + ?v= query string in index.html redirect |
| 2026-05-27 | v2.6 | Version stamp now shows time in Pacific Time (e.g. "v2.6 · built 2026-05-27 · 16:45 PT") |
| 2026-05-27 | v2.5 | Project rule: HANDOFF.md must be updated on every code change; added CLAUDE.md |
| 2026-05-27 | v2.4 | Fix: trains flying across map — distance guard (>0.05° = teleport not lerp); worker uses tripId as stable key |
| 2026-05-27 | v2.3 | Fix: async race condition — NYC fetch result no longer overwrites status/trains on other cities |
| 2026-05-27 | v2.2 | Japan Shinkansen city: 6 lines (Tokaido-Sanyo, Tohoku, Joetsu, Hokuriku, Kyushu, Nishi-Kyushu) |
| 2026-05-27 | v2.1 | Paris live data endpoint added (URL debugging in progress) |
| 2026-05-27 | v2.0 | Smooth lerp animation — real trains glide between 15s API updates |
| 2026-05-27 | v1.9 | NYC routes rebuilt from real GTFS stop coordinates — all 24 lines accurate |
| 2026-05-27 | v1.8 | Always update trains on fetch; show last-updated HH:MM:SS in status pill |
| 2026-05-27 | v1.7 | Fix closeAd — canvas resize + invalidateSize through full CSS transition |
| 2026-05-27 | v1.6 | Seattle live data polling via Sound Transit OBA (pending key) |
| 2026-05-27 | v1.5 | A/C/E distinct blue shades; city-local timezone in top-left clock |
| 2026-05-27 | v1.4 | NYC route paths redrawn from real stop coords (A train branches fixed) |
| 2026-05-27 | v1.3 | Removed bottom-right clock; version stamp = build time only |
| 2026-05-27 | v1.2 | Local city date/time added top-left; muted text brightened |
| 2026-05-27 | v1.1 | Real MTA train data live; worker deployed; 15s polling; position lerp |
| 2026-05-26 | v1.0 | Initial prototype: Leaflet maps, simulated trains, split-screen ads |
