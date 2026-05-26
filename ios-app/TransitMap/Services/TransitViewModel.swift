// Services/TransitViewModel.swift
// Central state: live trains, city selection, ad scheduling

import SwiftUI
import Combine

@MainActor
final class TransitViewModel: ObservableObject {

    // MARK: - Published state

    @Published var cities: [City] = []
    @Published var selectedCity: City?
    @Published var trains: [Train] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastUpdated: Date?

    // Ad state — observed by AdManager
    @Published var showAd = false
    @Published var adConfig = AdConfig(intervalSeconds: 300, durationSeconds: 30, enabled: true)

    // MARK: - Private

    private var refreshTask: Task<Void, Never>?
    private var adTimer: Timer?
    private let api = TransitAPIService.shared

    // MARK: - Lifecycle

    func onAppear() {
        Task { await bootstrap() }
    }

    func onDisappear() {
        refreshTask?.cancel()
        adTimer?.invalidate()
    }

    // MARK: - Bootstrap

    private func bootstrap() async {
        isLoading = true
        defer { isLoading = false }

        do {
            // Load config (ad settings) and city list in parallel
            async let configTask  = api.fetchConfig()
            async let citiesTask  = api.fetchCities()

            let (config, fetchedCities) = try await (configTask, citiesTask)

            adConfig = config.ads
            cities   = fetchedCities

            // Default to NYC
            selectedCity = fetchedCities.first(where: { $0.id == "nyc" }) ?? fetchedCities.first

            // Start data loop & ad timer
            startRefreshLoop()
            scheduleAdTimer()

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - City switching

    func selectCity(_ city: City) {
        guard city.id != selectedCity?.id else { return }
        selectedCity = city
        trains = []
        refreshTask?.cancel()
        startRefreshLoop()
        resetAdTimer()
    }

    // MARK: - Train refresh loop (every 20 seconds)

    private func startRefreshLoop() {
        refreshTask = Task {
            while !Task.isCancelled {
                await refreshTrains()
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    private func refreshTrains() async {
        guard let city = selectedCity else { return }
        do {
            let response = try await api.fetchTrains(cityId: city.id)
            trains       = response.trains
            lastUpdated  = Date()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Ad scheduling

    private func scheduleAdTimer() {
        guard adConfig.enabled else { return }
        adTimer = Timer.scheduledTimer(
            withTimeInterval: TimeInterval(adConfig.intervalSeconds),
            repeats: true
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.showAd = true
            }
        }
    }

    private func resetAdTimer() {
        adTimer?.invalidate()
        scheduleAdTimer()
    }

    func adDidFinish() {
        showAd = false
    }
}
