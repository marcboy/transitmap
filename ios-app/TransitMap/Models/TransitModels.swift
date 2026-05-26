// Models/TransitModels.swift
// Core data models shared across iOS, iPadOS, tvOS

import Foundation
import CoreLocation
import SwiftUI

// MARK: - City (now defined on-device — no server needed)

struct City: Identifiable, Hashable {
    let id: String
    let name: String
    let country: String
    let center: Coordinate
    let defaultZoom: Double
    let feeds: [FeedConfig]
    let lines: [LineInfo]
}

struct FeedConfig: Hashable {
    let id: String
    let url: String
    let apiKey: String        // stored in app — free keys, no billing risk
    let apiKeyHeader: String  // e.g. "x-api-key" for MTA, "apikey" for IDFM
}

struct Coordinate: Hashable {
    let lat: Double
    let lng: Double

    var clLocation: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

struct LineInfo: Identifiable, Hashable {
    let id: String
    let name: String
    let color: String   // hex e.g. "#EE352E"

    var swiftUIColor: Color {
        Color(hex: color) ?? .gray
    }
}

// MARK: - Train (built from decoded protobuf)

struct Train: Identifiable, Hashable {
    let id: String
    let lineId: String
    let lineName: String
    let lineColor: String
    let lat: Double
    let lng: Double
    let bearing: Float?
    let speed: Float?
    let status: VehicleStatus
    let stopId: String?
    let tripId: String?
    let timestamp: UInt64
    let fetchedAt: Date

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var swiftUIColor: Color {
        Color(hex: lineColor) ?? .gray
    }

    var staleSeconds: Int {
        Int(Date().timeIntervalSince(fetchedAt))
    }

    var isStale: Bool { staleSeconds > 90 }
}

enum VehicleStatus: String {
    case incoming  = "INCOMING"
    case atStop    = "AT_STOP"
    case inTransit = "IN_TRANSIT"
}

// MARK: - Ad config (hardcoded, changeable via App Store update)

struct AdConfig {
    var intervalSeconds: Int  = 300   // 5 minutes
    var durationSeconds: Int  = 30
    var enabled: Bool         = true
}

// MARK: - Color extension

extension Color {
    init?(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard hex.count == 6, let value = UInt64(hex, radix: 16) else { return nil }
        self.init(
            red:   Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8)  & 0xFF) / 255,
            blue:  Double( value        & 0xFF) / 255
        )
    }
}
