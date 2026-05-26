# TransitMap — Track 1: Apple Platforms

Ambient live transit display for Apple TV, iPad, and iPhone.

---

## Project Structure

```
transitmap/
├── cloudflare-worker/          # Backend — GTFS-RT decoder
│   ├── index.js                # Main worker (routes, API)
│   ├── cities.js               # City configs (NYC, Paris, ...)
│   ├── gtfs-decoder.js         # Protobuf decoder (no dependencies)
│   └── wrangler.toml           # Cloudflare config
│
└── ios-app/TransitMap/
    ├── TransitMapApp.swift     # App entry point
    ├── Models/
    │   └── TransitModels.swift # Data models
    ├── Services/
    │   ├── TransitAPIService.swift   # API calls
    │   └── TransitViewModel.swift    # State + ad timer
    ├── AdManager/
    │   └── AdManager.swift     # Google AdMob integration
    └── Views/
        ├── TransitMapView.swift      # Main map display
        └── CitySelectorView.swift    # City picker (tvOS + iOS)
```

---

## Setup: Cloudflare Worker

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2. Deploy the worker
```bash
cd cloudflare-worker
wrangler deploy
```

### 3. Set API key secrets (never committed to code)
```bash
wrangler secret put MTA_API_KEY
# Paste your MTA API key when prompted
# Get one free at: https://api.mta.info/#/signup

wrangler secret put IDFM_API_KEY
# Paste your IDFM key when prompted
# Get one free at: https://prim.iledefrance-mobilites.fr
```

### 4. Test your endpoints
```bash
curl https://transitmap-worker.YOUR-SUBDOMAIN.workers.dev/health
curl https://transitmap-worker.YOUR-SUBDOMAIN.workers.dev/cities
curl https://transitmap-worker.YOUR-SUBDOMAIN.workers.dev/trains/nyc
curl https://transitmap-worker.YOUR-SUBDOMAIN.workers.dev/trains/paris
```

---

## Setup: iOS / tvOS App

### 1. Create Xcode project
- New Project → App (SwiftUI)
- Name: TransitMap
- Bundle ID: com.yourname.transitmap
- Targets: Add tvOS target alongside iOS

### 2. Add Google Mobile Ads SDK
- File → Add Packages
- URL: `https://github.com/googleads/swift-package-manager-google-mobile-ads`
- Version: Up To Next Major from 11.0.0

### 3. Configure Info.plist (add to BOTH iOS and tvOS targets)
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX</string>

<key>SKAdNetworkItems</key>
<array>
  <!-- Google's SKAdNetwork IDs — get latest list from AdMob dashboard -->
</array>
```

### 4. Update worker URL in TransitAPIService.swift
```swift
private let baseURL = "https://transitmap-worker.YOUR-SUBDOMAIN.workers.dev"
```

### 5. Update Ad Unit IDs in AdManager.swift
```swift
// Replace with real IDs from your AdMob dashboard
static let interstitial = "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
```

### 6. Build and run
- iPhone/iPad: Cmd+R on iOS target
- Apple TV: Select Apple TV simulator or device, Cmd+R

---

## Ad Timing

The ad interval is controlled centrally from the Cloudflare Worker:

```javascript
// cloudflare-worker/index.js
const AD_CONFIG = {
  intervalSeconds: 300,   // ← change this, all platforms update
  durationSeconds: 30,
  enabled: true,
};
```

Change it in one place — all platforms pick it up on next app launch.

---

## Adding a New City

1. Add entry to `cloudflare-worker/cities.js` (copy the Paris template)
2. Deploy: `wrangler deploy`
3. Done — all platforms automatically show the new city via `/cities`

Cities already configured:
- ✅ New York City (MTA GTFS-RT)
- ✅ Paris (IDFM / RATP GTFS-RT)

Commented templates ready for:
- 🔲 London (TfL)
- 🔲 Tokyo (TOEI / Tokyo Metro)
- 🔲 Chicago (CTA)
- 🔲 San Francisco (BART / SFMTA)

---

## Track 2 (Next): Samsung + LG

Same Cloudflare Worker backend. React web app packaged with Tizen CLI (Samsung)
and webOS SDK (LG). Mapbox GL JS for map rendering.

## Track 3 (Next): Android TV + Fire TV

Same Cloudflare Worker backend. Kotlin + Jetpack Compose, Google Maps SDK,
Leanback library for remote navigation.
