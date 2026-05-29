# TransitMap — LG webOS

## Quick start

### 1. Build the app
```bash
node build.js
# → generates index.html in this directory
# Use --watch to auto-rebuild when the prototype changes:
node build.js --watch
```

### 2. Package as .ipk
```bash
ares-package .
# → generates com.marcboyer.transitmap_1.0.0_all.ipk
```

### 3. Test on a real LG TV (Developer Mode)
```bash
# Enable Developer Mode on TV first (see below), then:
ares-setup-device                              # add your TV (enter IP when prompted)
ares-install --device <device-name> com.marcboyer.transitmap_1.0.0_all.ipk
ares-launch --device <device-name> com.marcboyer.transitmap
```

### 4. Test in the webOS TV Simulator
Install [webOS Studio](https://marketplace.visualstudio.com/items?itemName=webostvsdk.webostv) (VS Code extension):
- Command Palette → webOS: Launch Simulator
- Drag and drop the .ipk onto the simulator

## Enable Developer Mode on LG TV

1. Press **Home** on the remote
2. Navigate to **Settings (⚙)** → scroll to **Support** → **Software Info**
3. **Rapidly press OK 5 times** on "Software Info" — a Developer Mode dialog appears
4. Toggle **Developer Mode → On** and enter your Mac's IP address
5. Install the [LG Developer Mode app](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app) from the LG Content Store on the TV

## Remote control

| Button | Action |
|---|---|
| ◀ Left | Previous city |
| ▶ Right | Next city |
| OK / Enter | Select city |
| Back | Dismiss nav overlay / exit app |

## Prerequisites

```bash
npm install -g @webosose/ares-cli   # packaging + device tools (already installed)
```

## Updating the app

When `prototype/transitmap-prototype.html` is updated:
```bash
node build.js       # re-generate index.html
ares-package .      # re-package .ipk
```

## Publishing to LG Content Store

1. Create a developer account at https://seller.lgappstv.com
2. Replace the placeholder `icon.png` and `icon-large.png` with real artwork
   - `icon.png`: 80×80 px
   - `icon-large.png`: 130×130 px
3. Submit the `.ipk` through the LG Seller Lounge
