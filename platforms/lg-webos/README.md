# TransitMap — LG webOS

## Status: stub (not yet built)

## Overview
LG TVs run webOS, which — like Samsung Tizen — is a web app platform.
The architecture is nearly identical to Samsung:
- Same `platforms/shared/platform.js` (already handles `type === 'webos'`)
- Same `build.js` approach (add an `--platform=lg` flag when we build it)
- Same `tv-nav.js` D-pad navigation code
- Different packaging: `.ipk` file instead of `.wgt`

## Key differences from Samsung

| | Samsung (Tizen) | LG (webOS) |
|---|---|---|
| Manifest | `config.xml` | `appinfo.json` ✓ (already created) |
| Package format | `.wgt` | `.ipk` |
| IDE | Tizen Studio | webOS Studio (VS Code extension) |
| Back key code | 10009 | 461 ✓ (already in platform.js) |
| IAP | Samsung Checkout | LG In-App Purchase API |

## When ready to build
1. Copy the Samsung `build.js` and adapt for webOS (different CSS insets if needed)
2. Install [webOS Studio](https://webostv.developer.lge.com/develop/tools/webos-studio-introduction)
3. Use `ares-package` CLI to generate the `.ipk`
4. Sideload onto an LG TV via Developer Mode
