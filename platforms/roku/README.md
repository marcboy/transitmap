# TransitMap — Roku Channel

BrightScript + SceneGraph channel. Fetches live train data from the same
Cloudflare Worker used by all other platforms.

## Architecture

```
manifest                  ← Roku app descriptor (title, version, resolution)
source/
  main.brs                ← Entry point: creates roSGScreen, event loop
components/
  MapScene.xml            ← SceneGraph UI layout (map poster, train layer, labels)
  MapScene.brs            ← Logic: city switching, HTTP fetch, dot rendering
  FetchTask.xml / .brs    ← Background Task node for HTTP requests
images/
  map_nyc.jpg             ← Pre-rendered 1920×1080 dark map (generated locally)
  map_paris.jpg
  map_helsinki.jpg
  map_sydney.jpg
  map_tokyo.jpg
  map_seattle.jpg
gen_maps.js               ← Node.js script to generate the map images
package.json              ← staticmaps dependency
```

## How it works

**Map backgrounds:** Roku has no tile-loading runtime, so each city map is a
static 1920×1080 JPEG generated from CartoDB dark tiles (same style as the web
prototype). The images are generated once with `gen_maps.js` and bundled in the
channel package.

**Train dots:** Each train returned by the Cloudflare Worker is projected from
lat/lon to pixel coordinates using Web Mercator math, then rendered as a 9×9
colored `Rectangle` node positioned on top of the map image.

**City switching:** D-pad left/right cycles through the six cities. Data is
refreshed every 30 seconds via a background `Task` node.

## Setup

### 1. Generate map images (one-time)

```bash
cd platforms/roku
npm install
node gen_maps.js
```

This writes `images/map_*.jpg` and prints the geographic bounds of each image.
If you change the zoom level or center coordinates, paste the printed bounds
into `components/MapScene.brs`.

### 2. Enable Developer Mode on your Roku device

1. Go to Settings → System → Advanced → Developer Mode
2. Note the device IP address shown

### 3. Sideload the channel

Package the channel as a zip and upload it via the Roku developer portal:

```bash
cd platforms/roku
zip -r ../TransitMap-roku.zip . -x "*.git*" -x "node_modules/*" -x "gen_maps.js" -x "package*"
```

Then go to `http://<roku-ip>` in a browser, sign in with the dev password, and
upload `TransitMap-roku.zip`.

### 4. Publish to Roku Channel Store (optional)

1. Sign up at developer.roku.com
2. Create a Private or Public channel
3. Submit the zip — no signing tool needed for Private channels

## Map bounds

The `bounds` object in `MapScene.brs` defines the geographic extent of each map
image. If you regenerate images with different parameters, update these values
with the output printed by `gen_maps.js`.

## Navigation

| Key       | Action           |
|-----------|------------------|
| ◄ Left    | Previous city    |
| ► Right   | Next city        |
| Back      | Exit app         |
