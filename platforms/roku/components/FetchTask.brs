sub init()
    m.top.functionName = "fetchData"
end sub

sub fetchData()
    xfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")

    xfer.SetUrl(m.top.url)
    xfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    xfer.AddHeader("Accept", "application/json")
    xfer.SetMessagePort(port)

    if not xfer.AsyncGetToString()
        m.top.result = {fetchError: "async start failed"}
        return
    end if

    msg = wait(15000, port)

    if msg = invalid
        m.top.result = {fetchError: "timeout 15s"}
        return
    end if

    if type(msg) <> "roUrlEvent"
        m.top.result = {fetchError: "unexpected msg: " + type(msg)}
        return
    end if

    code = msg.GetResponseCode()
    if code < 200 or code > 299
        m.top.result = {fetchError: "HTTP " + Str(code).Trim()}
        return
    end if

    body = msg.GetString()
    if body = invalid or Len(body) < 5
        m.top.result = {fetchError: "empty body"}
        return
    end if

    parsed = ParseJSON(body)
    if parsed = invalid
        m.top.result = {fetchError: "JSON parse failed"}
        return
    end if

    m.top.result = parsed
end sub
