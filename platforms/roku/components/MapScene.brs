sub init()
    m.WORKER = "https://transitmap.marcboyer-public.workers.dev"
    m.FETCH_INTERVAL = 30

    m.cities = [
        {
            id: "nyc", name: "New York", sub: "MTA SUBWAY",
            img: "pkg:/images/map_nyc.jpg",
            bounds: {minLon: -74.336, maxLon: -73.676, minLat: 40.572, maxLat: 40.853},
            tzBase: -5, dst: 1, tzName: "ET"
        },
        {
            id: "paris", name: "Paris", sub: "RATP METRO",
            img: "pkg:/images/map_paris.jpg",
            bounds: {minLon: 2.017, maxLon: 2.677, minLat: 48.738, maxLat: 48.982},
            tzBase: 1, dst: 1, tzName: "CET"
        },
        {
            id: "helsinki", name: "Helsinki", sub: "HSL TRANSIT",
            img: "pkg:/images/map_helsinki.jpg",
            bounds: {minLon: 24.610, maxLon: 25.270, minLat: 60.078, maxLat: 60.262},
            tzBase: 2, dst: 1, tzName: "EET"
        },
        {
            id: "sydney", name: "Sydney", sub: "TFNSW TRAINS",
            img: "pkg:/images/map_sydney.jpg",
            bounds: {minLon: 150.880, maxLon: 151.540, minLat: -34.024, maxLat: -33.716},
            tzBase: 10, dst: -1, tzName: "AEST"
        },
        {
            id: "tokyo", name: "Tokyo", sub: "TOEI AND METRO",
            img: "pkg:/images/map_tokyo.jpg",
            bounds: {minLon: 139.390, maxLon: 140.050, minLat: 35.539, maxLat: 35.840},
            tzBase: 9, dst: 0, tzName: "JST"
        },
        {
            id: "seattle", name: "Seattle", sub: "SOUND TRANSIT",
            img: "pkg:/images/map_seattle.jpg",
            bounds: {minLon: -122.660, maxLon: -122.000, minLat: 47.485, maxLat: 47.735},
            tzBase: -8, dst: 1, tzName: "PT"
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

    m.top.findNode("topCityName").text = city.name
    m.top.findNode("topSub").text = city.sub
    m.top.findNode("topTrains").text = "Connecting..."
    m.top.findNode("topTime").text = localTimeStr(city.tzBase, city.dst, city.tzName)

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
        m.top.findNode("topTrains").text = "No response"
        return
    end if

    if data.fetchError <> invalid
        m.top.findNode("citySub").text = city.sub + "  ERR: " + data.fetchError
        m.top.findNode("topTrains").text = "ERR: " + data.fetchError
        return
    end if

    trains = data.trains
    if trains = invalid
        m.top.findNode("citySub").text = city.sub + "  No trains field"
        m.top.findNode("topTrains").text = "No trains field"
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
            dot = CreateObject("roSGNode", "Label")
            dot.text = Chr(9679)
            dot.color = colorFromHex(t.color)
            dot.font = "font:SmallestSystemFont"
            dot.translation = [p.x - 9, p.y - 11]
            layer.appendChild(dot)
            m.dots.push(dot)
            visible += 1
        end if
    end for

    totalStr   = Substitute(Str(total),   " ", "")
    visibleStr = Substitute(Str(visible), " ", "")
    m.top.findNode("citySub").text = city.sub + "  " + visibleStr + " / " + totalStr
    m.top.findNode("topTrains").text = visibleStr + " / " + totalStr + " TRAINS ACTIVE"
    m.top.findNode("topTime").text = localTimeStr(city.tzBase, city.dst, city.tzName)

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

' Convert CSS "#RRGGBB" to a SceneGraph color string "0xRRGGBBAA".
' Returning a string avoids 32-bit signed integer overflow for bright colors.
Function colorFromHex(hex as String) as String
    if hex = invalid or Len(hex) < 7 then return "0xFFFFFFFF"
    return "0x" + Mid(hex, 2, 6) + "FF"
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

' Compute local wall-clock time for the given city timezone.
' tzBase: UTC offset in standard time (e.g. -5 for ET, 9 for JST).
' dst: 1 = northern hemisphere DST (+1h Apr-Oct), -1 = southern (+1h Oct-Apr), 0 = none.
Function localTimeStr(tzBase as Integer, dst as Integer, tzName as String) as String
    dt = CreateObject("roDateTime")
    month = dt.GetMonth()
    offset = tzBase
    if dst = 1 and month >= 4 and month <= 10
        offset = offset + 1
    end if
    if dst = -1
        if month >= 10 or month <= 3
            offset = offset + 1
        end if
    end if

    h = (dt.GetHours() + offset + 48) mod 24
    mn = dt.GetMinutes()

    ampm = "AM"
    if h >= 12 then ampm = "PM"
    if h > 12  then h = h - 12
    if h = 0   then h = 12

    mStr = Str(mn).Trim()
    if mn < 10 then mStr = "0" + mStr
    return Str(h).Trim() + ":" + mStr + " " + ampm + "  " + tzName
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
