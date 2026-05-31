#!/usr/bin/env node
// TransitMap — LG webOS build script
//
// Usage:
//   node build.js            → generates index.html in this directory
//   node build.js --watch    → regenerates on prototype change
//
// After building, run:
//   ares-package .           → generates com.marcboyer.transitmap_1.0.0_all.ipk
//   ares-setup-device        → add your LG TV
//   ares-install --device <TV-NAME> com.marcboyer.transitmap_1.0.0_all.ipk

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const PROTO     = path.join(ROOT, 'prototype/transitmap-prototype.html');
const PLATFORM  = path.join(ROOT, 'platforms/shared/platform.js');
const TV_NAV    = path.join(ROOT, 'platforms/samsung/tv-nav.js'); // shared with Samsung
const WORKER    = path.join(ROOT, 'cloudflare-worker/index.js');
const OUT       = path.join(__dirname, 'index.html');

// Read worker version from the worker source so the stamp is always in sync
function readWorkerVersion() {
  try {
    const src = fs.readFileSync(WORKER, 'utf8');
    const m = src.match(/WORKER_VERSION\s*=\s*'([^']+)'/);
    return m ? m[1] : 'unknown';
  } catch { return 'unknown'; }
}

// ── TV CSS — injected just before </style> ────────────────────────────────────
const TV_CSS = `
  /* ── LG webOS overrides ── */
  * { cursor: none !important; }
  /* Safe zone: keep all UI within the inner 90% of the screen */
  .topbar  { padding: 60px 80px 24px; }
  .legend  { padding: 28px 80px 60px; }
  .city-switcher { top: 60px; }
  .train-count { right: 80px; bottom: 130px; }
  /* Larger text for 10-foot viewing */
  .city-name { font-size: 38px; }
  .city-sub  { font-size: 14px; letter-spacing: 3px; }
  .status-pill { font-size: 14px; padding: 10px 20px; }
  .line-chip { font-size: 14px; padding: 6px 14px 6px 8px; }
  .line-dot  { width: 13px; height: 13px; }
  /* Version stamps — readable at 10-foot viewing distance */
  .version-stamp { font-size: 13px; }
  /* Hide elements that don't work on TV */
  #departures-panel { display: none !important; }
  /* Theme button — sized for 10-foot viewing, clickable via Magic Remote */
  .theme-btn { font-size: 16px; padding: 10px 20px; }
  /* City switcher — keep visible: LG Magic Remote works as a pointer */
  .city-switcher { top: 60px; }
  /* Fetch log — keep visible, repositioned into safe zone */
  #fetch-log { top: 100px; right: 80px; font-size: 12px; max-width: 380px; }
  #fetch-log .fl-hdr { font-size: 11px; }
  #fetch-log .fl-stat-name { font-size: 11px; }
  #fetch-log .fl-stat-nums { font-size: 13px; }
  /* TV city nav overlay */
  #tvNav {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 60px 80px;
    background: linear-gradient(transparent 0%, rgba(4,8,18,0.96) 50%);
    z-index: 600; display: none;
    flex-direction: column; gap: 20px;
  }
  #tvNav.visible { display: flex; }
  #tvNavHint {
    font-size: 13px; color: rgba(255,255,255,0.4);
    letter-spacing: 2px; text-transform: uppercase;
    text-align: center;
  }
  #tvNavCities {
    display: flex; gap: 16px; justify-content: center; align-items: center;
    flex-wrap: nowrap; overflow: hidden;
  }
  .tv-city-btn {
    font-family: 'DM Mono', monospace;
    font-size: 18px;
    padding: 14px 28px;
    border-radius: 28px;
    border: 2px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.6);
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tv-city-btn.active {
    background: rgba(255,255,255,0.18);
    border-color: rgba(255,255,255,0.7);
    color: #fff;
    transform: scale(1.08);
  }
  .tv-city-btn.current {
    border-color: rgba(255,255,255,0.35);
    color: rgba(255,255,255,0.85);
  }
`;

// ── TV NAV HTML — injected before </body> ─────────────────────────────────────
const TV_HTML = `
<div id="tvNav">
  <div id="tvNavHint">◀  ▶  to browse  ·  OK to select  ·  BACK to dismiss</div>
  <div id="tvNavCities"></div>
</div>
`;

function build() {
  if (!fs.existsSync(PROTO)) {
    console.error('Prototype not found at:', PROTO);
    process.exit(1);
  }

  const workerVersion = readWorkerVersion();
  const buildTime     = new Date().toISOString();

  let html = fs.readFileSync(PROTO, 'utf8');
  const platformJs = fs.readFileSync(PLATFORM, 'utf8');
  const tvNavJs    = fs.existsSync(TV_NAV) ? fs.readFileSync(TV_NAV, 'utf8') : '';

  // 1. Inject TV CSS before closing </style>
  html = html.replace('</style>', TV_CSS + '\n</style>');

  // 2. Inline platform.js + tv-nav.js before </head>
  const inlineScripts = [
    `<script>\n// platform.js (inlined by build.js)\n${platformJs}\n</script>`,
    tvNavJs ? `<script>\n// tv-nav.js (inlined by build.js)\n${tvNavJs}\n</script>` : '',
  ].filter(Boolean).join('\n');
  html = html.replace('</head>', inlineScripts + '\n</head>');

  // 3. Append TV init into the prototype <script> block before it closes
  const tvInit = `
// ── TV Platform Init (injected by build.js) ──────────────────────────────────
if (typeof Platform !== 'undefined') {
  Platform.init();
  if (typeof initTVNav === 'function') initTVNav();
}

// ── Pre-populate worker stamp so version is visible before first fetch ────────
(function() {
  const ws = document.getElementById('workerStamp');
  if (ws) ws.textContent = '${workerVersion} · built ${buildTime.slice(0,10)}';
})();

// ── LG webOS: prevent screensaver via hidden canvas video stream ──────────────
// The OS suppresses idle timeouts when a video element is actively playing.
// We stream a 2×2 canvas into a hidden <video> — the OS sees live video,
// never idles. Canvas alternates colour each second so the stream is never
// a frozen static frame (some firmware detects and discounts frozen streams).
// opacity:0.01 rather than 0 — some webOS builds skip the idle-reset for
// invisible (opacity=0) video elements.
(function() {
  try {
    var canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    var ctx = canvas.getContext('2d');
    var n = 0;

    var vid = document.createElement('video');
    vid.muted = true;
    vid.loop = true;
    vid.setAttribute('playsinline', '');
    vid.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;' +
                        'opacity:0.01;pointer-events:none;z-index:-9999';

    if (typeof canvas.captureStream === 'function') {
      vid.srcObject = canvas.captureStream(1); // 1 fps is enough
      document.body.appendChild(vid);
      vid.play().catch(function() {});
    }

    setInterval(function() {
      ctx.fillStyle = (n++ & 1) ? '#010101' : '#020202';
      ctx.fillRect(0, 0, 2, 2);
    }, 1000);
  } catch(e) {}
})();
`;
  html = html.replace(/(<\/script>)(\s*<\/body>)/, tvInit + '$1$2');

  // 4. Inject TV nav HTML before </body>
  html = html.replace('</body>', TV_HTML + '\n</body>');

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`[${new Date().toLocaleTimeString()}] Built → platforms/lg-webos/index.html`);
  console.log(`  Worker: ${workerVersion}  Size: ${(html.length / 1024).toFixed(1)} KB`);
}

build();

// ── Watch mode ─────────────────────────────────────────────────────────────────
if (process.argv.includes('--watch')) {
  console.log('Watching for prototype changes...');
  let debounce = null;
  fs.watch(PROTO, () => {
    clearTimeout(debounce);
    debounce = setTimeout(build, 200);
  });
}
