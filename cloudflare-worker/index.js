/**
 * TransitMap Cloudflare Worker — optimized for free tier
 * Fetches MTA GTFS-RT feeds, decodes protobuf, returns JSON.
 * No API key required (MTA feeds are open as of 2025).
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// MTA feed URLs — fetch all 8 concurrently
const MTA_FEEDS = [
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',
];

const LINE_COLORS = {
  '1':'#EE352E','2':'#EE352E','3':'#EE352E',
  '4':'#00933C','5':'#00933C','6':'#00933C','6X':'#00933C',
  '7':'#B933AD','7X':'#B933AD',
  'A':'#2850AD','C':'#2850AD','E':'#2850AD',
  'B':'#FF6319','D':'#FF6319','F':'#FF6319','FX':'#FF6319','M':'#FF6319',
  'G':'#6CBE45',
  'J':'#996633','Z':'#996633',
  'L':'#A7A9AC',
  'N':'#FCCC0A','Q':'#FCCC0A','R':'#FCCC0A','W':'#FCCC0A',
  'S':'#808183','GS':'#808183','FS':'#808183','SI':'#808183',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const path = new URL(request.url).pathname;

    // Health — instant, no feed fetching
    if (path === '/health') {
      return json({ status: 'ok', ts: new Date().toISOString() });
    }

    if (path === '/trains/nyc') {
      try {
        const trains = await fetchAllMTATrains(ctx);
        return json({
          city: 'nyc',
          count: trains.length,
          updatedAt: new Date().toISOString(),
          trains,
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    return json({ error: 'Not found. Try /trains/nyc or /health' }, 404);
  }
};

// ── Fetch all MTA feeds concurrently with a timeout ───────────

async function fetchAllMTATrains(ctx) {
  // Race each feed against a 8-second timeout
  const results = await Promise.allSettled(
    MTA_FEEDS.map(url => withTimeout(fetchFeed(url), 8000))
  );

  const trains = [];
  const now    = Math.floor(Date.now() / 1000);

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const entity of result.value) {
      if (!entity.vehicle?.position) continue;
      const v       = entity.vehicle;
      const routeId = v.trip?.routeId ?? '';
      const stale   = now - (v.timestamp ?? now);
      if (stale > 180) continue;

      trains.push({
        id:      entity.id,
        line:    routeId,
        color:   LINE_COLORS[routeId] ?? '#888888',
        lat:     Math.round(v.position.latitude  * 100000) / 100000,
        lng:     Math.round(v.position.longitude * 100000) / 100000,
        bearing: v.position.bearing ? Math.round(v.position.bearing) : null,
        status:  ['INCOMING','AT_STOP','IN_TRANSIT'][v.currentStatus] ?? 'IN_TRANSIT',
        stale,
      });
    }
  }

  return trains;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function fetchFeed(url) {
  const resp = await fetch(url, {
    cf: { cacheTtl: 20, cacheEverything: true },
  });
  if (!resp.ok) throw new Error(`${resp.status}`);
  const buf = await resp.arrayBuffer();
  return decodeFeed(new Uint8Array(buf));
}

// ── Minimal GTFS-RT protobuf decoder ─────────────────────────

function decodeFeed(bytes) {
  const r = new PB(bytes), entities = [];
  while (r.ok()) {
    const { f, w } = r.tag();
    if (f === 2 && w === 2) entities.push(decodeEntity(r.bytes()));
    else r.skip(w);
  }
  return entities;
}

function decodeEntity(bytes) {
  const r = new PB(bytes), e = { id:'', vehicle:null };
  while (r.ok()) {
    const { f, w } = r.tag();
    if      (f===1&&w===2) e.id      = r.str();
    else if (f===4&&w===2) e.vehicle = decodeVehicle(r.bytes());
    else r.skip(w);
  }
  return e;
}

function decodeVehicle(bytes) {
  const r = new PB(bytes);
  const v = { trip:{routeId:'',tripId:null}, position:null, currentStatus:2, timestamp:0 };
  while (r.ok()) {
    const { f, w } = r.tag();
    if      (f===1&&w===2) v.trip          = decodeTrip(r.bytes());
    else if (f===2&&w===2) v.position      = decodePosition(r.bytes());
    else if (f===4&&w===0) v.currentStatus = r.varint();
    else if (f===5&&w===0) v.timestamp     = r.varint();
    else r.skip(w);
  }
  return v;
}

function decodeTrip(bytes) {
  const r = new PB(bytes), t = { tripId:null, routeId:'' };
  while (r.ok()) {
    const { f, w } = r.tag();
    if      (f===1&&w===2) t.tripId  = r.str();
    else if (f===3&&w===2) t.routeId = r.str();
    else r.skip(w);
  }
  return t;
}

function decodePosition(bytes) {
  const r = new PB(bytes), p = { latitude:0, longitude:0, bearing:null };
  while (r.ok()) {
    const { f, w } = r.tag();
    if      (f===1&&w===5) p.latitude  = r.float();
    else if (f===2&&w===5) p.longitude = r.float();
    else if (f===3&&w===5) p.bearing   = r.float();
    else r.skip(w);
  }
  return p;
}

class PB {
  constructor(b) { this.b=b; this.p=0; }
  ok()  { return this.p < this.b.length; }
  tag() { const v=this.varint(); return {f:v>>>3, w:v&7}; }
  varint() {
    let r=0,s=0;
    while(true){ const b=this.b[this.p++]; r|=(b&0x7f)<<s; s+=7; if(!(b&0x80))break; }
    return r>>>0;
  }
  bytes() { const l=this.varint(),s=this.b.slice(this.p,this.p+l); this.p+=l; return s; }
  str()   { return new TextDecoder().decode(this.bytes()); }
  float() { const v=new DataView(this.b.buffer,this.b.byteOffset+this.p,4).getFloat32(0,true); this.p+=4; return v; }
  skip(w) {
    if(w===0)this.varint();
    else if(w===1)this.p+=8;
    else if(w===2){const l=this.varint();this.p+=l;}
    else if(w===5)this.p+=4;
  }
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type':'application/json', ...CORS },
  });
}
