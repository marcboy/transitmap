// Views/CitySelectorView.swift
// Platform-adaptive city picker
// tvOS: full-screen grid navigated with Siri Remote
// iOS/iPadOS: sheet with list

import SwiftUI

// MARK: - City Selector (tvOS)

#if os(tvOS)
struct CitySelectorView: View {
    @ObservedObject var vm: TransitViewModel
    @Environment(\.dismiss) private var dismiss

    private let columns = [
        GridItem(.adaptive(minimum: 320), spacing: 32)
    ]

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 40) {
                Text("Select City")
                    .font(.system(size: 48, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 60)
                    .padding(.top, 60)

                LazyVGrid(columns: columns, spacing: 24) {
                    ForEach(vm.cities) { city in
                        CityCard(city: city, isSelected: city.id == vm.selectedCity?.id)
                            .onTapGesture {
                                vm.selectCity(city)
                                dismiss()
                            }
                    }
                }
                .padding(.horizontal, 60)

                Spacer()
            }
        }
    }
}

struct CityCard: View {
    let city: City
    let isSelected: Bool
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(flag(for: city.country))
                    .font(.system(size: 40))
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.system(size: 24))
                }
            }

            Text(city.name)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(.white)

            Text("\(city.lines.count) lines")
                .font(.system(size: 18, weight: .regular, design: .monospaced))
                .foregroundColor(.white.opacity(0.5))

            // Mini line color strip
            HStack(spacing: 4) {
                ForEach(city.lines.prefix(10)) { line in
                    Rectangle()
                        .fill(line.swiftUIColor)
                        .frame(height: 4)
                        .cornerRadius(2)
                }
            }
        }
        .padding(28)
        .background(focused ? Color.white.opacity(0.15) : Color.white.opacity(0.07))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(isSelected ? Color.green : (focused ? Color.white : Color.clear), lineWidth: 2)
        )
        .focusable()
        .focused($focused)
        .scaleEffect(focused ? 1.04 : 1.0)
        .animation(.spring(response: 0.3), value: focused)
    }

    private func flag(for country: String) -> String {
        switch country {
        case "US": return "🇺🇸"
        case "FR": return "🇫🇷"
        case "GB": return "🇬🇧"
        case "JP": return "🇯🇵"
        default: return "🌐"
        }
    }
}

// MARK: - City Selector (iOS / iPadOS)

#else

struct CitySelectorView: View {
    @ObservedObject var vm: TransitViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            List(vm.cities) { city in
                Button(action: {
                    vm.selectCity(city)
                    dismiss()
                }) {
                    HStack(spacing: 14) {
                        Text(flag(for: city.country))
                            .font(.system(size: 28))

                        VStack(alignment: .leading, spacing: 4) {
                            Text(city.name)
                                .font(.system(.headline, design: .rounded))
                                .foregroundColor(.primary)
                            Text("\(city.lines.count) lines")
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        if city.id == vm.selectedCity?.id {
                            Image(systemName: "checkmark")
                                .foregroundColor(.green)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Select City")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func flag(for country: String) -> String {
        switch country {
        case "US": return "🇺🇸"
        case "FR": return "🇫🇷"
        case "GB": return "🇬🇧"
        case "JP": return "🇯🇵"
        default: return "🌐"
        }
    }
}
#endif
