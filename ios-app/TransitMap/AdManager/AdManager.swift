// AdManager/AdManager.swift
// Google AdMob interstitial ads for iOS, iPadOS, and tvOS
//
// Setup:
//   1. Add Google-Mobile-Ads-SDK via Swift Package Manager
//      URL: https://github.com/googleads/swift-package-manager-google-mobile-ads
//   2. Add GADApplicationIdentifier to Info.plist with your AdMob App ID
//   3. Replace AD_UNIT_IDs below with your real unit IDs from AdMob dashboard

import SwiftUI
import GoogleMobileAds

// MARK: - Ad Unit IDs (replace with real IDs from AdMob)

private enum AdUnitID {
    #if os(tvOS)
    // tvOS interstitial — create in AdMob under Apps > Ad Units > Interstitial
    static let interstitial = "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
    #else
    // iOS/iPadOS interstitial
    static let interstitial = "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
    #endif

    // Test IDs (use during development — never submit with these)
    static let testInterstitial = "ca-app-pub-3940256099942544/4411468910"
}

// MARK: - AdManager

@MainActor
final class AdManager: NSObject, ObservableObject {

    static let shared = AdManager()

    @Published var isAdReady = false

    private var interstitial: GADInterstitialAd?
    private var onDismiss: (() -> Void)?

    // MARK: - Preload

    /// Call this at app launch so an ad is ready when the timer fires
    func preload() {
        let request = GADRequest()

        #if DEBUG
        let unitID = AdUnitID.testInterstitial
        #else
        let unitID = AdUnitID.interstitial
        #endif

        GADInterstitialAd.load(withAdUnitID: unitID, request: request) { [weak self] ad, error in
            Task { @MainActor [weak self] in
                if let error {
                    print("[AdManager] Preload failed: \(error.localizedDescription)")
                    self?.isAdReady = false
                    return
                }
                self?.interstitial = ad
                self?.interstitial?.fullScreenContentDelegate = self
                self?.isAdReady = true
                print("[AdManager] Ad preloaded and ready")
            }
        }
    }

    // MARK: - Present

    /// Present the interstitial. If not ready, preloads and skips this slot.
    func present(from viewController: UIViewController, onDismiss: @escaping () -> Void) {
        guard isAdReady, let ad = interstitial else {
            print("[AdManager] Ad not ready — skipping slot, preloading next")
            preload()
            onDismiss()
            return
        }

        self.onDismiss = onDismiss
        ad.present(fromRootViewController: viewController)
    }

    // MARK: - tvOS presentation (no UIViewController needed)
    #if os(tvOS)
    func presentOnTV(onDismiss: @escaping () -> Void) {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let root = windowScene.windows.first?.rootViewController else {
            onDismiss()
            return
        }
        present(from: root, onDismiss: onDismiss)
    }
    #endif
}

// MARK: - GADFullScreenContentDelegate

extension AdManager: GADFullScreenContentDelegate {

    func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        print("[AdManager] Ad dismissed")
        isAdReady = false
        onDismiss?()
        onDismiss = nil
        preload() // Preload the next one immediately
    }

    func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("[AdManager] Present failed: \(error.localizedDescription)")
        isAdReady = false
        onDismiss?()
        onDismiss = nil
        preload()
    }

    func adWillPresentFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        print("[AdManager] Ad presenting")
    }
}

// MARK: - SwiftUI wrapper for iOS/iPadOS

/// Drop this into any SwiftUI view that needs to trigger ads
struct AdPresenter: UIViewControllerRepresentable {

    let trigger: Bool
    let onDismiss: () -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        UIViewController()
    }

    func updateUIViewController(_ vc: UIViewController, context: Context) {
        guard trigger else { return }
        AdManager.shared.present(from: vc, onDismiss: onDismiss)
    }
}
