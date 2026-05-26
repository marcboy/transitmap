// TransitMapApp.swift
// App entry point — wires ViewModel, AdManager, and root view

import SwiftUI
import GoogleMobileAds

@main
struct TransitMapApp: App {

    @StateObject private var vm = TransitViewModel()
    @State private var showCitySelector = false

    init() {
        // Initialize Google Mobile Ads SDK
        // Your App ID goes in Info.plist under GADApplicationIdentifier
        GADMobileAds.sharedInstance().start(completionHandler: nil)
    }

    var body: some Scene {
        WindowGroup {
            RootView(vm: vm, showCitySelector: $showCitySelector)
        }
    }
}

// MARK: - Root View

struct RootView: View {
    @ObservedObject var vm: TransitViewModel
    @Binding var showCitySelector: Bool

    var body: some View {
        ZStack {
            TransitMapView(vm: vm)

            // City selector button — position differs per platform
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    citySwitcherButton
                }
                .padding(platformPadding)
            }
        }
        #if os(tvOS)
        .sheet(isPresented: $showCitySelector) {
            CitySelectorView(vm: vm)
        }
        #else
        .sheet(isPresented: $showCitySelector) {
            CitySelectorView(vm: vm)
        }
        #endif
    }

    // MARK: - City Switcher Button

    @ViewBuilder
    private var citySwitcherButton: some View {
        Button(action: { showCitySelector = true }) {
            Label("Switch City", systemImage: "map")
                .font(.system(size: buttonFontSize, weight: .semibold, design: .rounded))
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.ultraThinMaterial)
                .cornerRadius(20)
                .foregroundColor(.white)
        }
        #if os(tvOS)
        .buttonStyle(.card)
        #endif
    }

    // MARK: - Platform sizing

    private var platformPadding: CGFloat {
        #if os(tvOS)
        return 60
        #else
        return 20
        #endif
    }

    private var buttonFontSize: CGFloat {
        #if os(tvOS)
        return 22
        #else
        return 15
        #endif
    }
}
