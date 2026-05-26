// Services/TransitViewModel.swift
// Central state: live trains, city selection, ad scheduling.
// No server bootstrap needed — cities load instantly from CityConfig.

import SwiftUI

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
    let adConfig = AdConfig()   // hardcoded defaults; edit AdConfig in TransitModels.swift

    // MARK: - Private

    private var refreshTask: Task<Void, Never>?
    private var adTimer: Timer?
    private let api = TransitAPIService.shared

    // MARK: - Lifecycle

    func onAppear() {
        // Cities are local — instant, no network call
        cities = api.cities()
        selectedCity = cities.first(where: { $0.id == "nyc" }) ?? cities.first

        startRefreshLoop()
        scheduleAdTimer()
    }

    func onDisappear() {
        refreshTask?.cancel()
        adTimer?.invalidate()
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
        isLoading = trains.isEmpty   // only show spinner on first load

        do {
            trains       = try await api.fetchTrains(for: city)
            lastUpdated  = Date()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
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
