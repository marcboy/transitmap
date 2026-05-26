/**
 * City Configurations
 * Add a new city by adding a new entry — no other code changes needed.
 * All platforms automatically get new cities via /cities endpoint.
 */

export const CITY_CONFIGS = {

  // ── New York City ──────────────────────────────────────────
  nyc: {
    name: 'New York City',
    country: 'US',
    center: { lat: 40.7128, lng: -74.0060 },
    defaultZoom: 12,

    // MTA provides separate feeds per line group
    feeds: [
      { id: 'ace',    url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',    apiKeyHeader: 'x-api-key', apiKeyEnvVar: 'MTA_API_KEY' },
      { id: 'bdfm',   url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',   apiKeyHeader: 'x-api-key', apiKeyEnvVar: 'MTA_API_KEY' },
      { id: 'g',      url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',      apiKeyHeader: 'x-api-key', apiKeyEnvVar: 'MTA_API_KEY' },
      { id: 'jz',     url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',     apiKeyHeader: 'x-api-key', apiKeyEnvVar: 'MTA_API_KEY' },
      { id: 'nqrw',   url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',   apiKeyHeader: 'x-api-key', apiKeyEnvVar: 'MTA_API_KEY' },
      { id: 'l',      url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',      apiKeyHeader: 'x-api-key', apiKeyEnvVar: 'MTA_API_KEY' },
      { id: '1234567',url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',        apiKeyHeader: 'x-api-key', apiKeyEnvVar: 'MTA_API_KEY' },
      { id: 'si',     url: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',     apiKeyHeader: 'x-api-key', apiKeyEnvVar: 'MTA_API_KEY' },
    ],

    // Official MTA line colors
    lines: [
      { id: '1', name: '1',  color: '#EE352E' },
      { id: '2', name: '2',  color: '#EE352E' },
      { id: '3', name: '3',  color: '#EE352E' },
      { id: '4', name: '4',  color: '#00933C' },
      { id: '5', name: '5',  color: '#00933C' },
      { id: '6', name: '6',  color: '#00933C' },
      { id: '7', name: '7',  color: '#B933AD' },
      { id: 'A', name: 'A',  color: '#2850AD' },
      { id: 'C', name: 'C',  color: '#2850AD' },
      { id: 'E', name: 'E',  color: '#2850AD' },
      { id: 'B', name: 'B',  color: '#FF6319' },
      { id: 'D', name: 'D',  color: '#FF6319' },
      { id: 'F', name: 'F',  color: '#FF6319' },
      { id: 'M', name: 'M',  color: '#FF6319' },
      { id: 'G', name: 'G',  color: '#6CBE45' },
      { id: 'J', name: 'J',  color: '#996633' },
      { id: 'Z', name: 'Z',  color: '#996633' },
      { id: 'L', name: 'L',  color: '#A7A9AC' },
      { id: 'N', name: 'N',  color: '#FCCC0A' },
      { id: 'Q', name: 'Q',  color: '#FCCC0A' },
      { id: 'R', name: 'R',  color: '#FCCC0A' },
      { id: 'W', name: 'W',  color: '#FCCC0A' },
      { id: 'S', name: 'S',  color: '#808183' },
    ],
  },

  // ── Paris ─────────────────────────────────────────────────
  paris: {
    name: 'Paris',
    country: 'FR',
    center: { lat: 48.8566, lng: 2.3522 },
    defaultZoom: 13,

    // IDFM provides a unified feed
    feeds: [
      {
        id: 'ratp-metro',
        url: 'https://prim.iledefrance-mobilites.fr/marketplace/gtfs-rt/vehiclePositions',
        apiKeyHeader: 'apikey',
        apiKeyEnvVar: 'IDFM_API_KEY',
      },
    ],

    // Official RATP Métro line colors
    lines: [
      { id: '1',   name: 'M1',  color: '#FFCD00' },
      { id: '2',   name: 'M2',  color: '#003CA6' },
      { id: '3',   name: 'M3',  color: '#837902' },
      { id: '3b',  name: 'M3b', color: '#6EC4E8' },
      { id: '4',   name: 'M4',  color: '#CF009E' },
      { id: '5',   name: 'M5',  color: '#FF7E2E' },
      { id: '6',   name: 'M6',  color: '#6ECA97' },
      { id: '7',   name: 'M7',  color: '#FA9ABA' },
      { id: '7b',  name: 'M7b', color: '#6ECA97' },
      { id: '8',   name: 'M8',  color: '#E19BDF' },
      { id: '9',   name: 'M9',  color: '#B6BD00' },
      { id: '10',  name: 'M10', color: '#C9910D' },
      { id: '11',  name: 'M11', color: '#704B1C' },
      { id: '12',  name: 'M12', color: '#007852' },
      { id: '13',  name: 'M13', color: '#6EC4E8' },
      { id: '14',  name: 'M14', color: '#62259D' },
    ],
  },

  // ── Template for future cities ─────────────────────────────
  // london: {
  //   name: 'London',
  //   country: 'GB',
  //   center: { lat: 51.5074, lng: -0.1278 },
  //   defaultZoom: 12,
  //   feeds: [{ id: 'tfl', url: 'https://api.tfl.gov.uk/...', apiKeyParam: 'app_key', apiKeyEnvVar: 'TFL_API_KEY' }],
  //   lines: [ ... ],
  // },
};
