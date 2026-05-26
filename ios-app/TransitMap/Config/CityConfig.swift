// Config/CityConfig.swift
// All city definitions live here — no server required.
// To add a city: copy a block, fill in feed URL + API key + line colors.

import Foundation

enum CityConfig {

    static let all: [City] = [nyc, paris, seattle]

    // MARK: - New York City

    static let nyc = City(
        id: "nyc",
        name: "New York City",
        country: "US",
        center: Coordinate(lat: 40.7128, lng: -74.0060),
        defaultZoom: 12,
        feeds: [
            // MTA provides 8 separate feeds by line group.
            // Get your free API key at: https://api.mta.info/#/signup
            FeedConfig(id: "1234567", url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",      apiKey: "YOUR_MTA_API_KEY", apiKeyHeader: "x-api-key"),
            FeedConfig(id: "ace",     url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",   apiKey: "YOUR_MTA_API_KEY", apiKeyHeader: "x-api-key"),
            FeedConfig(id: "bdfm",    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",  apiKey: "YOUR_MTA_API_KEY", apiKeyHeader: "x-api-key"),
            FeedConfig(id: "g",       url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",     apiKey: "YOUR_MTA_API_KEY", apiKeyHeader: "x-api-key"),
            FeedConfig(id: "jz",      url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",    apiKey: "YOUR_MTA_API_KEY", apiKeyHeader: "x-api-key"),
            FeedConfig(id: "nqrw",    url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",  apiKey: "YOUR_MTA_API_KEY", apiKeyHeader: "x-api-key"),
            FeedConfig(id: "l",       url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",     apiKey: "YOUR_MTA_API_KEY", apiKeyHeader: "x-api-key"),
            FeedConfig(id: "si",      url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si",    apiKey: "YOUR_MTA_API_KEY", apiKeyHeader: "x-api-key"),
        ],
        lines: [
            LineInfo(id: "1", name: "1",  color: "#EE352E"),
            LineInfo(id: "2", name: "2",  color: "#EE352E"),
            LineInfo(id: "3", name: "3",  color: "#EE352E"),
            LineInfo(id: "4", name: "4",  color: "#00933C"),
            LineInfo(id: "5", name: "5",  color: "#00933C"),
            LineInfo(id: "6", name: "6",  color: "#00933C"),
            LineInfo(id: "7", name: "7",  color: "#B933AD"),
            LineInfo(id: "A", name: "A",  color: "#2850AD"),
            LineInfo(id: "C", name: "C",  color: "#2850AD"),
            LineInfo(id: "E", name: "E",  color: "#2850AD"),
            LineInfo(id: "B", name: "B",  color: "#FF6319"),
            LineInfo(id: "D", name: "D",  color: "#FF6319"),
            LineInfo(id: "F", name: "F",  color: "#FF6319"),
            LineInfo(id: "M", name: "M",  color: "#FF6319"),
            LineInfo(id: "G", name: "G",  color: "#6CBE45"),
            LineInfo(id: "J", name: "J",  color: "#996633"),
            LineInfo(id: "Z", name: "Z",  color: "#996633"),
            LineInfo(id: "L", name: "L",  color: "#A7A9AC"),
            LineInfo(id: "N", name: "N",  color: "#FCCC0A"),
            LineInfo(id: "Q", name: "Q",  color: "#FCCC0A"),
            LineInfo(id: "R", name: "R",  color: "#FCCC0A"),
            LineInfo(id: "W", name: "W",  color: "#FCCC0A"),
            LineInfo(id: "S", name: "S",  color: "#808183"),
        ]
    )

    // MARK: - Paris

    static let paris = City(
        id: "paris",
        name: "Paris",
        country: "FR",
        center: Coordinate(lat: 48.8566, lng: 2.3522),
        defaultZoom: 13,
        feeds: [
            // IDFM unified feed — free key at: https://prim.iledefrance-mobilites.fr
            FeedConfig(
                id: "ratp-metro",
                url: "https://prim.iledefrance-mobilites.fr/marketplace/gtfs-rt/vehiclePositions",
                apiKey: "YOUR_IDFM_API_KEY",
                apiKeyHeader: "apikey"
            ),
        ],
        lines: [
            LineInfo(id: "1",  name: "M1",  color: "#FFCD00"),
            LineInfo(id: "2",  name: "M2",  color: "#003CA6"),
            LineInfo(id: "3",  name: "M3",  color: "#837902"),
            LineInfo(id: "3b", name: "M3b", color: "#6EC4E8"),
            LineInfo(id: "4",  name: "M4",  color: "#CF009E"),
            LineInfo(id: "5",  name: "M5",  color: "#FF7E2E"),
            LineInfo(id: "6",  name: "M6",  color: "#6ECA97"),
            LineInfo(id: "7",  name: "M7",  color: "#FA9ABA"),
            LineInfo(id: "7b", name: "M7b", color: "#6ECA97"),
            LineInfo(id: "8",  name: "M8",  color: "#E19BDF"),
            LineInfo(id: "9",  name: "M9",  color: "#B6BD00"),
            LineInfo(id: "10", name: "M10", color: "#C9910D"),
            LineInfo(id: "11", name: "M11", color: "#704B1C"),
            LineInfo(id: "12", name: "M12", color: "#007852"),
            LineInfo(id: "13", name: "M13", color: "#6EC4E8"),
            LineInfo(id: "14", name: "M14", color: "#62259D"),
        ]
    )

    // MARK: - Seattle

    static let seattle = City(
        id: "seattle",
        name: "Seattle",
        country: "US",
        center: Coordinate(lat: 47.603, lng: -122.329),
        defaultZoom: 12,
        feeds: [
            // Sound Transit OneBusAway GTFS-RT
            // Request free API key: email oba_api_key@soundtransit.org
            FeedConfig(
                id: "sound-transit",
                url: "https://api.pugetsound.onebusaway.org/api/gtfs_realtime/vehicle-positions-for-agency/40.pb",
                apiKey: "YOUR_OBA_API_KEY",
                apiKeyHeader: "key"   // passed as query param ?key=
            ),
        ],
        lines: [
            LineInfo(id: "1-Line", name: "1 Line", color: "#0091DA"), // Blue — Lynnwood to Federal Way
            LineInfo(id: "2-Line", name: "2 Line", color: "#53B0E3"), // Light Blue — Redmond to Downtown
            LineInfo(id: "T-Line", name: "T Line", color: "#E31837"), // Red — Tacoma Link
        ]
    )

    // MARK: - Future cities (uncomment and fill in)

    // static let london = City(
    //     id: "london", name: "London", country: "GB",
    //     center: Coordinate(lat: 51.5074, lng: -0.1278), defaultZoom: 12,
    //     feeds: [ FeedConfig(id: "tfl", url: "https://api.tfl.gov.uk/...", apiKey: "YOUR_TFL_KEY", apiKeyHeader: "app_key") ],
    //     lines: [ ... ]
    // )
}
