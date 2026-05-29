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
const OUT       = path.join(__dirname, 'index.html');

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
  /* Hide elements that don't work on TV */
  #departures-panel { display: none !important; }
  /* Theme button is pointless on TV (always dark) */
  .theme-btn { display: none !important; }
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
`;
  html = html.replace(/(<\/script>)(\s*<\/body>)/, tvInit + '$1$2');

  // 4. Inject TV nav HTML before </body>
  html = html.replace('</body>', TV_HTML + '\n</body>');

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`[${new Date().toLocaleTimeString()}] Built → platforms/lg-webos/index.html`);
  console.log(`  Size: ${(html.length / 1024).toFixed(1)} KB`);
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
