// Services/TransitAPIService.swift
// Fetches live GTFS-RT protobuf directly from MTA and IDFM feeds.
// No proxy or backend server required.
//
// Requires: swift-protobuf package
// SPM URL: https://github.com/apple/swift-protobuf
// Add GtfsRealtime.pb.swift (generated from gtfs-realtime.proto) to your target.

import Foundation

actor TransitAPIService {

    static let shared = TransitAPIService()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 15
        return URLSession(configuration: config)
    }()

    // MARK: - Public API

    /// Returns all configured cities (defined locally in CityConfig.swift)
    func cities() -> [City] {
        CityConfig.all
    }

    /// Fetches and decodes live train positions for a city.
    /// Calls all of the city's feeds concurrently and merges results.
    func fetchTrains(for city: City) async throws -> [Train] {
        let now = Date()

        // Fetch all feeds concurrently
        let results = try await withThrowingTaskGroup(of: [Train].self) { group in
            for feed in city.feeds {
                group.addTask {
                    try await self.fetchFeed(feed, city: city, fetchedAt: now)
                }
            }
            var all: [Train] = []
            for try await trains in group {
                all.append(contentsOf: trains)
            }
            return all
        }

        // Filter stale positions (>3 minutes old)
        return results.filter { $0.staleSeconds < 180 }
    }

    // MARK: - Feed fetching

    private func fetchFeed(_ feed: FeedConfig, city: City, fetchedAt: Date) async throws -> [Train] {
        guard let url = URL(string: feed.url) else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.setValue(feed.apiKey, forHTTPHeaderField: feed.apiKeyHeader)

        let (data, response) = try await session.data(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.badResponse
        }

        // Decode protobuf using Swift Protobuf generated types
        let feedMessage = try TransitRealtime_FeedMessage(serializedData: data)
        return extractTrains(from: feedMessage, city: city, fetchedAt: fetchedAt)
    }

    // MARK: - Protobuf extraction

    private func extractTrains(
        from feed: TransitRealtime_FeedMessage,
        city: City,
        fetchedAt: Date
    ) -> [Train] {
        feed.entity.compactMap { entity -> Train? in
            guard entity.hasVehicle,
                  entity.vehicle.hasPosition else { return nil }

            let v   = entity.vehicle
            let pos = v.position

            // Match route ID to our line definitions
            let routeId = v.trip.routeID
            let line    = city.lines.first(where: { $0.id == routeId })

            return Train(
                id:        entity.id,
                lineId:    routeId,
                lineName:  line?.name  ?? routeId,
                lineColor: line?.color ?? "#888888",
                lat:       Double(pos.latitude),
                lng:       Double(pos.longitude),
                bearing:   pos.hasBearing  ? pos.bearing  : nil,
                speed:     pos.hasSpeed    ? pos.speed    : nil,
                status:    vehicleStatus(v.currentStatus),
                stopId:    v.hasStopID     ? v.stopID     : nil,
                tripId:    v.trip.hasTripID ? v.trip.tripID : nil,
                timestamp: v.hasTimestamp  ? v.timestamp  : 0,
                fetchedAt: fetchedAt
            )
        }
    }

    private func vehicleStatus(_ status: TransitRealtime_VehiclePosition.VehicleStopStatus) -> VehicleStatus {
        switch status {
        case .incomingAt:   return .incoming
        case .stoppedAt:    return .atStop
        case .inTransitTo:  return .inTransit
        default:            return .inTransit
        }
    }
}

// MARK: - Errors

enum APIError: LocalizedError {
    case invalidURL
    case badResponse

    var errorDescription: String? {
        switch self {
        case .invalidURL:  return "Invalid feed URL"
        case .badResponse: return "Feed returned an error"
        }
    }
}
