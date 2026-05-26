/**
 * Transit Map - Cloudflare Worker
 * Decodes GTFS-RT protobuf feeds → clean JSON for all platforms
 * Supports: NYC MTA, Paris IDFM (extensible to any GTFS-RT city)
 */

import { decodeFeed } from './gtfs-decoder.js';
import { CITY_CONFIGS } from './cities.js';

// Ad config — change here, all platforms update automatically
const AD_CONFIG = {
  intervalSeconds: 300,        // 5 minutes
  durationSeconds: 30,         // max ad display time
  enabled: true,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // CORS headers for all platforms
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const path = url.pathname;

    // ── Routes ──────────────────────────────────────────────
    try {
      // GET /cities — list all supported cities
      if (path === '/cities') {
        return jsonResponse(
          Object.entries(CITY_CONFIGS).map(([id, c]) => ({
            id,
            name: c.name,
            country: c.country,
            center: c.center,
            zoom: c.defaultZoom,
            lines: c.lines.map(l => ({ id: l.id, name: l.name, color: l.color })),
          })),
          corsHeaders
        );
      }

      // GET /trains/:cityId — live train positions for a city
      if (path.startsWith('/trains/')) {
        const cityId = path.split('/')[2];
        const city = CITY_CONFIGS[cityId];
        if (!city) return errorResponse(404, `City '${cityId}' not found`, corsHeaders);

        const trains = await fetchTrains(city, env);
        return jsonResponse({ city: cityId, updatedAt: new Date().toISOString(), trains }, corsHeaders);
      }

      // GET /config — ad config + app settings for all platforms
      if (path === '/config') {
        return jsonResponse({ ads: AD_CONFIG, version: '1.0.0' }, corsHeaders);
      }

      // GET /health
      if (path === '/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, corsHeaders);
      }

      return errorResponse(404, 'Not found', corsHeaders);

    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse(500, err.message, corsHeaders);
    }
  },
};

// ── Train fetching ───────────────────────────────────────────

async function fetchTrains(city, env) {
  const allTrains = [];

  for (const feed of city.feeds) {
    const feedUrl = buildFeedUrl(feed, env);

    const response = await fetch(feedUrl, {
      headers: feed.apiKeyHeader
        ? { [feed.apiKeyHeader]: env[feed.apiKeyEnvVar] }
        : {},
      cf: { cacheTtl: 15 }, // Cloudflare edge cache for 15s
    });

    if (!response.ok) {
      console.warn(`Feed ${feed.id} returned ${response.status}`);
      continue;
    }

    const buffer = await response.arrayBuffer();
    const decoded = decodeFeed(buffer);
    const trains = extractTrainPositions(decoded, city, feed);
    allTrains.push(...trains);
  }

  return allTrains;
}

function buildFeedUrl(feed, env) {
  // MTA uses ?key= param, others use headers
  if (feed.apiKeyParam && env[feed.apiKeyEnvVar]) {
    return `${feed.url}?key=${env[feed.apiKeyEnvVar]}`;
  }
  return feed.url;
}

function extractTrainPositions(decoded, city, feed) {
  const trains = [];
  const now = Math.floor(Date.now() / 1000);

  for (const entity of decoded.entity || []) {
    // Vehicle position entities
    if (entity.vehicle?.position) {
      const v = entity.vehicle;
      const lineId = resolveLineId(v.trip?.routeId, feed.routePrefix);
      const line = city.lines.find(l => l.id === lineId);

      trains.push({
        id: entity.id,
        lineId,
        lineName: line?.name ?? lineId,
        lineColor: line?.color ?? '#888888',
        lat: v.position.latitude,
        lng: v.position.longitude,
        bearing: v.position.bearing ?? null,
        speed: v.position.speed ?? null,
        status: vehicleStatus(v.currentStatus),
        stopId: v.stopId ?? null,
        tripId: v.trip?.tripId ?? null,
        timestamp: v.timestamp ?? now,
        staleSeconds: now - (v.timestamp ?? now),
      });
    }
  }

  // Filter out stale positions (>3 minutes old)
  return trains.filter(t => t.staleSeconds < 180);
}

function resolveLineId(routeId, prefix) {
  if (!routeId) return 'unknown';
  // MTA routes like "1", "A", "L" — strip any prefix added by feed
  return prefix ? routeId.replace(prefix, '') : routeId;
}

function vehicleStatus(status) {
  const map = { 0: 'INCOMING', 1: 'AT_STOP', 2: 'IN_TRANSIT' };
  return map[status] ?? 'IN_TRANSIT';
}

// ── Helpers ──────────────────────────────────────────────────

function jsonResponse(data, corsHeaders) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders,
    },
  });
}

function errorResponse(status, message, corsHeaders) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
