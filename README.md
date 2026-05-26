# TransitMap — Track 1: Apple Platforms

Ambient live transit display for Apple TV, iPad, and iPhone.
**No backend server required** — fetches GTFS-RT feeds directly on-device.

---

## Architecture

```
MTA GTFS-RT feeds  ──┐
                      ├──▶  TransitAPIService (Swift)  ──▶  MapKit display
IDFM Paris feed    ──┘      decodes protobuf on-device       animated train dots
```

The app calls MTA and IDFM feeds directly. Protobuf is decoded on-device
using Apple's swift-protobuf library. No proxy, no backend, no ongoing costs.

---

## Project Structure

```
transitmap/
├── cloudflare-worker/          # Optional — not required for the app
│   └── ...                     # Keep if you later need a proxy for paid APIs
│
└── ios-app/TransitMap/
    ├── TransitMapApp.swift         # App entry point
    ├── Config/
    │   └── CityConfig.swift        # ← Add cities here
    ├── Models/
    │   └── TransitModels.swift     # Data models
    ├── Services/
    │   ├── TransitAPIService.swift # Direct feed fetching + protobuf decode
    │   └── TransitViewModel.swift  # State + ad timer
    ├── AdManager/
    │   └── AdManager.swift         # Google AdMob
    └── Views/
        ├── TransitMapView.swift    # Map display
        └── CitySelectorView.swift  # City picker
```

---

## Setup

### 1. Create Xcode project
- New Project → App (SwiftUI)
- Bundle ID: `com.yourname.transitmap`
- Add a tvOS target alongside iOS

### 2. Add Swift Protobuf (Apple's official library)
- File → Add Packages
- URL: `https://github.com/apple/swift-protobuf`
- Version: Up To Next Major from 1.0.0

### 3. Generate GTFS-RT Swift types
```bash
# Install protoc and the Swift plugin
brew install protobuf
brew install swift-protobuf

# Download the GTFS-RT proto definition
curl -O https://raw.githubusercontent.com/google/transit/master/gtfs-realtime/proto/gtfs-realtime.proto

# Generate Swift file — add GtfsRealtime.pb.swift to your Xcode target
protoc --swift_out=. gtfs-realtime.proto
```

### 4. Add Google Mobile Ads SDK
- File → Add Packages
- URL: `https://github.com/googleads/swift-package-manager-google-mobile-ads`
- Version: Up To Next Major from 11.0.0

### 5. Configure Info.plist (both iOS and tvOS targets)
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX</string>
```

### 6. Add your API keys to CityConfig.swift
```swift
// ios-app/TransitMap/Config/CityConfig.swift
FeedConfig(..., apiKey: "YOUR_MTA_API_KEY", ...)
// Free key: https://api.mta.info/#/signup

FeedConfig(..., apiKey: "YOUR_IDFM_API_KEY", ...)
// Free key: https://prim.iledefrance-mobilites.fr
```

### 7. Add your AdMob Ad Unit IDs to AdManager.swift
```swift
static let interstitial = "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
```

### 8. Build and run
```
iPhone/iPad  →  iOS target    →  Cmd+R
Apple TV     →  tvOS target   →  Cmd+R (select Apple TV simulator)
```

---

## Adding a New City

Edit `ios-app/TransitMap/Config/CityConfig.swift`:

```swift
static let london = City(
    id: "london", name: "London", country: "GB",
    center: Coordinate(lat: 51.5074, lng: -0.1278),
    defaultZoom: 12,
    feeds: [
        FeedConfig(id: "tfl", url: "https://api.tfl.gov.uk/...",
                   apiKey: "YOUR_TFL_KEY", apiKeyHeader: "app_key")
    ],
    lines: [ LineInfo(id: "central", name: "Central", color: "#E1251B"), ... ]
)

// Then add to the list:
static let all: [City] = [nyc, paris, london]
```

No deployment, no server update — just rebuild the app.

---

## Cities

| City | Feed | Status |
|---|---|---|
| New York City | MTA GTFS-RT (8 feeds) | ✅ Ready |
| Paris | IDFM / RATP GTFS-RT | ✅ Ready |
| London | TfL | 🔲 Template available |
| Tokyo | TOEI / Tokyo Metro | 🔲 Template available |

---

## Ad Timing

Edit `TransitModels.swift` to change ad frequency (requires App Store update):

```swift
struct AdConfig {
    var intervalSeconds: Int = 300  // ← 5 minutes, change here
    var enabled: Bool = true
}
```

---

## Track 2 (Next): Samsung + LG

React web app, same GTFS-RT feeds, Mapbox GL JS for maps.
Packaged with Tizen CLI (Samsung) and webOS SDK (LG).
