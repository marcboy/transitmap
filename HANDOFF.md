# TransitMap — Handoff Document

> **Last updated:** 2026-05-28  
> **Prototype version:** v3.4 (worker v3.2)  
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
| Paris | ✅ Real trains | IDFM PRIM SIRI Lite estimated-timetable | **Live** |
| Seattle | ⏳ Real trains | Sound Transit OBA | **Needs OBA key** |
| Tokyo | 🔲 Simulated | ODPT API | Not started |
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
