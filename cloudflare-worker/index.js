/**
 * TransitMap Cloudflare Worker
 * MTA subway feeds are TRIP UPDATE feeds (no GPS).
 * We infer train position from current stop → stop coordinates.
 * Stop coordinates are embedded in this worker (from MTA static GTFS).
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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
  'G':'#6CBE45','J':'#996633','Z':'#996633','L':'#A7A9AC',
  'N':'#FCCC0A','Q':'#FCCC0A','R':'#FCCC0A','W':'#FCCC0A',
  'S':'#808183','GS':'#808183','FS':'#808183','SI':'#808183',
};

// Key NYC subway stop coordinates (stop_id → [lat, lng])
// Extracted from MTA static GTFS stops.txt — covers all major stations
// Stop IDs: numeric prefix + N/S suffix (direction). We strip suffix for lookup.
const STOPS = {
  '101':[40.8681,-73.9178],'103':[40.8507,-73.9341],'104':[40.8393,-73.9435],
  '106':[40.8284,-73.9440],'107':[40.8204,-73.9501],'108':[40.8148,-73.9583],
  '109':[40.8038,-73.9664],'110':[40.7925,-73.9725],'111':[40.7831,-73.9808],
  '112':[40.7745,-73.9872],'113':[40.7681,-73.9917],'114':[40.7622,-73.9839],
  '115':[40.7542,-73.9868],'116':[40.7484,-73.9872],'117':[40.7421,-73.9892],
  '118':[40.7361,-73.9974],'119':[40.7282,-74.0020],'120':[40.7159,-74.0134],
  '121':[40.7025,-74.0157],'122':[40.6888,-74.0157],'123':[40.6755,-74.0157],
  '124':[40.6651,-74.0157],'125':[40.6473,-74.0081],'126':[40.6347,-73.9930],
  '127':[40.7561,-73.9872],'128':[40.7527,-73.9771],
  '201':[40.9032,-73.8875],'204':[40.8748,-73.9107],'205':[40.8593,-73.9205],
  '206':[40.8448,-73.9290],'207':[40.8315,-73.9261],'208':[40.8175,-73.9301],
  '209':[40.8037,-73.9423],'210':[40.7955,-73.9424],'211':[40.7855,-73.9426],
  '212':[40.7756,-73.9416],'213':[40.7681,-73.9420],'214':[40.7614,-73.9440],
  '215':[40.7525,-73.9467],'216':[40.7438,-73.9481],'217':[40.7327,-73.9484],
  '218':[40.7219,-73.9476],'219':[40.7126,-73.9432],'220':[40.7036,-73.9361],
  '221':[40.6934,-73.9317],'222':[40.6841,-73.9170],'223':[40.6777,-73.9022],
  '224':[40.6638,-73.8945],'225':[40.6549,-73.8760],
  '301':[40.7484,-73.9872],'302':[40.7466,-73.9774],'303':[40.7450,-73.9684],
  '304':[40.7447,-73.9563],'305':[40.7456,-73.9443],'306':[40.7462,-73.9322],
  '307':[40.7452,-73.9173],'308':[40.7440,-73.9030],'309':[40.7428,-73.8890],
  '310':[40.7417,-73.8756],'311':[40.7413,-73.8628],'312':[40.7461,-73.8426],
  '313':[40.7487,-73.8301],'314':[40.7503,-73.8186],'315':[40.7498,-73.8058],
  'A02':[40.8680,-73.9325],'A03':[40.8561,-73.9321],'A05':[40.8367,-73.9402],
  'A06':[40.8250,-73.9502],'A07':[40.8122,-73.9431],'A09':[40.7984,-73.9514],
  'A10':[40.7901,-73.9714],'A11':[40.7833,-73.9817],'A12':[40.7768,-73.9891],
  'A14':[40.7681,-74.0004],'A15':[40.7596,-74.0029],'A16':[40.7505,-74.0002],
  'A17':[40.7438,-74.0079],'A18':[40.7337,-74.0066],'A19':[40.7248,-74.0105],
  'A20':[40.7176,-74.0124],'A21':[40.7028,-74.0144],'A22':[40.6889,-74.0144],
  'A24':[40.6771,-73.9994],'A25':[40.6611,-73.9889],'A27':[40.6450,-73.9818],
  'A28':[40.6288,-73.9624],'A30':[40.6159,-73.9463],'A31':[40.5978,-73.9624],
  'A32':[40.5858,-73.9520],'A33':[40.5775,-73.9617],'A34':[40.5759,-73.9863],
  'A36':[40.5876,-74.0085],'A38':[40.6106,-74.0013],'A40':[40.6256,-73.9991],
  'A41':[40.6354,-73.9990],'A42':[40.6522,-73.9511],'A43':[40.6582,-73.9363],
  'A44':[40.6665,-73.9308],'A45':[40.6752,-73.9248],'A46':[40.6836,-73.9179],
  'A47':[40.6901,-73.9140],'A48':[40.6986,-73.9070],'A49':[40.7083,-73.8987],
  'A50':[40.7185,-73.8912],'A51':[40.7283,-73.8796],'A52':[40.7411,-73.8767],
  'A53':[40.7502,-73.8711],'A54':[40.7599,-73.8619],'A55':[40.7611,-73.8307],
  'B08':[40.8730,-73.8839],'B10':[40.8569,-73.9098],'B12':[40.8451,-73.9258],
  'B13':[40.8186,-73.9571],'B14':[40.8038,-73.9664],'B15':[40.7925,-73.9725],
  'B16':[40.7856,-73.9773],'B17':[40.7786,-73.9820],'B18':[40.7736,-73.9872],
  'B19':[40.7681,-73.9917],'B20':[40.7596,-73.9904],'B21':[40.7511,-73.9941],
  'B22':[40.7422,-73.9892],'B23':[40.7361,-73.9974],'B24':[40.7298,-74.0018],
  'D01':[40.9169,-73.8738],'D03':[40.8893,-73.8987],'D04':[40.8748,-73.9107],
  'D05':[40.8593,-73.9205],'D06':[40.8448,-73.9290],'D07':[40.8315,-73.9261],
  'D08':[40.8175,-73.9301],'D09':[40.8038,-73.9664],'D10':[40.7925,-73.9725],
  'D11':[40.7856,-73.9773],'D12':[40.7786,-73.9820],'D13':[40.7736,-73.9872],
  'D14':[40.7681,-73.9917],'D15':[40.7596,-73.9904],'D16':[40.7511,-73.9941],
  'D17':[40.7422,-73.9892],'D18':[40.7361,-73.9974],'D19':[40.7298,-74.0018],
  'D20':[40.7257,-74.0022],'D21':[40.7202,-73.9980],'D22':[40.7150,-73.9967],
  'D25':[40.6963,-73.9897],'D26':[40.6830,-73.9765],'D27':[40.6716,-73.9751],
  'D28':[40.6598,-73.9749],'D29':[40.6486,-73.9733],'D30':[40.6347,-73.9608],
  'D31':[40.6256,-73.9487],'D32':[40.6082,-73.9225],'D33':[40.5896,-73.9227],
  'D34':[40.5765,-73.9199],'D35':[40.5602,-73.9130],
  'F01':[40.7136,-73.8730],'F02':[40.7268,-73.8848],'F03':[40.7357,-73.8966],
  'F04':[40.7447,-73.9228],'F05':[40.7447,-73.9363],'F06':[40.7447,-73.9497],
  'F07':[40.7447,-73.9630],'F09':[40.7460,-73.9773],'F11':[40.7469,-73.9887],
  'F12':[40.7505,-74.0002],'F14':[40.7511,-73.9941],'F15':[40.7596,-73.9904],
  'F16':[40.7681,-73.9917],'F18':[40.7736,-73.9872],'F20':[40.7786,-73.9820],
  'F21':[40.7856,-73.9773],'F22':[40.7925,-73.9725],'F23':[40.8038,-73.9664],
  'F24':[40.7598,-73.9813],'F25':[40.7505,-73.9836],'F26':[40.7398,-73.9891],
  'F27':[40.7338,-74.0000],'F29':[40.7202,-73.9980],'F30':[40.7095,-73.9983],
  'F31':[40.6979,-73.9902],'F32':[40.6877,-73.9891],'F33':[40.6773,-73.9797],
  'F34':[40.6668,-73.9785],'F35':[40.6557,-73.9751],'F36':[40.6442,-73.9735],
  'F38':[40.6311,-73.9604],'F39':[40.6179,-73.9527],
  'G05':[40.7481,-73.8940],'G06':[40.7464,-73.9048],'G07':[40.7449,-73.9172],
  'G08':[40.7450,-73.9310],'G09':[40.7313,-73.9509],'G10':[40.7228,-73.9510],
  'G11':[40.7110,-73.9508],'G12':[40.7003,-73.9497],'G13':[40.6907,-73.9488],
  'G14':[40.6826,-73.9494],'G15':[40.6724,-73.9567],'G16':[40.6591,-73.9547],
  'G18':[40.6451,-73.9575],'G19':[40.6350,-73.9596],'G20':[40.6258,-73.9638],
  'G21':[40.6156,-73.9627],'G22':[40.6083,-73.9606],
  'J12':[40.7061,-73.9999],'J13':[40.7104,-73.9910],'J14':[40.7073,-73.9811],
  'J15':[40.7020,-73.9735],'J16':[40.6964,-73.9668],'J17':[40.6897,-73.9577],
  'J19':[40.6819,-73.9489],'J20':[40.6735,-73.9368],'J21':[40.6657,-73.9206],
  'J22':[40.6597,-73.9074],'J23':[40.6939,-73.8783],'J24':[40.7028,-73.8693],
  'J27':[40.7168,-73.8558],'J28':[40.7232,-73.8428],'J29':[40.7325,-73.8222],
  'J30':[40.7411,-73.8080],
  'L01':[40.7373,-74.0002],'L02':[40.7380,-73.9963],'L03':[40.7381,-73.9843],
  'L05':[40.7381,-73.9758],'L06':[40.7375,-73.9633],'L08':[40.7374,-73.9502],
  'L10':[40.7075,-73.9350],'L11':[40.6981,-73.9214],'L12':[40.6887,-73.9119],
  'L13':[40.6787,-73.9016],'L14':[40.6703,-73.8905],'L15':[40.6578,-73.8779],
  'L16':[40.6467,-73.8715],'L17':[40.6374,-73.8677],'L19':[40.6258,-73.8645],
  'L20':[40.6149,-73.8622],'L21':[40.6032,-73.8623],'L22':[40.5959,-73.8599],
  'L25':[40.5891,-73.8570],'L26':[40.5798,-73.8628],'L27':[40.5739,-73.8691],
  'L28':[40.5694,-73.8822],'L29':[40.5636,-73.8937],
  'N02':[40.7611,-73.8307],'N03':[40.7556,-73.8509],'N04':[40.7476,-73.8716],
  'N05':[40.7447,-73.8913],'N06':[40.7447,-73.9228],'N07':[40.7447,-73.9497],
  'N08':[40.7505,-74.0002],'N09':[40.7542,-73.9868],'N10':[40.7681,-73.9917],
  'Q01':[40.5764,-73.9601],'Q03':[40.5921,-73.9491],'Q04':[40.6024,-73.9412],
  'Q05':[40.6135,-73.9318],'Q06':[40.6258,-73.9185],'Q07':[40.6361,-73.9017],
  'Q08':[40.6486,-73.8947],'Q09':[40.6588,-73.8784],'Q10':[40.6707,-73.8636],
  'Q11':[40.6796,-73.8490],'Q12':[40.6896,-73.8286],'Q13':[40.6969,-73.8144],
  'R01':[40.6082,-73.9225],'R03':[40.6347,-73.9608],'R04':[40.6486,-73.9733],
  'R05':[40.6557,-73.9751],'R06':[40.6668,-73.9785],'R08':[40.6773,-73.9797],
  'R09':[40.6877,-73.9891],'R11':[40.6979,-73.9902],'R13':[40.7095,-73.9983],
  'R14':[40.7202,-73.9980],'R15':[40.7298,-74.0018],'R16':[40.7361,-73.9974],
  'R17':[40.7422,-73.9892],'R19':[40.7505,-74.0002],'R20':[40.7511,-73.9941],
  'R21':[40.7596,-73.9904],'R22':[40.7681,-73.9917],'R23':[40.7736,-73.9872],
  'R24':[40.7786,-73.9820],'R25':[40.7856,-73.9773],'R26':[40.7925,-73.9725],
  'R27':[40.8038,-73.9664],'R28':[40.8122,-73.9431],'R29':[40.8250,-73.9502],
  'R30':[40.8367,-73.9402],'R31':[40.8451,-73.9258],'R32':[40.8569,-73.9098],
  'R33':[40.8730,-73.8839],'R34':[40.8893,-73.8987],'R35':[40.9169,-73.8738],
  'R36':[40.6902,-73.9861],'R39':[40.6789,-73.9817],'R40':[40.6675,-73.9779],
  'R41':[40.6598,-73.9627],'R42':[40.6483,-73.9504],'R43':[40.6355,-73.9399],
  'R44':[40.6213,-73.9285],'R45':[40.6082,-73.9225],
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const path = new URL(request.url).pathname;

    if (path === '/health') {
      return json({ status: 'ok', ts: new Date().toISOString() });
    }

    if (path === '/trains/nyc') {
      try {
        const trains = await fetchAllMTATrains();
        return json({ city:'nyc', count:trains.length, updatedAt:new Date().toISOString(), trains });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // Fast debug — decode ONE feed only, show raw entity structure
    if (path === '/debug') {
      const url = MTA_FEEDS[0]; // just the 1/2/3/4/5/6/7 feed
      const resp = await fetch(url, { cf:{ cacheTtl:20 } });
      const buf  = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Show the first 3 raw entities with ALL fields visible
      const entities = decodeFeedRaw(bytes).slice(0, 3);
      return json({ bytes: buf.byteLength, entities });
    }

    return json({ error:'Not found. Try /trains/nyc, /health, or /debug' }, 404);
  }
};

// ── Fetch all MTA feeds concurrently ─────────────────────────

async function fetchAllMTATrains() {
  const results = await Promise.allSettled(
    MTA_FEEDS.map(url => withTimeout(fetchFeed(url), 8000))
  );

  const trains = [];
  const seen   = new Set();
  const now    = Math.floor(Date.now() / 1000);

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const entity of result.value) {

      // Vehicle position entity — real GPS coords
      if (entity.vehicle?.position) {
        const v = entity.vehicle;
        const routeId = v.trip?.routeId ?? '';
        if (!routeId || !LINE_COLORS[routeId]) continue;
        const stale = now - (v.timestamp ?? now);
        if (stale > 180) continue;
        if (seen.has(entity.id)) continue;
        seen.add(entity.id);
        trains.push({
          id:     entity.id,
          line:   routeId,
          color:  LINE_COLORS[routeId],
          lat:    Math.round(v.position.latitude  * 100000) / 100000,
          lng:    Math.round(v.position.longitude * 100000) / 100000,
          bearing: v.position.bearing ? Math.round(v.position.bearing) : null,
          status: ['INCOMING','AT_STOP','IN_TRANSIT'][v.currentStatus] ?? 'IN_TRANSIT',
          source: 'gps',
        });
        continue;
      }

      // Trip update entity — infer position from next stop coords
      if (entity.tripUpdate) {
        const tu = entity.tripUpdate;
        const routeId = tu.trip?.routeId ?? '';
        if (!routeId || !LINE_COLORS[routeId]) continue;
        if (seen.has(entity.id)) continue;

        let position = null;
        for (const su of (tu.stopTimeUpdate ?? [])) {
          const stopId = su.stopId?.replace(/[NS]$/, '');
          const coords = STOPS[stopId];
          if (coords) { position = { lat: coords[0], lng: coords[1] }; break; }
        }
        if (!position) continue;

        seen.add(entity.id);
        trains.push({
          id:    entity.id,
          line:  routeId,
          color: LINE_COLORS[routeId],
          lat:   position.lat,
          lng:   position.lng,
          bearing: null,
          status: 'IN_TRANSIT',
          source: 'stop',
        });
      }
    }
  }
  return trains;
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),ms))]);
}

async function fetchFeed(url) {
  const resp = await fetch(url, { cf:{ cacheTtl:20, cacheEverything:true } });
  if (!resp.ok) throw new Error(`${resp.status}`);
  return decodeFeed(new Uint8Array(await resp.arrayBuffer()));
}

// Raw decoder — dumps all field numbers without assuming structure
function decodeFeedRaw(bytes) {
  const r = new PB(bytes), entities = [];
  while (r.ok()) {
    const {f,w} = r.tag();
    if (f===2&&w===2) {
      const eb = r.bytes();
      const er = new PB(eb);
      const entity = { fields: {} };
      while (er.ok()) {
        const {f:ef,w:ew} = er.tag();
        if (ew===2) {
          const sub = er.bytes();
          const sr  = new PB(sub);
          const subFields = {};
          while (sr.ok()) {
            try {
              const {f:sf,w:sw} = sr.tag();
              if (sw===2) { const s2=sr.bytes(); subFields[sf]='bytes('+s2.length+')'; }
              else if (sw===0) { subFields[sf]=sr.varint(); }
              else if (sw===5) { subFields[sf]=sr.float(); }
              else { sr.skip(sw); subFields[sf]='wire'+sw; }
            } catch(e) { break; }
          }
          entity.fields[ef] = subFields;
        } else if (ew===0) {
          entity.fields[ef] = er.varint();
        } else if (ew===2) {
          er.bytes();
          entity.fields[ef] = 'bytes';
        } else {
          er.skip(ew);
        }
      }
      entities.push(entity);
    } else r.skip(w);
  }
  return entities;
}

// ── GTFS-RT protobuf decoder — trip update focused ───────────

function decodeFeed(bytes) {
  const r = new PB(bytes), entities = [];
  while (r.ok()) {
    const {f,w} = r.tag();
    if (f===2&&w===2) entities.push(decodeEntity(r.bytes()));
    else r.skip(w);
  }
  return entities;
}

function decodeEntity(bytes) {
  const r = new PB(bytes);
  const e = { id:'', tripUpdate:null, vehicle:null };
  while (r.ok()) {
    const {f,w} = r.tag();
    if      (f===1&&w===2) e.id         = readEntityId(r.bytes()); // id is nested
    else if (f===3&&w===2) e.tripUpdate = decodeTripUpdate(r.bytes());
    else if (f===4&&w===2) e.vehicle    = decodeVehicle(r.bytes()); // vehicle position
    else r.skip(w);
  }
  return e;
}

// The id field is itself a message with field 6 = the string bytes
function readEntityId(bytes) {
  const r = new PB(bytes);
  while (r.ok()) {
    const {f,w} = r.tag();
    if (f===6&&w===2) return r.str();
    else r.skip(w);
  }
  return '';
}

function decodeTripUpdate(bytes) {
  const r = new PB(bytes), tu = {trip:{routeId:'',tripId:''}, stopTimeUpdate:[]};
  while (r.ok()) {
    const {f,w} = r.tag();
    if      (f===1&&w===2) tu.trip           = decodeTrip(r.bytes());
    else if (f===2&&w===2) tu.stopTimeUpdate.push(decodeStopTimeUpdate(r.bytes()));
    else r.skip(w);
  }
  return tu;
}

function decodeTrip(bytes) {
  const r = new PB(bytes), t = {tripId:'',routeId:''};
  while (r.ok()) {
    const {f,w} = r.tag();
    if      (f===1&&w===2) t.tripId  = r.str();
    else if (f===3&&w===2) t.routeId = r.str();
    else r.skip(w);
  }
  return t;
}

function decodeStopTimeUpdate(bytes) {
  const r = new PB(bytes), s = {stopId:null, arrival:null, departure:null};
  while (r.ok()) {
    const {f,w} = r.tag();
    if      (f===3&&w===0) s.stopSequence = r.varint();
    else if (f===4&&w===2) s.arrival      = decodeStopEvent(r.bytes());
    else if (f===5&&w===2) s.departure    = decodeStopEvent(r.bytes());
    else if (f===7&&w===2) s.stopId       = r.str();
    else r.skip(w);
  }
  return s;
}

function decodeVehicle(bytes) {
  const r = new PB(bytes);
  const v = { trip:{routeId:'',tripId:''}, position:null, currentStatus:2, timestamp:0 };
  while (r.ok()) {
    const {f,w} = r.tag();
    if      (f===1&&w===2) v.trip          = decodeTrip(r.bytes());
    else if (f===2&&w===2) v.position      = decodePosition(r.bytes());
    else if (f===4&&w===0) v.currentStatus = r.varint();
    else if (f===5&&w===0) v.timestamp     = r.varint();
    else if (f===7&&w===2) v.stopId        = r.str();
    else r.skip(w);
  }
  return v;
}

function decodePosition(bytes) {
  const r = new PB(bytes), p = { latitude:0, longitude:0, bearing:null };
  while (r.ok()) {
    const {f,w} = r.tag();
    if      (f===1&&w===5) p.latitude  = r.float();
    else if (f===2&&w===5) p.longitude = r.float();
    else if (f===3&&w===5) p.bearing   = r.float();
    else r.skip(w);
  }
  return p;
}

class PB {
  constructor(b){this.b=b;this.p=0;}
  ok(){return this.p<this.b.length;}
  tag(){const v=this.varint();return{f:v>>>3,w:v&7};}
  varint(){
    let r=0,s=0;
    while(true){const b=this.b[this.p++];r|=(b&0x7f)<<s;s+=7;if(!(b&0x80))break;}
    return r>>>0;
  }
  bytes(){const l=this.varint(),s=this.b.slice(this.p,this.p+l);this.p+=l;return s;}
  str(){return new TextDecoder().decode(this.bytes());}
  float(){const v=new DataView(this.b.buffer,this.b.byteOffset+this.p,4).getFloat32(0,true);this.p+=4;return v;}
  skip(w){
    if(w===0)this.varint();
    else if(w===1)this.p+=8;
    else if(w===2){const l=this.varint();this.p+=l;}
    else if(w===5)this.p+=4;
  }
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...CORS}});
}
