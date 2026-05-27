# TransitMap — Handoff Document

> **Last updated:** 2026-05-26  
> **Last change:** 2026-05-27 04:02 UTC — local date/time added top-left under Live Transit
> **Repo:** https://github.com/marcboy/transitmap  
> **Live Prototype:** https://marcboy.github.io/transitmap/

---

## What This App Is

An ambient, art-like live transit map for displaying real subway train positions across multiple cities. Designed primarily as a beautiful background display for TVs, lobbies, and homes — like a living piece of transit art. Revenue comes from programmatic ads served every 5 minutes via Google AdMob.

---

## Current State

| Area | Status | Notes |
|---|---|---|
| Cloudflare Worker | ✅ Written, not deployed | Now optional — see Architecture |
| iOS/tvOS Swift app | ✅ Written, not in Xcode yet | Track 1 |
| Web prototype | ✅ Working | `prototype/transitmap-prototype.html` |
| NYC data | ✅ Ready | MTA GTFS-RT, free API key needed |
| Paris data | ✅ Ready | IDFM feed, free API key needed |
| AdMob integration | ✅ Written | Ad unit IDs need replacing |
| GitHub | ✅ Live | https://github.com/marcboy/transitmap |
| Track 2 (Samsung/LG) | 🔲 Not started | React + Tizen/webOS |
| Track 3 (Android TV) | 🔲 Not started | Kotlin + Compose |
| Track 4 (Roku) | 🔲 Not started | BrightScript — lowest priority |

---

## Architecture

```
MTA GTFS-RT (NYC)  ──┐
                      ├──▶  Swift TransitAPIService  ──▶  MapKit  ──▶  Apple TV/iPad/iPhone
IDFM GTFS-RT (Paris)─┘     (decodes protobuf on-device)

No backend server required. Cloudflare Worker is optional,
only needed if a future data source requires key protection.
```

### Why No Backend?
- Both MTA and IDFM feeds are **free with no billing** attached
- API keys can live in the app — theft has zero financial consequence
- Swift Protobuf decodes binary feeds natively on-device
- Fewer moving parts = easier to maintain

---

## Platform Build Plan

| Track | Platforms | Stack | Status |
|---|---|---|---|
| 1 | Apple TV, iPad, iPhone | SwiftUI + MapKit + AdMob | ✅ Code written |
| 2 | Samsung TV, LG TV | React + Tizen SDK / webOS SDK + GAM | 🔲 Next |
| 3 | Android TV, Fire TV | Kotlin + Compose + AdMob | 🔲 After Track 2 |
| 4 | Roku | BrightScript + RAF | 🔲 Last / optional |

All tracks share the same GTFS-RT data sources. No architecture changes needed to add tracks.

---

## Key Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Backend proxy | ❌ Removed | Free APIs, no billing risk, on-device protobuf decode is simpler |
| Ad network | Google AdMob / GAM | Covers all platforms; centralized dashboard; free to integrate |
| Ad format | Split-screen (half app, half ad) | Preserves ambient feel; less jarring than full overlay |
| Ad interval | 5 minutes | Balances revenue with ambient experience |
| Ad auto-dismiss | 30 seconds | User doesn't need to interact |
| Multi-city config | On-device (CityConfig.swift) | Instant load, no network call for city list |
| Map rendering | MapKit (Apple), Mapbox GL JS (web) | Free tiers sufficient; native quality |

---

## Files: What Does What

### Cloudflare Worker (`cloudflare-worker/`) — Optional
| File | Purpose |
|---|---|
| `index.js` | API routes: `/cities`, `/trains/:id`, `/config`, `/health` |
| `cities.js` | City/line/feed config (NYC + Paris) |
| `gtfs-decoder.js` | Protobuf → JSON decoder, zero dependencies |
| `wrangler.toml` | Deploy config |

### iOS/tvOS App (`ios-app/TransitMap/`)
| File | Purpose |
|---|---|
| `TransitMapApp.swift` | App entry, AdMob SDK init |
| `Config/CityConfig.swift` | ⭐ All city/line/feed config lives here |
| `Models/TransitModels.swift` | Data models: City, Train, LineInfo, AdConfig |
| `Services/TransitAPIService.swift` | Fetches GTFS-RT, decodes protobuf, returns [Train] |
| `Services/TransitViewModel.swift` | State manager: trains, city selection, ad timer |
| `AdManager/AdManager.swift` | AdMob interstitial: preload, present, auto-reload |
| `Views/TransitMapView.swift` | Main UI: dark map, glowing train dots, legend |
| `Views/CitySelectorView.swift` | City picker (grid on tvOS, sheet on iOS) |

### Prototype (`prototype/`)
| File | Purpose |
|---|---|
| `transitmap-prototype.html` | Standalone HTML/JS prototype — open in any browser |

---

## Setup Checklist (to go from repo → running app)

### Step 1 — API Keys (free)
- [x] MTA: No API key required (open as of 2025) ✓
- [ ] IDFM: Register at https://prim.iledefrance-mobilites.fr → paste key into `CityConfig.swift`

### Step 2 — AdMob
- [ ] Create AdMob account at https://admob.google.com
- [ ] Add iOS app + tvOS app → get App IDs
- [ ] Create Interstitial ad units for each → get Ad Unit IDs
- [ ] Add App IDs to `Info.plist` (`GADApplicationIdentifier`)
- [ ] Replace placeholder Ad Unit IDs in `AdManager.swift`

### Step 3 — Xcode Project
- [ ] New project → App (SwiftUI) → add tvOS target
- [ ] Add Swift Protobuf: `https://github.com/apple/swift-protobuf`
- [ ] Add Google Mobile Ads SDK: `https://github.com/googleads/swift-package-manager-google-mobile-ads`
- [ ] Generate GTFS types: `protoc --swift_out=. gtfs-realtime.proto` → add to target
- [ ] Copy all Swift files from repo into Xcode project

### Step 4 — Generate Protobuf Types
```bash
brew install protobuf swift-protobuf
curl -O https://raw.githubusercontent.com/google/transit/master/gtfs-realtime/proto/gtfs-realtime.proto
protoc --swift_out=. gtfs-realtime.proto
# Add GtfsRealtime.pb.swift to your Xcode target
```

---

## Adding a New City

1. Open `ios-app/TransitMap/Config/CityConfig.swift`
2. Copy the Paris block, fill in: feed URL, API key, map bounds, line colors
3. Add to `static let all: [City] = [nyc, paris, YOUR_CITY]`
4. Rebuild — all platforms get the new city automatically

Cities configured and ready:
- ✅ New York City (MTA GTFS-RT)
- ✅ Paris (IDFM / RATP GTFS-RT)
- ✅ Seattle (Sound Transit OneBusAway GTFS-RT)

Cities with working GTFS-RT feeds ready to add:
- London (TfL) — `https://api.tfl.gov.uk`
- Chicago (CTA) — `https://www.transitchicago.com/downloads/sch_data/`
- San Francisco (511 SF Bay) — `https://api.511.org/transit`
- Tokyo (ODPT) — `https://api.odpt.org`

---

## Ad Behavior (Current)

| Setting | Value | Where to change |
|---|---|---|
| Interval | 5 minutes | `TransitModels.swift` → `AdConfig.intervalSeconds` |
| Duration | 30 seconds | `TransitModels.swift` → `AdConfig.durationSeconds` |
| Format | Split-screen (left: map, right: ad) | `Views/TransitMapView.swift` + `AdManager/AdManager.swift` |
| Auto-dismiss | Yes, after 30s | `TransitViewModel.swift` |

**Prototype behavior:** The HTML prototype shows the same split-screen format. Timer is also set to 5 minutes in the prototype.

---

## Prototype

Open `prototype/transitmap-prototype.html` in any browser.

| Control | Action |
|---|---|
| City buttons (top center) | Switch between NYC, Paris, and Seattle |
| Click + drag | Pan the map |
| Scroll wheel | Zoom in/out |
| Every 5 minutes | Ad slides in from right (map shrinks to left half) |
| Dismiss button | Close ad, restart timer |

---

## What's Next (Suggested Order)

1. **Get API keys** (MTA + IDFM) — 15 minutes, both free
2. **Generate protobuf Swift file** — 10 minutes
3. **Create Xcode project** — paste in Swift files, add SPM packages
4. **Test on iOS Simulator** — verify trains appear on map
5. **Test on tvOS Simulator** — verify layout, Siri Remote navigation
6. **Set up AdMob** — create account, get test IDs working first
7. **Submit to App Store** (Apple TV + iPhone/iPad apps)
8. **Start Track 2** — React web app for Samsung + LG

---

## Open Questions

- App Store pricing? (Subscription / free with ads / one-time purchase)
- Should Paris ad copy be localized to French?
- Target: consumer app, or pitch to transit agencies / airports / hotels?
- App name: "TransitMap"? "Station"? "Lineage"? TBD

---

## Change Log

| Date | Change |
|---|---|
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
