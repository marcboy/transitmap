// Views/TransitMapView.swift
// The ambient map display — dark MapKit canvas with animated train dots

import SwiftUI
import MapKit

struct TransitMapView: View {

    @ObservedObject var vm: TransitViewModel
    @State private var region: MKCoordinateRegion = defaultNYCRegion()

    var body: some View {
        ZStack {
            // ── Map layer ────────────────────────────────────
            Map(coordinateRegion: $region, annotationItems: vm.trains) { train in
                MapAnnotation(coordinate: train.coordinate) {
                    TrainDot(train: train)
                }
            }
            .mapStyle()                       // dark ambient style (see extension below)
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 1.0), value: vm.trains.map(\.id))

            // ── Overlay UI ───────────────────────────────────
            VStack {
                HStack {
                    CityHeader(city: vm.selectedCity)
                    Spacer()
                    StatusBadge(lastUpdated: vm.lastUpdated, error: vm.errorMessage)
                }
                .padding()

                Spacer()

                LineLegend(city: vm.selectedCity)
                    .padding(.bottom, bottomPadding)
            }

            // ── Ad trigger (invisible, just drives the ad SDK) ──
            AdPresenter(trigger: vm.showAd, onDismiss: { vm.adDidFinish() })
                .frame(width: 0, height: 0)
        }
        .onAppear {
            vm.onAppear()
            AdManager.shared.preload()
            updateRegion()
        }
        .onChange(of: vm.selectedCity) { _ in updateRegion() }
    }

    // MARK: - Region

    private func updateRegion() {
        guard let city = vm.selectedCity else { return }
        withAnimation(.easeInOut(duration: 1.2)) {
            region = MKCoordinateRegion(
                center: city.center.clLocation,
                span: MKCoordinateSpan(latitudeDelta: spanFor(zoom: city.zoom),
                                       longitudeDelta: spanFor(zoom: city.zoom))
            )
        }
    }

    private func spanFor(zoom: Double) -> Double {
        // Rough approximation: zoom 12 ≈ 0.12°, zoom 13 ≈ 0.06°
        0.8 / pow(2, zoom - 10)
    }

    // MARK: - Platform layout

    private var bottomPadding: CGFloat {
        #if os(tvOS)
        return 48
        #else
        return 24
        #endif
    }

    private static func defaultNYCRegion() -> MKCoordinateRegion {
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
            span: MKCoordinateSpan(latitudeDelta: 0.12, longitudeDelta: 0.12)
        )
    }
}

// MARK: - Train Dot

struct TrainDot: View {
    let train: Train
    @State private var pulse = false

    var body: some View {
        ZStack {
            // Pulse ring for trains at a stop
            if train.status == .atStop {
                Circle()
                    .stroke(train.swiftUIColor.opacity(0.4), lineWidth: 1.5)
                    .frame(width: dotSize * 2.4, height: dotSize * 2.4)
                    .scaleEffect(pulse ? 1.3 : 1.0)
                    .opacity(pulse ? 0 : 1)
                    .animation(.easeOut(duration: 1.2).repeatForever(autoreverses: false),
                               value: pulse)
            }

            // Train circle
            Circle()
                .fill(train.swiftUIColor)
                .frame(width: dotSize, height: dotSize)
                .shadow(color: train.swiftUIColor.opacity(0.8), radius: glowRadius)
                .opacity(train.isStale ? 0.4 : 1.0)

            // Line label
            Text(train.lineName)
                .font(.system(size: labelSize, weight: .black, design: .rounded))
                .foregroundColor(labelColor(for: train.lineColor))
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .frame(width: dotSize - 2, height: dotSize - 2)
        }
        .onAppear { pulse = true }
    }

    // Larger dots on tvOS for 10-foot viewing distance
    private var dotSize: CGFloat {
        #if os(tvOS)
        return 28
        #elseif os(iPadOS)
        return 20
        #else
        return 16
        #endif
    }

    private var glowRadius: CGFloat { dotSize * 0.5 }
    private var labelSize: CGFloat  { dotSize * 0.45 }

    // Use white or black label based on background brightness
    private func labelColor(for hex: String) -> Color {
        guard let c = Color(hex: hex) else { return .white }
        // Simple luminance check — yellow lines get black text
        let isYellow = hex.uppercased().hasPrefix("FC") || hex.uppercased().hasPrefix("FF")
        return isYellow ? .black : .white
    }
}

// MARK: - City Header

struct CityHeader: View {
    let city: City?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(city?.name ?? "Transit Map")
                .font(.system(size: titleSize, weight: .black, design: .rounded))
                .foregroundColor(.white)
                .shadow(color: .black.opacity(0.8), radius: 4)

            Text("Live Train Positions")
                .font(.system(size: subtitleSize, weight: .medium, design: .monospaced))
                .foregroundColor(.white.opacity(0.6))
        }
    }

    private var titleSize: CGFloat {
        #if os(tvOS)
        return 36
        #else
        return 22
        #endif
    }

    private var subtitleSize: CGFloat {
        #if os(tvOS)
        return 18
        #else
        return 12
        #endif
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let lastUpdated: Date?
    let error: String?

    var body: some View {
        Group {
            if let error {
                Label(error, systemImage: "wifi.exclamationmark")
                    .foregroundColor(.red)
            } else if let date = lastUpdated {
                Label("Updated \(date.formatted(.relative(presentation: .named)))",
                      systemImage: "antenna.radiowaves.left.and.right")
                    .foregroundColor(.green)
            }
        }
        .font(.system(size: 12, weight: .medium, design: .monospaced))
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}

// MARK: - Line Legend

struct LineLegend: View {
    let city: City?

    var body: some View {
        if let lines = city?.lines {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(lines) { line in
                        HStack(spacing: 5) {
                            Circle()
                                .fill(line.swiftUIColor)
                                .frame(width: 12, height: 12)
                                .shadow(color: line.swiftUIColor.opacity(0.7), radius: 3)
                            Text(line.name)
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.8))
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(.black.opacity(0.5))
                        .cornerRadius(6)
                    }
                }
                .padding(.horizontal)
            }
        }
    }
}

// MARK: - Map style helper

extension View {
    @ViewBuilder
    func mapStyle() -> some View {
        if #available(iOS 17, tvOS 17, *) {
            // Native dark map style
            self.mapStyle(.standard(pointsOfInterest: .excludingAll))
                .preferredColorScheme(.dark)
        } else {
            self
        }
    }
}
