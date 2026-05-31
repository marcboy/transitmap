sub init()
    m.top.functionName = "fetchData"
end sub

sub fetchData()
    xfer = CreateObject("roUrlTransfer")
    xfer.SetUrl(m.top.url)
    xfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    xfer.AddHeader("Accept", "application/json")

    body = xfer.GetToString()
    if body = invalid or Len(body) < 5
        m.top.result = {fetchError: "empty response"}
        return
    end if

    parsed = ParseJSON(body)
    if parsed = invalid
        m.top.result = {fetchError: "parse failed", preview: Left(body, 80)}
        return
    end if

    m.top.result = parsed
end sub
