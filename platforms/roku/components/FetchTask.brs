sub init()
    m.top.functionName = "fetchData"
end sub

sub fetchData()
    xfer = CreateObject("roUrlTransfer")
    xfer.SetUrl(m.top.url)
    xfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    xfer.AddHeader("Accept", "application/json")
    xfer.EnableFreshConnection(true)

    body = xfer.GetToString()
    if body <> invalid and Len(body) > 10
        parsed = ParseJSON(body)
        if parsed <> invalid
            m.top.result = parsed
        end if
    end if
end sub
