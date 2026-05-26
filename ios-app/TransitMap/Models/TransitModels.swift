// Models/TransitModels.swift
// Core data models shared across iOS, iPadOS, tvOS

import Foundation
import CoreLocation
import SwiftUI

// MARK: - City

struct City: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let country: String
    let center: Coordinate
    let zoom: Double
    let lines: [LineInfo]
}

struct Coordinate: Codable, Hashable {
    let lat: Double
    let lng: Double

    var clLocation: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

struct LineInfo: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let color: String   // hex string e.g. "#EE352E"

    var swiftUIColor: Color {
        Color(hex: color) ?? .gray
    }
}

// MARK: - Train

struct Train: Identifiable, Codable, Hashable {
    let id: String
    let lineId: String
    let lineName: String
    let lineColor: String
    let lat: Double
    let lng: Double
    let bearing: Double?
    let speed: Double?
    let status: VehicleStatus
    let stopId: String?
    let tripId: String?
    let timestamp: TimeInterval
    let staleSeconds: Int

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var swiftUIColor: Color {
        Color(hex: lineColor) ?? .gray
    }

    var isStale: Bool { staleSeconds > 90 }
}

enum VehicleStatus: String, Codable {
    case incoming  = "INCOMING"
    case atStop    = "AT_STOP"
    case inTransit = "IN_TRANSIT"
}

// MARK: - API Response wrappers

struct TrainResponse: Codable {
    let city: String
    let updatedAt: String
    let trains: [Train]
}

struct ConfigResponse: Codable {
    let ads: AdConfig
    let version: String
}

struct AdConfig: Codable {
    let intervalSeconds: Int
    let durationSeconds: Int
    let enabled: Bool
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
