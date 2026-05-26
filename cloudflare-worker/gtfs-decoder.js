/**
 * Lightweight GTFS-RT Protobuf Decoder
 * No npm dependencies — runs natively in Cloudflare Workers.
 * Decodes only the fields we need: entity, vehicle, position, trip.
 */

export function decodeFeed(buffer) {
  const bytes = new Uint8Array(buffer);
  const reader = new ProtoReader(bytes);
  const feed = { header: {}, entity: [] };

  while (reader.hasMore()) {
    const { field, wireType } = reader.readTag();

    if (field === 1 && wireType === 2) {
      // FeedHeader
      feed.header = decodeHeader(reader.readBytes());
    } else if (field === 2 && wireType === 2) {
      // FeedEntity
      feed.entity.push(decodeEntity(reader.readBytes()));
    } else {
      reader.skip(wireType);
    }
  }

  return feed;
}

function decodeHeader(bytes) {
  const reader = new ProtoReader(bytes);
  const header = {};
  while (reader.hasMore()) {
    const { field, wireType } = reader.readTag();
    if (field === 1 && wireType === 2) header.gtfsRealtimeVersion = reader.readString();
    else if (field === 3 && wireType === 0) header.timestamp = reader.readVarint();
    else reader.skip(wireType);
  }
  return header;
}

function decodeEntity(bytes) {
  const reader = new ProtoReader(bytes);
  const entity = { id: '', vehicle: null };
  while (reader.hasMore()) {
    const { field, wireType } = reader.readTag();
    if (field === 1 && wireType === 2) entity.id = reader.readString();
    else if (field === 4 && wireType === 2) entity.vehicle = decodeVehicle(reader.readBytes());
    else reader.skip(wireType);
  }
  return entity;
}

function decodeVehicle(bytes) {
  const reader = new ProtoReader(bytes);
  const v = { trip: null, position: null, currentStatus: null, stopId: null, timestamp: null };
  while (reader.hasMore()) {
    const { field, wireType } = reader.readTag();
    if (field === 1 && wireType === 2) v.trip = decodeTrip(reader.readBytes());
    else if (field === 2 && wireType === 2) v.position = decodePosition(reader.readBytes());
    else if (field === 4 && wireType === 0) v.currentStatus = reader.readVarint();
    else if (field === 5 && wireType === 0) v.timestamp = reader.readVarint();
    else if (field === 7 && wireType === 2) v.stopId = reader.readString();
    else reader.skip(wireType);
  }
  return v;
}

function decodeTrip(bytes) {
  const reader = new ProtoReader(bytes);
  const t = {};
  while (reader.hasMore()) {
    const { field, wireType } = reader.readTag();
    if (field === 1 && wireType === 2) t.tripId = reader.readString();
    else if (field === 3 && wireType === 2) t.routeId = reader.readString();
    else reader.skip(wireType);
  }
  return t;
}

function decodePosition(bytes) {
  const reader = new ProtoReader(bytes);
  const p = {};
  while (reader.hasMore()) {
    const { field, wireType } = reader.readTag();
    if (field === 1 && wireType === 5) p.latitude = reader.readFloat();
    else if (field === 2 && wireType === 5) p.longitude = reader.readFloat();
    else if (field === 3 && wireType === 5) p.bearing = reader.readFloat();
    else if (field === 4 && wireType === 1) p.odometer = reader.readDouble();
    else if (field === 5 && wireType === 5) p.speed = reader.readFloat();
    else reader.skip(wireType);
  }
  return p;
}

// ── Minimal Protobuf Reader ───────────────────────────────────

class ProtoReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.pos = 0;
  }

  hasMore() { return this.pos < this.bytes.length; }

  readTag() {
    const varint = this.readVarint();
    return { field: varint >>> 3, wireType: varint & 0x7 };
  }

  readVarint() {
    let result = 0, shift = 0;
    while (true) {
      const byte = this.bytes[this.pos++];
      result |= (byte & 0x7F) << shift;
      if (!(byte & 0x80)) break;
      shift += 7;
    }
    return result >>> 0;
  }

  readBytes() {
    const len = this.readVarint();
    const slice = this.bytes.slice(this.pos, this.pos + len);
    this.pos += len;
    return slice;
  }

  readString() {
    return new TextDecoder().decode(this.readBytes());
  }

  readFloat() {
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 4);
    this.pos += 4;
    return view.getFloat32(0, true);
  }

  readDouble() {
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.pos, 8);
    this.pos += 8;
    return view.getFloat64(0, true);
  }

  skip(wireType) {
    if (wireType === 0) this.readVarint();
    else if (wireType === 1) this.pos += 8;
    else if (wireType === 2) { const len = this.readVarint(); this.pos += len; }
    else if (wireType === 5) this.pos += 4;
  }
}
