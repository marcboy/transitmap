# TransitMap — Apple TV (tvOS)

## Status: in progress (SwiftUI app)

## Overview
The Apple TV app is a native tvOS SwiftUI app — not a web wrapper.
It uses the same Cloudflare Worker API as all other platforms.

## IAP integration point
After a successful StoreKit purchase or restore:
```swift
webView.evaluateJavaScript("unlockPremium()")
```
This mirrors the `unlockPremium()` function already in the prototype.

## Platform.js
`platforms/shared/platform.js` is **not used** by the Apple TV app —
all platform logic is handled natively in Swift/SwiftUI.
The `Platform.type === 'tizen'` detection is irrelevant here.

## Remote control (Siri Remote)
- Swipe left/right on the touch surface → city navigation (handled in SwiftUI)
- Menu button → back / exit
- Play/Pause → pause animation (optional)
- No D-pad nav overlay needed — SwiftUI handles focus engine natively

## Resources
- [Apple TV Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/apple-tv)
- [TVML/TVMLKit](https://developer.apple.com/documentation/tvml) — alternative to pure SwiftUI
- [StoreKit 2 IAP](https://developer.apple.com/documentation/storekit)
