sub init()
    m.WORKER = "https://transitmap.marcboyer-public.workers.dev"
    m.FETCH_INTERVAL = 30 ' seconds

    ' City definitions.
    ' bounds = geographic extent of the 1920x1080 map PNG (gen_maps.js outputs these).
    m.cities = [
        {
            id: "nyc", name: "New York", sub: "MTA SUBWAY",
            img: "pkg:/images/map_nyc.jpg",
            bounds: {minLon: -74.335, maxLon: -73.677, minLat: 40.480, maxLat: 40.948}
        },
        {
            id: "paris", name: "Paris", sub: "RATP METRO",
            img: "pkg:/images/map_paris.jpg",
            bounds: {minLon: 2.100, maxLon: 2.620, minLat: 48.720, maxLat: 49.005}
        },
        {
            id: "helsinki", name: "Helsinki", sub: "HSL TRANSIT",
            img: "pkg:/images/map_helsinki.jpg",
            bounds: {minLon: 24.620, maxLon: 25.240, minLat: 59.990, maxLat: 60.350}
        },
        {
            id: "sydney", name: "Sydney", sub: "TFNSW TRAINS",
            img: "pkg:/images/map_sydney.jpg",
            bounds: {minLon: 150.880, maxLon: 151.540, minLat: -34.100, maxLat: -33.650}
        },
        {
            id: "tokyo", name: "Tokyo", sub: "TOEI & METRO",
            img: "pkg:/images/map_tokyo.jpg",
            bounds: {minLon: 139.440, maxLon: 140.060, minLat: 35.450, maxLat: 35.850}
        },
        {
            id: "seattle", name: "Seattle", sub: "SOUND TRANSIT",
            img: "pkg:/images/map_seattle.jpg",
            bounds: {minLon: -122.620, maxLon: -121.960, minLat: 47.440, maxLat: 47.820}
        }
    ]

    m.cityIdx = 0
    m.dots = []
    m.fetchTask = invalid

    ' Periodic refresh timer
    m.timer = CreateObject("roSGNode", "Timer")
    m.timer.duration = m.FETCH_INTERVAL
    m.timer.repeat = true
    m.timer.observeField("fire", "onTimer")

    m.top.findNode("focusTrap").setFocus(true)

    switchCity(0)
end sub

' ── City switching ────────────────────────────────────────────────────────────

sub switchCity(idx as Integer)
    m.cityIdx = idx
    city = m.cities[idx]

    m.top.findNode("mapBg").uri = city.img
    m.top.findNode("cityName").text = city.name
    m.top.findNode("citySub").text = city.sub
    m.top.findNode("workerVer").text = ""

    clearDots()

    m.timer.control = "stop"
    startFetch()
    m.timer.control = "start"
end sub

' ── Fetching ──────────────────────────────────────────────────────────────────

sub onTimer()
    startFetch()
end sub

sub startFetch()
    if m.fetchTask <> invalid and m.fetchTask.control = "RUN" then return

    city = m.cities[m.cityIdx]
    m.fetchTask = CreateObject("roSGNode", "FetchTask")
    m.fetchTask.url = m.WORKER + "/trains/" + city.id
    m.fetchTask.observeField("result", "onResult")
    m.fetchTask.control = "RUN"
end sub

sub onResult()
    data = m.fetchTask.result
    if data = invalid then return

    trains = data.trains
    if trains = invalid then return

    city = m.cities[m.cityIdx]
    bounds = city.bounds
    layer = m.top.findNode("trainLayer")

    clearDots()

    visible = 0
    for each t in trains
        lat = t.lat
        lon = t.lon
        if lon >= bounds.minLon and lon <= bounds.maxLon _
           and lat >= bounds.minLat and lat <= bounds.maxLat
            p = project(lat, lon, bounds)
            dot = CreateObject("roSGNode", "Rectangle")
            dot.width  = 9
            dot.height = 9
            dot.color  = hexToRoku(t.color)
            dot.translation = [p.x - 4, p.y - 4]
            layer.appendChild(dot)
            m.dots.push(dot)
            visible++
        end if
    end for

    countStr = Substitute(Str(visible), " ", "")
    m.top.findNode("citySub").text = city.sub + " · " + countStr + " TRAINS"

    if data.workerVersion <> invalid
        m.top.findNode("workerVer").text = data.workerVersion
    end if
end sub

sub clearDots()
    layer = m.top.findNode("trainLayer")
    for each dot in m.dots
        layer.removeChild(dot)
    end for
    m.dots = []
end sub

' ── Coordinate projection ─────────────────────────────────────────────────────
' Web Mercator: lat/lon → pixel on 1920×1080 PNG with the given geographic bounds.

Function mercY(lat as Float) as Float
    r = lat * 3.14159265358979 / 180.0
    return Log(Tan(r / 2.0 + 3.14159265358979 / 4.0))
End Function

Function project(lat as Float, lon as Float, bounds as Object) as Object
    x = Int((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon) * 1920.0)
    yM    = mercY(lat)
    yMmin = mercY(bounds.minLat)
    yMmax = mercY(bounds.maxLat)
    y = Int((1.0 - (yM - yMmin) / (yMmax - yMmin)) * 1080.0)
    return {x: x, y: y}
End Function

' ── Colour helpers ────────────────────────────────────────────────────────────

Function hexToRoku(hex as String) as String
    if hex = invalid or Len(hex) < 7 then return "0xFFFFFFFF"
    return "0x" + Mid(hex, 2, 6) + "FF"
End Function

' ── Key handling ─────────────────────────────────────────────────────────────

Function onKeyEvent(key as String, press as Boolean) as Boolean
    if not press then return false
    n = m.cities.count()
    if key = "left"
        m.timer.control = "stop"
        switchCity((m.cityIdx + n - 1) mod n)
        return true
    else if key = "right"
        m.timer.control = "stop"
        switchCity((m.cityIdx + 1) mod n)
        return true
    end if
    return false
End Function
