# TransitMap — Samsung TV (Tizen Web App)

## Quick start

### 1. Build the TV app
```bash
node build.js
# → generates index.html in this directory
# Use --watch to auto-rebuild when the prototype changes:
node build.js --watch
```

### 2. Test in Tizen Studio
1. Install [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html) (includes the TV emulator)
2. Open Tizen Studio → File → Import → Tizen → Tizen Project
3. Select `platforms/samsung/` as the project directory
4. Right-click the project → Run As → Tizen Web Simulator

### 3. Test on a real Samsung TV
1. Enable Developer Mode on the TV: Settings → Smart Hub → open IP dialog
2. In Tizen Studio: Tools → Device Manager → add your TV's IP
3. Right-click project → Run As → Tizen Web Application (your TV)

### 4. Package for Samsung App Store
1. Replace `0000000000` in `config.xml` with your Seller Office package ID
2. Create a distribution certificate in Tizen Studio (Certificate Manager)
3. Right-click project → Build Signed Package → generates `.wgt` file
4. Upload to [Samsung Sellers Office](https://seller.samsungapps.com)

## What build.js does

Reads `prototype/transitmap-prototype.html` (the source of truth) and:
- Inlines `platforms/shared/platform.js` (TV input/IAP abstraction)
- Inlines `tv-nav.js` (D-pad city navigation)
- Adds TV-safe-zone CSS (80px insets, larger fonts)
- Hides dev UI (fetch log, theme toggle)
- Replaces the click-based city switcher with a D-pad overlay

## Remote control mapping

| Button | Action |
|---|---|
| ◀ Left | Previous city |
| ▶ Right | Next city |
| OK / Enter | Select city |
| Back | Dismiss nav overlay / exit app |

## Adding IAP for Samsung Store

Edit `platforms/shared/platform.js` → `purchase()` case `'tizen'`:
Replace the stub with the [Samsung Checkout SDK](https://developer.samsung.com/smarttv/develop/guides/samsung-checkout/overview.html) call.

## Updating the app

When the prototype is updated (`prototype/transitmap-prototype.html`):
```bash
node build.js   # re-generates index.html with latest data + logic
```
The `index.html` file is gitignored — it's always generated from the prototype.
