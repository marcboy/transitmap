# TransitMap — Handoff Document

> **Last updated:** 2026-05-27  
> **Prototype version:** v2.2  
> **Repo:** https://github.com/marcboy/transitmap  
> **Live Prototype:** https://marcboy.github.io/transitmap/  
> **Cloudflare Worker:** https://transitmap.marcboyer-public.workers.dev  

---

## What This Is

An ambient, art-like live transit map showing real subway train positions across multiple cities. Designed as a beautiful background display for Apple TV, smart TVs, lobbies, and homes. Revenue from programmatic ads (Google AdMob) shown in split-screen every 5 minutes.

---

## Live Status

| City | Data | Source | Status |
|---|---|---|---|
| New York | ✅ Real trains | MTA GTFS-RT (free, no key) | **Live** |
| Paris | 🔄 Real trains | IDFM PRIM GTFS-RT | **Key set, URL debugging** |
| Seattle | ⏳ Real trains | Sound Transit OBA | **Needs OBA key** |
| Tokyo | 🔲 Simulated | ODPT API | Not started |

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
- `GET /trains/paris` — all RATP metro lines, real GPS (needs IDFM_API_KEY)
- `GET /trains/seattle` — Sound Transit Link, real GPS (needs OBA_API_KEY)
- `GET /paris/probe` — debug: tests 5 IDFM URL patterns to find correct one

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
- Single feed: `https://prim.iledefrance-mobilites.fr/marketplace/gtfs-rt/vehiclePositions`
- Auth header: `apikey: YOUR_KEY` (not `Authorization: Bearer`)
- Feed is **vehicle positions** — real GPS lat/lng
- Filters to metro lines only via `PARIS_LINES` map (IDFM route IDs like `IDFM:C01371`)
- **Status: URL returning 404 — correct path still being debugged**

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

## Paris Debugging — Current State

The IDFM API key `poYv9kJPLXNHzVyOGYwGcZhFjY224O9W` is working (server responds, not 401), but all tested URL paths return 404. The correct path is not yet confirmed.

Paths tried (all 404):
```
/marketplace/gtfs-rt/vehiclePositions
/marketplace/v2/gtfs-rt/vehiclePositions
/marketplace/gtfs-rt/vehicle-positions
/marketplace/v2/gtfs-rt/vehicle-positions
/marketplace/gtfs-realtime/vehiclePositions
```

**Next step:** Log into https://prim.iledefrance-mobilites.fr, find the subscribed API, and copy the exact endpoint URL shown in the API documentation page. Use `/paris/probe` endpoint to test new URL patterns.

> ⚠️ Rotate the IDFM API key — it has been visible in chat history.

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

<<<<<<< HEAD
| Date | Version | Change |
|---|---|---|
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
=======
| Date | Change |
|---|---|
| 2026-05-27 | Japan Shinkansen city: 6 lines (Tokaido-Sanyo, Tohoku, Joetsu, Hokuriku, Kyushu, Nishi-Kyushu) |
| 2026-05-26 | Worker deployed: https://transitmap.marcboyer-public.workers.dev |
| 2026-05-26 | MTA feeds now open — API key no longer required (confirmed 2025) |
| 2026-05-26 | Real MTA data: worker rewritten as single file, prototype polls worker every 20s |
| 2026-05-26 | UI readability: muted text opacity raised across all elements |
| 2026-05-26 | Map fix: reverted to Leaflet, applied 200ms invalidateSize pattern (credit: Gemini) |
| 2026-05-26 | Replaced Leaflet entirely with custom canvas tile engine (no init-sizing dependency) |
| 2026-05-26 | Root fix: L.map() moved inside window.load — tiles were never loading before |
| 2026-05-26 | Tokyo: all 13 subway lines (Tokyo Metro + Toei) |
| 2026-05-26 | Version stamp + edit time shown next to clock |
| 2026-05-26 | Train density: 5-8 per route (was 3-7) |
| 2026-05-26 | NYC: all 23 lines with full route paths added |
| 2026-05-26 | Seattle: 1 Line=red, 2 Line=blue (correct Sound Transit colors) |
| 2026-05-26 | Fix: city map tiles disappeared — Leaflet invalidateSize + window.load init |
| 2026-05-26 | Paris: all 16 lines added (M1-M14 incl. 3b, 7b) with full station coords |
| 2026-05-26 | Map brightness fixed: dark_matter_lite tiles + tint reduced 0.55→0.18 |
| 2026-05-26 | Prototype hosted on GitHub Pages: https://marcboy.github.io/transitmap/ |
| 2026-05-26 | Seattle: fixed 2 Line path via I-90 bridge + shared downtown tunnel stations with 1 Line | |
| 2026-05-26 | Removed Cloudflare dependency — direct feed fetching on-device |
| 2026-05-26 | Added `Config/CityConfig.swift` — all city config on-device |
| 2026-05-26 | Ad format changed: fullscreen overlay → split-screen (half map, half ad) |
| 2026-05-26 | Ad timer fixed: was firing every 15s in prototype, now correct 5-minute interval |
| 2026-05-26 | Prototype bug fixed: Unicode minus signs in coordinates caused blank screen |
| 2026-05-26 | Initial project scaffolded: Cloudflare Worker + SwiftUI app + HTML prototype |
>>>>>>> 3a59845 (v2.2: Japan Shinkansen — 6 lines across Honshu and Kyushu)
