# TransitMap — Handoff Document

> **Last updated:** 2026-05-29 · 13:35 PT
> **Prototype version:** v4.20 · **Worker version:** w4.7
> **Repo:** https://github.com/marcboy/transitmap
> **Live prototype:** https://marcboy.github.io/transitmap/
> **Cloudflare Worker:** https://transitmap.marcboyer-public.workers.dev

---

## What This Is

An ambient, art-like live transit map showing real-time subway and train positions across multiple world cities. Built as a beautiful background display for Samsung TVs, Apple TV, and other smart TV platforms. Currently exists as a browser prototype + Cloudflare Worker backend, with a Samsung TV (Tizen) app structure ready to package.

---

## Repository Layout

```
transitmap/
├── prototype/
│   └── transitmap-prototype.html     ← Single-file web prototype (source of truth for all platforms)
├── cloudflare-worker/
│   ├── index.js                      ← Backend: fetches all city feeds, decodes GTFS-RT
│   └── wrangler.toml                 ← Cloudflare config (name="transitmap")
├── platforms/
│   ├── shared/
│   │   └── platform.js              ← TV input/IAP abstraction layer (Samsung, LG, Android TV)
│   ├── samsung/
│   │   ├── config.xml               ← Tizen Web App manifest
│   │   ├── build.js                 ← Build script: prototype → index.html + TV patches
│   │   ├── tv-nav.js                ← D-pad remote navigation (city switching)
│   │   ├── README.md                ← Samsung TV setup guide
│   │   └── .gitignore               ← Ignores generated index.html and .wgt
│   ├── lg-webos/
│   │   ├── appinfo.json             ← webOS manifest stub
│   │   └── README.md               ← LG TV notes
│   ├── android-tv/
│   │   └── README.md               ← Android TV / Vizio notes
│   ├── roku/
│   │   └── README.md               ← Roku notes (BrightScript — most different)
│   └── apple-tv/
│       └── README.md               ← Apple TV notes (references Swift app)
├── CLAUDE.md                        ← Rules for Claude (auto-push, HANDOFF updates, etc.)
└── HANDOFF.md                       ← This file
```

---

## Live City Data

| City | Trains | Source | Worker endpoint |
|---|---|---|---|
| New York | ~350 live | MTA GTFS-RT (free, no key) | `/trains/nyc` |
| Paris | ~800 live | IDFM PRIM SIRI Lite (needs `IDFM_API_KEY`) | `/trains/paris` |
| Tokyo (Toei) | ~40 live | ODPT JSON API (needs `ODPT_API_KEY`) | `/trains/tokyo` |
| Tokyo Metro | ~200 sim | JST clock-driven headway simulation | merged in prototype |
| Helsinki | ~120 live | HSL GTFS-RT (free, no key) | `/trains/helsinki` |
| Sydney | ~130 live | TfNSW GTFS-RT (free, no key) | `/trains/sydney` |
| Seattle | live | Sound Transit OBA (needs `OBA_API_KEY`) | `/trains/seattle` |
| Shinkansen | timetable | JR schedule data (no API) | computed in prototype |

### City tiers (IAP)
```
FREE_CITIES    = ['nyc', 'paris', 'tokyo']
PREMIUM_CITIES = ['seattle', 'helsinki', 'sydney', 'japan']
```
- `unlockPremium()` is the single IAP callback point (called by Swift or Platform.purchase())
- Premium state persisted in `localStorage('transitmap_premium')`

---

## Cloudflare Worker

**File:** `cloudflare-worker/index.js`
**Deploy:** `cd cloudflare-worker && wrangler deploy`
**Current version:** `w4.7` (constant `WORKER_VERSION` at top of file)

### Secrets (set via `wrangler secret put SECRET_NAME`)
| Secret | City | How to get |
|---|---|---|
| `IDFM_API_KEY` | Paris | https://prim.iledefrance-mobilites.fr → account → API key |
| `ODPT_API_KEY` | Tokyo (Toei) | https://developer.odpt.org → free key |
| `OBA_API_KEY` | Seattle | Email open_transit_data@soundtransit.org |

> ⚠️ **Rotate the IDFM API key** — it was exposed in earlier chat history.

### Worker response format
```json
{
  "city": "nyc",
  "count": 347,
  "workerVersion": "w4.7",
  "updatedAt": "2026-05-29T18:00:00Z",
  "trains": [
    { "id": "trip123", "line": "A", "color": "#1657A8", "lat": 40.753, "lng": -73.987, "status": "MOVE" }
  ]
}
```

### Caching strategy
- NYC: 30s fresh + 300s stale fallback (prevents thundering-herd CPU limit failures)
- All others: 15s fresh + 300s stale
- Stale cache served on upstream failure — no 503s

---

## Prototype

**File:** `prototype/transitmap-prototype.html`
**View live:** https://marcboy.github.io/transitmap/
**This is the source of truth for all TV platforms.**

### Key constants (top of `<script>`)
```javascript
const WORKER_URL = 'https://transitmap.marcboyer-public.workers.dev';
const VERSION    = 'v4.20';
const LAST_EDIT  = '2026-05-28 · 20:43 PT';
```

### How trains move
1. `fetchRealTrains()` called on load and every **15 seconds**
2. Each train's GPS position is **projected onto its route polyline** (`projectOnRouteT`)
3. Between fetches, trains advance along the line at the measured speed (`routeT += routeSpeed * dt`)
4. Paris trains use **clock-driven timetable segments** (`seg` object) — interpolate between stop A → stop B using wall clock
5. Tokyo Metro uses **headway simulation** — JST time drives position on each line's path
6. Shinkansen uses **JR schedule timetable** — computed entirely in the prototype

### Light/dark map toggle
- Button: `☀` / `🌑` in top-right
- Dark: CartoDB `dark_all`
- Light: CartoDB `rastertiles/voyager` (grey city, clear blue water)
- `drawRoutes()` and `drawTrains()` both check `mapTheme === 'light'` and adjust opacity/glow

### How to update a city's routes
Routes are stored in `CITIES[id].routes` as arrays of `[lat, lng]` pairs:
```javascript
{ id:'T1', color:'#F9E200', path:[ [-33.867,151.207], [-33.839,151.206], ... ]}
```
Trains with a matching `line` ID snap to the closest point on the route path. If no route matches, the train renders at its GPS coordinates with no track line underneath.

---

## Samsung TV App

### Architecture
The Samsung app is a **Tizen Web App** — same HTML/JS/CSS as the prototype, packaged as a `.wgt` file.

`platforms/samsung/build.js` reads the prototype and applies TV patches:
- Inlines `platform.js` (input/IAP abstraction)
- Inlines `tv-nav.js` (D-pad city navigation overlay)
- Adds TV safe-zone CSS (80px insets, larger fonts, `cursor: none`)
- Hides dev tools (fetch log, theme toggle)
- Replaces the click-based city switcher with a D-pad overlay

**The prototype is the single source of truth.** When prototype data or logic changes, re-run `node build.js` to update the TV app.

### Remote control navigation
A city nav bar appears at the bottom when the user presses left/right:
- **◀ / ▶** — browse cities
- **OK / Enter** — select highlighted city
- **Back** — dismiss overlay (second Back exits app)
- Overlay auto-hides after 5 seconds of inactivity

### Platform abstraction (`platforms/shared/platform.js`)
```javascript
Platform.type          // 'tizen' | 'webos' | 'firetv' | 'web'
Platform.init()        // registers keys, hides cursor
Platform.onRemoteKey(handler)  // unified D-pad events
Platform.purchase(id, ok, fail) // IAP bridge (stub — wire per platform)
Platform.exit()        // platform-specific app exit
```

---

## Development Environment (Mac — Apple Silicon)

### What's installed
| Tool | Location | Version |
|---|---|---|
| Tizen Studio CLI | `~/tizen-studio/` | 6.1 |
| Tizen `tizen` CLI | `~/tizen-studio/tools/ide/bin/tizen` | 2.5.25 |
| Java 8 (Zulu ARM64) | `~/jdk-zulu8/` | 1.8.0_492 |
| Java 17 (Homebrew) | `/opt/homebrew/opt/openjdk@17/` | 17.0.19 |
| Samsung TV resources | `~/tizen-studio/` | 10.0.0 |
| Developer certificate | `~/tizen-studio-data/keystore/author/transitmap-author.p12` | self-signed |
| Security profile | `~/tizen-studio-data/profile/profiles.xml` | `TransitMapDev` |

> **Note on Java:** Tizen's package manager requires Java 8 (JAXB removed in Java 9+). The SDK uses the Zulu JDK 8 at `~/jdk-zulu8/`. This is configured in `~/tizen-studio/sdk.info`:
> ```
> JDK_PATH=/Users/marcboyer/jdk-zulu8
> ```

> **Note on emulator:** The Tizen TV emulator is Intel-only and won't run on Apple Silicon. Test on a real Samsung TV instead.

### Shell PATH (added to `~/.zshrc`)
```bash
export TIZEN_STUDIO="$HOME/tizen-studio"
export JAVA_HOME="$HOME/jdk-zulu8/Contents/Home"
export PATH="$TIZEN_STUDIO/tools/ide/bin:$TIZEN_STUDIO/tools:$JAVA_HOME/bin:$PATH"
```
Open a new terminal after setup for these to take effect.

---

## Build & Deploy — Samsung TV

### Full workflow (run from repo root)

```bash
# 1. Build the TV app from the prototype
cd platforms/samsung
node build.js
# → generates platforms/samsung/index.html (TV-adapted, self-contained)

# 2. Package as a signed .wgt file
tizen package --type wgt --sign TransitMapDev -- .
# → generates platforms/samsung/TransitMap.wgt (signed, ready to install)

# 3a. Sideload onto a Samsung TV (Developer Mode required)
#     On the TV: Settings → Support → Developer Mode → enter your Mac's IP
tizen install --target <TV-IP-ADDRESS> -- TransitMap.wgt

# 3b. Watch mode — auto-rebuilds when prototype changes
node build.js --watch
```

### To publish to Samsung Seller Office
1. Replace `0000000000` in `platforms/samsung/config.xml` with your actual package ID from https://seller.samsungapps.com
2. Create a distribution certificate (Samsung partner account required) — replaces the current self-signed dev cert
3. Re-run `tizen package` with the distribution profile
4. Upload `.wgt` to Samsung Sellers Office

---

## Build & Deploy — LG webOS

```bash
# 1. Build the app
cd platforms/lg-webos
node build.js
# → generates platforms/lg-webos/index.html

# 2. Package as .ipk
ares-package .
# → generates com.marcboyer.transitmap_1.0.0_all.ipk

# 3a. Add your LG TV as a device (one-time)
ares-setup-device    # follow prompts: enter TV IP, port 3000, passphrase from TV

# 3b. Install on TV (Developer Mode must be on)
ares-install --device <device-name> com.marcboyer.transitmap_1.0.0_all.ipk

# 3c. Launch
ares-launch --device <device-name> com.marcboyer.transitmap
```

### Enable Developer Mode on LG TV
1. Home → Settings → Support → **Software Info**
2. **Rapidly press OK 5 times** on "Software Info" — Developer Mode dialog appears
3. Toggle on, enter your Mac's IP
4. Install the **LG Developer Mode app** from the LG Content Store

---

## Other TV Platforms (future)

| Platform | Approach | Effort | Key difference |
|---|---|---|---|
| LG webOS | Same as Samsung — web app, `appinfo.json` manifest | Low | `ares-package` instead of Tizen CLI; `webOS` global for platform detection |
| Android TV / Vizio | Android app with WebView loading `index.html` | Medium | IAP via Google Play Billing; Java bridge to call `unlockPremium()` |
| Roku | Full BrightScript rewrite — no HTML5 support | High | Uses same Cloudflare Worker API; different rendering engine entirely |
| Apple TV | Native tvOS SwiftUI app (already in progress) | — | IAP via StoreKit; Swift bridge calls `unlockPremium()` |

See `platforms/*/README.md` for detailed notes on each.

---

## Adding a New City

### 1. Prototype (`prototype/transitmap-prototype.html`)
Add to the `CITIES` object:
```javascript
london: {
  name: 'London',
  center: [51.509, -0.118],
  zoom: 12,
  timezone: 'Europe/London',
  lines: [
    { id:'Central', name:'Central', color:'#E32017' },
    // ...
  ],
  routes: [
    { id:'Central', color:'#E32017', path:[[51.515,-0.072],[51.513,-0.085],...] },
    // ...
  ],
},
```
Add to `ALL_CITIES_LIST` and either `FREE_CITIES` or `PREMIUM_CITIES`.

### 2. Worker (`cloudflare-worker/index.js`)
Add a `/trains/london` handler. Cities with free GTFS-RT feeds ready to add:
- **London** — TfL Unified API (free key at https://api.tfl.gov.uk)
- **Chicago** — CTA GTFS-RT (free, no key)
- **San Francisco** — 511 SF Bay (free key at https://511.org/open-data/token)
- **Berlin** — VBB GTFS-RT (free)

### 3. Rebuild TV app
```bash
cd platforms/samsung && node build.js
```
City data is picked up automatically — no TV-specific changes needed.

---

## Updating the Prototype

After editing `prototype/transitmap-prototype.html`:

1. Bump `VERSION` and `LAST_EDIT` at the bottom of the `<script>` block
2. Update `?v=X.X` in both lines of `index.html` (cache-busting)
3. Update HANDOFF.md change log
4. Rebuild TV app: `cd platforms/samsung && node build.js`
5. Commit and push

```bash
TZ='America/Los_Angeles' date '+%Y-%m-%d · %H:%M PT'   # → exact LAST_EDIT value
```

## Updating the Worker

After editing `cloudflare-worker/index.js`:

1. Bump `WORKER_VERSION` constant (e.g. `'w4.7'` → `'w4.8'`)
2. Deploy: `cd cloudflare-worker && wrangler deploy`
3. Note the deployed version ID in HANDOFF.md

---

## Secrets Management

```bash
# List currently set secrets
cd cloudflare-worker && wrangler secret list

# Set or rotate a secret
wrangler secret put IDFM_API_KEY
wrangler secret put ODPT_API_KEY
wrangler secret put OBA_API_KEY
```

---

## Change Log

| Date | Version | Change |
|---|---|---|
| 2026-05-29 | — | LG webOS app built: build.js + appinfo.json + ares-package → com.marcboyer.transitmap_1.0.0_all.ipk (34 KB); shares tv-nav.js + platform.js with Samsung |
| 2026-05-29 | — | Tizen Studio 6.1 + Zulu JDK 8 installed; dev cert + TransitMapDev profile; `tizen package` produces signed `TransitMap.wgt`; PATH configured in `~/.zshrc` |
| 2026-05-29 | — | Multi-platform structure: `platforms/shared/platform.js` (unified input/IAP API), `platforms/samsung/` (build.js + tv-nav.js + config.xml), stubs for LG / Android TV / Roku / Apple TV |
| 2026-05-28 | v4.20 | Sydney: add T3 (Bankstown), T5 (Cumberland), T9 (Northern); extend T1 to Berowra/Penrith, T2 to Leppington, T4 to Waterfall + Cronulla branch, T8 to Campbelltown |
| 2026-05-28 | v4.19 | City tier system: FREE_CITIES + PREMIUM_CITIES; `unlockPremium()` IAP callback; locked cities show 🔒; unlock modal |
| 2026-05-28 | v4.18 | Light mode: CartoDB Voyager tile (blue water); softer train glow + route opacity in light mode |
| 2026-05-28 | v4.17 | Light/dark map toggle — ☀/🌑 button; CartoDB Voyager vs dark_all |
| 2026-05-28 | v4.16 | Helsinki: 7 missing commuter lines (I/L/P/T/X/Y/Z); worker w4.7 maps all trams to `tram` |
| 2026-05-28 | v4.15 | Tokyo Metro: 9 lines JST headway simulation (same as mini-tokyo-3d); Toei keeps real ODPT data |
| 2026-05-28 | v4.14 | City switcher: dropdown "More ▾" + dynamic last-3 quick buttons |
| 2026-05-28 | v4.13/w4.6 | Tokyo: fix ODPT URL, single-fetch all operators, add Arakawa tram |
| 2026-05-28 | v4.12/w4.5 | Tokyo: switch from simulated to real ODPT data |
| 2026-05-28 | v4.11/w4.4 | Helsinki Metro: M2 now red to distinguish from M1 orange |
| 2026-05-28 | v4.10/w4.3 | Helsinki: trams (1–15) + commuter rail (I/K/L/P/R/T/U/X/Y/Z) with routes |
| 2026-05-28 | v4.9 | Fix Sydney route ID matching — TfNSW uses prefix format (NSN_, ESI_, APS_…) |
| 2026-05-28 | v4.8/w4.2 | Add Helsinki + Sydney — prototype routes + worker fetch functions |
| 2026-05-28 | v4.7 | Remove ad system (CSS, HTML, JS) |
| 2026-05-28 | v4.4 | Paris animation: snap-to-route replaces T-value projection (fixes wrong-direction jumps) |
| 2026-05-28 | v4.0 | Route-constrained animation: `projectOnRouteT` + `routeSpeed` — trains stay on their line |
| 2026-05-28 | w4.1 | Paris: distance cap on stop pairs — rejects multi-station PRIM gaps |
| 2026-05-28 | w4.0 | NYC two-tier cache (30s fresh + 300s stale) — eliminates thundering-herd 503 loop |
| 2026-05-28 | w3.9 | Paris: sort EstimatedCalls by departure time — fixes trains stuck at wrong direction |
| 2026-05-28 | w3.8 | Paris: timestamp memoization + stale fallback — no more 503 under load |
| 2026-05-28 | v4.2/w3.7 | Paris clock-driven animation: `seg {aLat,aLng,tDep,bLat,bLng,tArr}` from worker |
| 2026-05-28 | v3.9 | Dead-reckoning animation between fetches (velocity extrapolation) |
| 2026-05-28 | v3.5 | Tokyo routes rebuilt from OpenStreetMap station coordinates |
| 2026-05-28 | v3.3/w3.3 | Seattle departure board (South Bellevue → Westlake, 2 Line) |
| 2026-05-28 | v3.1 | Paris live data: PRIM SIRI Lite + 805-stop ID lookup table |
| 2026-05-28 | v3.0 | Paris routes rebuilt from IDFM official station coordinates |
| 2026-05-27 | v2.8 | Shinkansen timetable engine: 9 service types, clock-driven, no API |
| 2026-05-27 | v1.9 | NYC routes rebuilt from real GTFS stop coordinates |
| 2026-05-27 | v1.1 | Real MTA train data live; worker deployed; 15s polling |
| 2026-05-26 | v1.0 | Initial prototype: Leaflet maps, simulated trains |
