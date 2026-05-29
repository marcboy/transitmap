# TransitMap — Android TV (+ Vizio SmartCast)

## Status: stub (not yet built)

## Overview
Android TV / Google TV apps are standard Android apps, but the approach for
a web-first app like TransitMap is a **WebView wrapper**:
- A minimal Android project with a single Activity
- The Activity shows a full-screen `WebView` that loads `index.html` from assets
- The same `build.js` approach generates the HTML (add `--platform=android`)
- `platforms/shared/platform.js` handles `type === 'android'` detection
  (detection via `navigator.userAgent` — Android TV WebView includes `'CrKey'` or can be custom)

## Why this covers Vizio too
Vizio SmartCast TVs (2016+) run Android TV under the hood — a Vizio app is just
an Android TV app submitted to the Vizio Developer Program.

## Key differences from Samsung/LG
- No dedicated TV IDE — use Android Studio
- IAP via Google Play Billing Library (Java/Kotlin, bridged to JS via `JavascriptInterface`)
- Leanback UI library for standard TV navigation patterns (optional for WebView apps)
- D-key events use standard Android keycodes (same as `platform.js` maps them)

## When ready to build
1. Create an Android project in Android Studio
2. Add `WebView` that loads assets from `platforms/android-tv/app/src/main/assets/`
3. The `build.js` output gets copied to that assets directory
4. Bridge Java IAP callback → `webView.evaluateJavascript("unlockPremium()")`
5. Sign with Google Play signing key and submit to Android TV section of Google Play
