sub init()
    m.WORKER = "https://transitmap.marcboyer-public.workers.dev"
    m.FETCH_INTERVAL = 30

    m.cities = [
        {
            id: "nyc", name: "New York", sub: "MTA SUBWAY",
            img: "pkg:/images/map_nyc.jpg",
            bounds: {minLon: -74.336, maxLon: -73.676, minLat: 40.572, maxLat: 40.853}
        },
        {
            id: "paris", name: "Paris", sub: "RATP METRO",
            img: "pkg:/images/map_paris.jpg",
            bounds: {minLon: 2.017, maxLon: 2.677, minLat: 48.738, maxLat: 48.982}
        },
        {
            id: "helsinki", name: "Helsinki", sub: "HSL TRANSIT",
            img: "pkg:/images/map_helsinki.jpg",
            bounds: {minLon: 24.610, maxLon: 25.270, minLat: 60.078, maxLat: 60.262}
        },
        {
            id: "sydney", name: "Sydney", sub: "TFNSW TRAINS",
            img: "pkg:/images/map_sydney.jpg",
            bounds: {minLon: 150.880, maxLon: 151.540, minLat: -34.024, maxLat: -33.716}
        },
        {
            id: "tokyo", name: "Tokyo", sub: "TOEI AND METRO",
            img: "pkg:/images/map_tokyo.jpg",
            bounds: {minLon: 139.390, maxLon: 140.050, minLat: 35.539, maxLat: 35.840}
        },
        {
            id: "seattle", name: "Seattle", sub: "SOUND TRANSIT",
            img: "pkg:/images/map_seattle.jpg",
            bounds: {minLon: -122.660, maxLon: -122.000, minLat: 47.485, maxLat: 47.735}
        }
    ]

    m.cityIdx = 0
    m.dots = []
    m.fetchTask = invalid

    m.timer = CreateObject("roSGNode", "Timer")
    m.timer.duration = m.FETCH_INTERVAL
    m.timer.repeat = true
    m.timer.observeField("fire", "onTimer")

    m.top.findNode("focusTrap").setFocus(true)

    switchCity(0)
end sub

sub switchCity(idx as Integer)
    m.cityIdx = idx
    city = m.cities[idx]

    m.top.findNode("mapBg").uri = city.img
    m.top.findNode("cityName").text = city.name
    m.top.findNode("citySub").text = city.sub + "  Connecting..."
    m.top.findNode("workerVer").text = ""

    clearDots()

    m.timer.control = "stop"
    startFetch()
    m.timer.control = "start"
end sub

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
    city = m.cities[m.cityIdx]

    if data = invalid
        m.top.findNode("citySub").text = city.sub + "  No response"
        return
    end if

    if data.fetchError <> invalid
        m.top.findNode("citySub").text = city.sub + "  ERR: " + data.fetchError
        return
    end if

    trains = data.trains
    if trains = invalid
        m.top.findNode("citySub").text = city.sub + "  No trains field"
        return
    end if

    bounds = city.bounds
    layer = m.top.findNode("trainLayer")

    clearDots()

    total = trains.count()
    visible = 0

    for each t in trains
        lat = t.lat
        lon = t.lng
        inBounds = lon >= bounds.minLon and lon <= bounds.maxLon and lat >= bounds.minLat and lat <= bounds.maxLat
        if inBounds
            p = project(lat, lon, bounds)
            dot = CreateObject("roSGNode", "Rectangle")
            dot.width = 10
            dot.height = 10
            ' Val("&hRRGGBBAA") converts hex string to integer.
            ' String assignment to color field renders black on some firmware.
            dot.color = colorFromHex(t.color)
            dot.translation = [p.x - 5, p.y - 5]
            layer.appendChild(dot)
            m.dots.push(dot)
            visible += 1
        end if
    end for

    totalStr   = Substitute(Str(total),   " ", "")
    visibleStr = Substitute(Str(visible), " ", "")
    m.top.findNode("citySub").text = city.sub + "  " + visibleStr + " / " + totalStr

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

' Convert CSS "#RRGGBB" to a BrightScript integer color (RRGGBBAA).
' Using Val("&hRRGGBBAA") so the Rectangle.color field gets a proper integer,
' not a string (string-to-color coercion is unreliable on some firmware).
Function colorFromHex(hex as String) as Integer
    if hex = invalid or Len(hex) < 7 then return &hFFFFFFFF
    return Val("&h" + Mid(hex, 2, 6) + "FF")
End Function

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
