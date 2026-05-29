// TransitMap — TV Platform Abstraction Layer
// Provides a unified API across Samsung (Tizen), LG (webOS), Android TV, and Fire TV.
// The prototype checks Platform.type to enable TV mode when this file is loaded.

const Platform = (() => {
  // ── Platform detection ─────────────────────────────────────────────────────
  const type = (() => {
    if (typeof tizen !== 'undefined')  return 'tizen';   // Samsung
    if (typeof webOS !== 'undefined')  return 'webos';   // LG
    if (navigator.userAgent.includes('AFT') || window.amzn_wa) return 'firetv'; // Amazon Fire TV
    if (navigator.userAgent.includes('CrKey')) return 'chromecast';  // Chromecast / Vizio SmartCast
    return 'web'; // browser dev mode
  })();

  // ── Remote key codes ────────────────────────────────────────────────────────
  // Maps platform-specific keyCode values to abstract action names.
  const KEY_MAPS = {
    tizen:      { LEFT:37, RIGHT:39, UP:38, DOWN:40, ENTER:13, BACK:10009, PLAY_PAUSE:10252, RED:403, GREEN:404, YELLOW:405, BLUE:406 },
    webos:      { LEFT:37, RIGHT:39, UP:38, DOWN:40, ENTER:13, BACK:461,   PLAY_PAUSE:415 },
    firetv:     { LEFT:37, RIGHT:39, UP:38, DOWN:40, ENTER:13, BACK:27 },
    chromecast: { LEFT:37, RIGHT:39, UP:38, DOWN:40, ENTER:13, BACK:27 },
    web:        { LEFT:37, RIGHT:39, UP:38, DOWN:40, ENTER:13, BACK:27 },
  };

  const KEY = { ...(KEY_MAPS[type] ?? KEY_MAPS.web) };

  // Reverse map: keyCode → action name
  const _reverseKey = {};
  for (const [action, code] of Object.entries(KEY)) _reverseKey[code] = action;

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    if (type === 'tizen') {
      // Samsung requires explicit key registration for media/colour keys
      const keyNames = ['MediaPlayPause', 'MediaFastForward', 'MediaRewind',
                        'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'];
      keyNames.forEach(k => { try { tizen.tvinputdevice.registerKey(k); } catch (_) {} });
    }
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.documentElement.style.cursor = 'none';
  }

  // ── Remote key handler ──────────────────────────────────────────────────────
  // handler({ action: 'left'|'right'|'up'|'down'|'enter'|'back'|'play_pause'|... })
  function onRemoteKey(handler) {
    document.addEventListener('keydown', e => {
      const action = _reverseKey[e.keyCode];
      if (action) { e.preventDefault(); handler({ action, keyCode: e.keyCode }); }
    });
  }

  // ── Exit ───────────────────────────────────────────────────────────────────
  function exit() {
    if (type === 'tizen') tizen.application.getCurrentApplication().exit();
    else if (type === 'webos') window.close();
    else window.history.back();
  }

  // ── IAP ────────────────────────────────────────────────────────────────────
  // Each platform has its own purchase flow. The app calls Platform.purchase()
  // and handles success/failure. Swift bridge uses unlockPremium() directly.
  //
  // Samsung:     Tizen Checkout API (requires Samsung Partner account)
  // LG:          LG In-App Purchase API
  // Android TV:  Google Play Billing (via Java → JS bridge)
  // Fire TV:     Amazon Appstore In-App Purchasing API
  // Web (dev):   auto-succeeds for testing

  function purchase(productId, onSuccess, onFail) {
    switch (type) {
      case 'tizen':
        // Samsung Checkout — requires app registered in Samsung Seller Office
        // Replace with real Samsung IAP SDK call when account is set up
        console.warn('[Platform/tizen] IAP not yet wired — productId:', productId);
        onFail('not_implemented');
        break;

      case 'webos':
        // LG In-App Purchase SDK
        console.warn('[Platform/webos] IAP not yet wired — productId:', productId);
        onFail('not_implemented');
        break;

      case 'firetv':
        // Amazon IAP — implemented via amzn_wa.IAP bridge
        console.warn('[Platform/firetv] IAP not yet wired — productId:', productId);
        onFail('not_implemented');
        break;

      case 'web':
        // Dev mode: simulate a successful purchase so we can test the unlock flow
        console.log('[Platform/web] Dev mode — auto-approving purchase:', productId);
        setTimeout(onSuccess, 500);
        break;

      default:
        onFail('unsupported_platform');
    }
  }

  function restorePurchases(onSuccess, onFail) {
    // For Samsung/LG, this re-queries the purchase receipt from the platform store.
    // For now, falls through to the same not_implemented stub.
    purchase('__restore__', onSuccess, onFail);
  }

  // ── Capabilities ────────────────────────────────────────────────────────────
  // True when running inside a real TV app (not a browser dev session)
  const isTV = type !== 'web';

  return { type, KEY, isTV, init, onRemoteKey, exit, purchase, restorePurchases };
})();
