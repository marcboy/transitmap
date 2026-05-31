#!/usr/bin/env node
// Generate static dark map background images for each city.
// Uses the same CartoDB dark tile set as the web prototype.
//
// Usage:
//   npm install        ← first time only
//   node gen_maps.js   ← writes images/map_*.jpg + prints bounds for MapScene.brs
//
// After running, copy the printed bounds into MapScene.brs if they differ.
// Commit the images to git (or keep them local — they're ~300 KB each).

const StaticMaps = require('staticmaps');
const path = require('path');
const fs   = require('fs');

const W    = 1920;
const H    = 1080;
const OUT  = path.join(__dirname, 'images');
const TILE = 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png';

const CITIES = [
  { id: 'nyc',      center: [-74.006,  40.713], zoom: 12 },
  { id: 'paris',    center: [  2.347,  48.860], zoom: 12 },
  { id: 'helsinki', center: [ 24.940,  60.170], zoom: 12 },
  { id: 'sydney',   center: [151.210, -33.870], zoom: 12 },
  { id: 'tokyo',    center: [139.720,  35.690], zoom: 12 },
  { id: 'seattle',  center: [-122.330, 47.610], zoom: 12 },
];

// Compute the geographic bounding box of the rendered image.
// staticmaps centres the map at `center` at the given zoom level.
function computeBounds(center, zoom) {
  const [lon, lat] = center;
  const z2 = Math.pow(2, zoom);

  // Centre tile coordinates (fractional)
  const tileX = (lon + 180) / 360 * z2;
  const latRad = lat * Math.PI / 180;
  const tileY  = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * z2;

  const halfTX = W / 256 / 2;   // tiles that fit on each side horizontally
  const halfTY = H / 256 / 2;   // tiles that fit on each side vertically

  function tileToLon(x) {
    return x / z2 * 360 - 180;
  }
  function tileToLat(y) {
    const n = Math.PI - 2 * Math.PI * y / z2;
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  return {
    minLon: tileToLon(tileX - halfTX),
    maxLon: tileToLon(tileX + halfTX),
    maxLat: tileToLat(tileY - halfTY),
    minLat: tileToLat(tileY + halfTY),
  };
}

async function generate(city) {
  const map = new StaticMaps({ width: W, height: H, tileUrl: TILE, tileSize: 256 });
  await map.render(city.center, city.zoom);
  const out = path.join(OUT, `map_${city.id}.jpg`);
  await map.image.save(out, { quality: 85 });

  const b = computeBounds(city.center, city.zoom);
  return { id: city.id, bounds: b };
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  console.log('Generating city maps…\n');

  const results = [];
  for (const city of CITIES) {
    process.stdout.write(`  ${city.id}…`);
    const r = await generate(city);
    results.push(r);
    console.log(` done`);
  }

  console.log('\nBounds for MapScene.brs (paste these in if you change zoom/center):');
  for (const r of results) {
    const b = r.bounds;
    console.log(`  ' ${r.id}`);
    console.log(`  bounds: {minLon: ${b.minLon.toFixed(3)}, maxLon: ${b.maxLon.toFixed(3)}, minLat: ${b.minLat.toFixed(3)}, maxLat: ${b.maxLat.toFixed(3)}}`);
  }
  console.log('\nDone. Run "awk" to package the Roku channel (see README.md).');
})();
