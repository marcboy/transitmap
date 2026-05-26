// Services/TransitAPIService.swift
// Fetches live train data from our Cloudflare Worker

import Foundation

actor TransitAPIService {

    static let shared = TransitAPIService()

    // ⚠️ Replace with your deployed Cloudflare Worker URL
    private let baseURL = "https://transitmap-worker.YOUR-SUBDOMAIN.workers.dev"

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 15
        return URLSession(configuration: config)
    }()

    // MARK: - Public API

    func fetchCities() async throws -> [City] {
        let data = try await get("/cities")
        return try JSONDecoder().decode([City].self, from: data)
    }

    func fetchTrains(cityId: String) async throws -> TrainResponse {
        let data = try await get("/trains/\(cityId)")
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(TrainResponse.self, from: data)
    }

    func fetchConfig() async throws -> ConfigResponse {
        let data = try await get("/config")
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(ConfigResponse.self, from: data)
    }

    // MARK: - Private

    private func get(_ path: String) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.badResponse
        }
        return data
    }
}

enum APIError: LocalizedError {
    case invalidURL
    case badResponse

    var errorDescription: String? {
        switch self {
        case .invalidURL:  return "Invalid API URL"
        case .badResponse: return "Server returned an error"
        }
    }
}
