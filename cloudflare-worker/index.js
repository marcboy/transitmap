/**
 * TransitMap Cloudflare Worker
 * Fetches MTA GTFS-RT feeds (no API key required as of 2025),
 * decodes protobuf, returns clean JSON.
 * Deploy: wrangler deploy
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// MTA feed URLs — no API key required
const MTA_FEEDS = [
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',        // 1 2 3 4 5 6 7
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',    // A C E
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',   // B D F M
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',      // G
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',     // J Z
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',   // N Q R W
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',      // L
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',     // S (Staten Island)
];

// Official MTA line colors
const LINE_COLORS = {
  '1':'#EE352E','2':'#EE352E','3':'#EE352E',
  '4':'#00933C','5':'#00933C','6':'#00933C',
  '7':'#B933AD',
  'A':'#2850AD','C':'#2850AD','E':'#2850AD',
  'B':'#FF6319','D':'#FF6319','F':'#FF6319','M':'#FF6319',
  'G':'#6CBE45',
  'J':'#996633','Z':'#996633',
  'L':'#A7A9AC',
  'N':'#FCCC0A','Q':'#FCCC0A','R':'#FCCC0A','W':'#FCCC0A',
  'S':'#808183',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const path = new URL(request.url).pathname;

    if (path === '/health') {
      return json({ status: 'ok', ts: new Date().toISOString() });
    }

    if (path === '/trains/nyc') {
      try {
        const trains = await fetchAllMTATrains();
        return json({ city: 'nyc', count: trains.length, updatedAt: new Date().toISOString(), trains });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    return json({ error: 'Not found. Try /trains/nyc or /health' }, 404);
  }
};

// ── Fetch all 8 MTA feeds concurrently ───────────────────────

async function fetchAllMTATrains() {
  const results = await Promise.allSettled(
    MTA_FEEDS.map(url => fetchFeed(url))
  );

  const trains = [];
  const now    = Math.floor(Date.now() / 1000);

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const entity of result.value) {
      if (!entity.vehicle?.position) continue;

      const v       = entity.vehicle;
      const routeId = v.trip?.routeId ?? '';
      const color   = LINE_COLORS[routeId] ?? '#888888';
      const stale   = now - (v.timestamp ?? now);
      if (stale > 180) continue;   // skip positions older than 3 minutes

      trains.push({
        id:      entity.id,
        line:    routeId,
        color,
        lat:     v.position.latitude,
        lng:     v.position.longitude,
        bearing: v.position.bearing  ?? null,
        status:  ['INCOMING','AT_STOP','IN_TRANSIT'][v.currentStatus] ?? 'IN_TRANSIT',
        trip:    v.trip?.tripId ?? null,
        stale,
      });
    }
  }

  return trains;
}

async function fetchFeed(url) {
  const resp = await fetch(url, {
    cf: { cacheTtl: 20 },
  });
  if (!resp.ok) throw new Error(`Feed ${url} → ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return decodeFeedMessage(new Uint8Array(buf));
}

// ── Minimal GTFS-RT protobuf decoder ─────────────────────────
// Decodes only the fields we need: entity, vehicle, position, trip

function decodeFeedMessage(bytes) {
  const r = new PB(bytes);
  const entities = [];
  while (r.ok()) {
    const { f, w } = r.tag();
    if (f === 2 && w === 2) entities.push(decodeEntity(r.bytes()));
    else r.skip(w);
  }
  return entities;
}

function decodeEntity(bytes) {
  const r = new PB(bytes);
  const e = { id: '', vehicle: null };
  while (r.ok()) {
    const { f, w } = r.tag();
    if      (f === 1 && w === 2) e.id      = r.str();
    else if (f === 4 && w === 2) e.vehicle = decodeVehicle(r.bytes());
    else r.skip(w);
  }
  return e;
}

function decodeVehicle(bytes) {
  const r = new PB(bytes);
  const v = { trip: {}, position: null, currentStatus: 2, timestamp: 0, stopId: null };
  while (r.ok()) {
    const { f, w } = r.tag();
    if      (f === 1 && w === 2) v.trip          = decodeTrip(r.bytes());
    else if (f === 2 && w === 2) v.position      = decodePosition(r.bytes());
    else if (f === 4 && w === 0) v.currentStatus = r.varint();
    else if (f === 5 && w === 0) v.timestamp     = r.varint();
    else if (f === 7 && w === 2) v.stopId        = r.str();
    else r.skip(w);
  }
  return v;
}

function decodeTrip(bytes) {
  const r = new PB(bytes);
  const t = { tripId: null, routeId: '' };
  while (r.ok()) {
    const { f, w } = r.tag();
    if      (f === 1 && w === 2) t.tripId  = r.str();
    else if (f === 3 && w === 2) t.routeId = r.str();
    else r.skip(w);
  }
  return t;
}

function decodePosition(bytes) {
  const r = new PB(bytes);
  const p = { latitude: 0, longitude: 0, bearing: null, speed: null };
  while (r.ok()) {
    const { f, w } = r.tag();
    if      (f === 1 && w === 5) p.latitude  = r.float();
    else if (f === 2 && w === 5) p.longitude = r.float();
    else if (f === 3 && w === 5) p.bearing   = r.float();
    else if (f === 5 && w === 5) p.speed     = r.float();
    else r.skip(w);
  }
  return p;
}

// Minimal protobuf reader
class PB {
  constructor(b) { this.b = b; this.p = 0; }
  ok()  { return this.p < this.b.length; }
  tag() { const v = this.varint(); return { f: v >>> 3, w: v & 7 }; }
  varint() {
    let r = 0, s = 0;
    while (true) {
      const b = this.b[this.p++];
      r |= (b & 0x7f) << s; s += 7;
      if (!(b & 0x80)) break;
    }
    return r >>> 0;
  }
  bytes() {
    const len = this.varint();
    const sl  = this.b.slice(this.p, this.p + len);
    this.p   += len;
    return sl;
  }
  str()   { return new TextDecoder().decode(this.bytes()); }
  float() {
    const v = new DataView(this.b.buffer, this.b.byteOffset + this.p, 4).getFloat32(0, true);
    this.p += 4; return v;
  }
  skip(w) {
    if      (w === 0) this.varint();
    else if (w === 1) this.p += 8;
    else if (w === 2) { const l = this.varint(); this.p += l; }
    else if (w === 5) this.p += 4;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
