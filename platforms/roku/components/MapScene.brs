sub init()
    m.WORKER = "https://transitmap.marcboyer-public.workers.dev"
    m.FETCH_INTERVAL = 30
    m.ROKU_VERSION = "r1.3"
    m.ROKU_BUILT   = "2026-05-31 PT"
    m.APP_VERSION  = "v4.22"
    m.APP_BUILT    = "2026-05-31 · 13:20 PT"

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
    m.fetchTask = invalid

    ' trainData: AA keyed by train ID -> {dot, glow, fromX, fromY, toX, toY}
    m.trainData = {}
    m.hasData = false
    m.animStep = 0

    ' Fetch timer — polls worker every 30 s
    m.fetchTimer = CreateObject("roSGNode", "Timer")
    m.fetchTimer.duration = m.FETCH_INTERVAL
    m.fetchTimer.repeat = true
    m.fetchTimer.observeField("fire", "onFetchTimer")

    ' Animation timer — interpolates dot positions every second
    m.animTimer = CreateObject("roSGNode", "Timer")
    m.animTimer.duration = 1.0
    m.animTimer.repeat = true
    m.animTimer.observeField("fire", "onAnimTick")
    m.animTimer.control = "start"

    m.top.findNode("rokStamp").text = "roku  " + m.ROKU_VERSION + " · " + m.ROKU_BUILT
    m.top.findNode("appStamp").text = "app   " + m.APP_VERSION  + " · " + m.APP_BUILT

    m.top.findNode("focusTrap").setFocus(true)
    switchCity(0)
end sub

sub switchCity(idx as Integer)
    m.cityIdx = idx
    city = m.cities[idx]

    m.top.findNode("mapBg").uri = city.img
    m.top.findNode("wrkStamp").text = ""

    m.top.findNode("topCityName").text = city.name
    m.top.findNode("topSub").text = city.sub
    m.top.findNode("topTrains").text = "Connecting..."
    m.top.findNode("topTime").text = localTimeStr(city.tzBase, city.dst, city.tzName)

    clearTrains()

    m.fetchTimer.control = "stop"
    startFetch()
    m.fetchTimer.control = "start"
end sub

sub onFetchTimer()
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

' Called every second: interpolate each dot from its previous position toward
' the latest fetched position. frac goes 0.0 -> 1.0 over FETCH_INTERVAL steps.
sub onAnimTick()
    if not m.hasData then return

    m.animStep = m.animStep + 1
    if m.animStep > m.FETCH_INTERVAL then m.animStep = m.FETCH_INTERVAL

    frac = m.animStep * 1.0 / m.FETCH_INTERVAL

    for each entry in m.trainData
        if entry <> invalid
            ix = Int(entry.fromX + (entry.toX - entry.fromX) * frac)
            iy = Int(entry.fromY + (entry.toY - entry.fromY) * frac)
            entry.dot.translation = [ix - 9, iy - 11]
            if entry.glow <> invalid
                entry.glow.translation = [ix - 12, iy - 14]
            end if
        end if
    end for
end sub

sub onResult()
    data = m.fetchTask.result
    city = m.cities[m.cityIdx]

    if data = invalid
        m.top.findNode("topTrains").text = "No response"
        return
    end if

    if data.fetchError <> invalid
        m.top.findNode("topTrains").text = "ERR: " + data.fetchError
        return
    end if

    trains = data.trains
    if trains = invalid
        m.top.findNode("topTrains").text = "No trains field"
        return
    end if

    bounds = city.bounds
    layer = m.top.findNode("trainLayer")

    seenIds = {}
    total = trains.count()
    visible = 0

    for each t in trains
        lat = t.lat
        lon = t.lng
        inBounds = (lon >= bounds.minLon and lon <= bounds.maxLon and lat >= bounds.minLat and lat <= bounds.maxLat)
        if inBounds
            p = project(lat, lon, bounds)
            tid = t.id
            seenIds[tid] = true
            visible = visible + 1

            atStop = false
            if t.status <> invalid
                if t.status = "AT_STOP" or t.status = "INCOMING"
                    atStop = true
                end if
            end if

            if m.trainData[tid] = invalid
                ' New train — create nodes at current position
                glow = invalid
                if atStop
                    glow = CreateObject("roSGNode", "Label")
                    glow.text = Chr(9679)
                    glow.color = glowColor(t.color)
                    glow.font = "font:SmallSystemFont"
                    glow.translation = [p.x - 12, p.y - 14]
                    layer.appendChild(glow)
                end if

                dot = CreateObject("roSGNode", "Label")
                dot.text = Chr(9679)
                dot.color = colorFromHex(t.color)
                dot.font = "font:SmallestSystemFont"
                dot.translation = [p.x - 9, p.y - 11]
                layer.appendChild(dot)

                m.trainData[tid] = {
                    dot: dot, glow: glow,
                    fromX: p.x, fromY: p.y,
                    toX: p.x, toY: p.y
                }
            else
                ' Existing train — shift target; old target becomes new origin
                entry = m.trainData[tid]
                entry.fromX = entry.toX
                entry.fromY = entry.toY
                entry.toX = p.x
                entry.toY = p.y

                ' Sync glow with current stop status
                if atStop and entry.glow = invalid
                    glow = CreateObject("roSGNode", "Label")
                    glow.text = Chr(9679)
                    glow.color = glowColor(t.color)
                    glow.font = "font:SmallSystemFont"
                    glow.translation = [p.x - 12, p.y - 14]
                    layer.appendChild(glow)
                    entry.glow = glow
                end if
                if not atStop and entry.glow <> invalid
                    layer.removeChild(entry.glow)
                    entry.glow = invalid
                end if
            end if
        end if
    end for

    ' Remove dots for trains that left the viewport this cycle
    toRemove = []
    for each tid in m.trainData.keys()
        if seenIds[tid] = invalid
            toRemove.push(tid)
        end if
    end for
    for each tid in toRemove
        entry = m.trainData[tid]
        if entry <> invalid
            layer.removeChild(entry.dot)
            if entry.glow <> invalid
                layer.removeChild(entry.glow)
            end if
        end if
        m.trainData.delete(tid)
    end for

    ' Reset interpolation counter so dots start moving from their current spots
    m.hasData = true
    m.animStep = 0

    totalStr = Substitute(Str(total), " ", "")
    visibleStr = Substitute(Str(visible), " ", "")
    m.top.findNode("topTrains").text = visibleStr + " / " + totalStr + " TRAINS ACTIVE"
    m.top.findNode("topTime").text = localTimeStr(city.tzBase, city.dst, city.tzName)

    if data.workerVersion <> invalid
        wrkTime = ""
        if data.updatedAt <> invalid
            wrkTime = " · " + updatedAtPT(data.updatedAt)
        end if
        m.top.findNode("wrkStamp").text = "worker " + data.workerVersion + wrkTime
    end if
end sub

sub clearTrains()
    layer = m.top.findNode("trainLayer")
    for each entry in m.trainData
        if entry <> invalid
            layer.removeChild(entry.dot)
            if entry.glow <> invalid
                layer.removeChild(entry.glow)
            end if
        end if
    end for
    m.trainData = {}
    m.hasData = false
    m.animStep = 0
end sub

' Convert CSS "#RRGGBB" to a SceneGraph color string at full opacity.
Function colorFromHex(hex as String) as String
    if hex = invalid or Len(hex) < 7 then return "0xFFFFFFFF"
    return "0x" + Mid(hex, 2, 6) + "FF"
End Function

' Same color at ~47% opacity — used for the station-stop glow ring.
Function glowColor(hex as String) as String
    if hex = invalid or Len(hex) < 7 then return "0xFFFFFF77"
    return "0x" + Mid(hex, 2, 6) + "77"
End Function

' Compute local wall-clock time for the given city timezone.
' tzBase: standard UTC offset. dst: 1=north-hemi, -1=south-hemi, 0=none.
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

' Parse ISO timestamp "2026-05-31T17:42:00.000Z" → "5:42 PM PT"
Function updatedAtPT(isoStr as String) as String
    if isoStr = invalid or Len(isoStr) < 16 then return ""
    h  = Val(Mid(isoStr, 12, 2))
    mn = Val(Mid(isoStr, 15, 2))
    dt = CreateObject("roDateTime")
    month = dt.GetMonth()
    offset = -8
    if month >= 3 and month <= 11 then offset = -7
    h = (h + offset + 48) mod 24
    ampm = "AM"
    if h >= 12 then ampm = "PM"
    if h > 12  then h = h - 12
    if h = 0   then h = 12
    mStr = Str(mn).Trim()
    if mn < 10 then mStr = "0" + mStr
    return Str(h).Trim() + ":" + mStr + " " + ampm + " PT"
End Function

Function onKeyEvent(key as String, press as Boolean) as Boolean
    if not press then return false
    n = m.cities.count()
    if key = "left"
        m.fetchTimer.control = "stop"
        switchCity((m.cityIdx + n - 1) mod n)
        return true
    else if key = "right"
        m.fetchTimer.control = "stop"
        switchCity((m.cityIdx + 1) mod n)
        return true
    end if
    return false
End Function
