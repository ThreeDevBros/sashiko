import ActivityKit
import WidgetKit
import SwiftUI

/// Live Activity widget for order tracking.
/// This file goes into the OrderTrackingWidget extension target.
/// Make sure GenericAttributes.swift is shared with this target.
///
/// The layout intentionally mirrors the in-app tracking status pill
/// (src/components/order/TrackingStatusHero.tsx): headline + subline +
/// segmented progress rail. Wording and stage logic are kept in sync.
///
/// NOTE: Add a small app icon image named "AppIconSmall" (or reuse "AppIcon")
/// in the widget extension's asset catalog for the compact leading slot.

private let deliverySteps = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]
private let pickupSteps = ["pending", "confirmed", "preparing", "ready", "delivered"]

private func steps(for orderType: String) -> [String] {
    orderType == "delivery" ? deliverySteps : pickupSteps
}

private func headline(status: String, orderType: String) -> String {
    let isDelivery = orderType == "delivery"
    switch status {
    case "pending":          return "Sending to kitchen"
    case "confirmed":        return "Order accepted"
    case "preparing":        return "Being prepared"
    case "ready":            return "Ready"
    case "out_for_delivery": return "On the way"
    case "delivered":        return isDelivery ? "Delivered" : "Picked up"
    case "cancelled":        return "Order cancelled"
    default:                 return "Tracking order"
    }
}

private func formatEta(_ mins: Int) -> String {
    if mins <= 0 { return "Now" }
    if mins < 60 { return "\(mins) min" }
    let h = mins / 60
    let m = mins % 60
    return m > 0 ? "\(h)h \(m)m" : "\(h)h"
}

private func subline(status: String, orderType: String, etaText: String) -> String {
    let isDelivery = orderType == "delivery"
    if status == "delivered" { return "Enjoy your meal" }
    if status == "cancelled" { return "This order was cancelled" }
    if status == "pending" { return "Waiting for the restaurant to confirm" }

    guard let mins = Int(etaText) else { return "Calculating time…" }

    if mins <= 0 {
        if status == "ready" {
            return isDelivery ? "Waiting for the driver" : "Ready to collect now"
        }
        return isDelivery ? "Arriving any moment" : "Almost ready"
    }
    return "\(isDelivery ? "Arriving in" : "Ready in") \(formatEta(mins))"
}

/// Segmented progress rail — same structure as the in-app pill.
private struct ProgressRail: View {
    let status: String
    let orderType: String

    var body: some View {
        let all = steps(for: orderType)
        let currentIndex = max(0, all.firstIndex(of: status) ?? 0)
        let isSettled = status == "delivered" || status == "cancelled"

        HStack(spacing: 5) {
            ForEach(Array(all.enumerated()), id: \.offset) { index, _ in
                Capsule()
                    .fill(fillColor(index: index, currentIndex: currentIndex, isSettled: isSettled))
                    .frame(height: 5)
            }
        }
    }

    private func fillColor(index: Int, currentIndex: Int, isSettled: Bool) -> Color {
        if index < currentIndex { return .accentColor }
        if index == currentIndex { return isSettled ? .accentColor : .accentColor.opacity(0.55) }
        return Color.secondary.opacity(0.25)
    }
}

private struct TrackingPill: View {
    let status: String
    let orderType: String
    let etaText: String

    var body: some View {
        let isSettled = status == "delivered" || status == "cancelled"

        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(headline(status: status, orderType: orderType))
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text(subline(status: status, orderType: orderType, etaText: etaText))
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(isSettled ? .secondary : .accentColor)
                    .lineLimit(1)
            }

            ProgressRail(status: status, orderType: orderType)
        }
    }
}

struct OrderTrackingWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            let status = context.state.values["status"] ?? "pending"
            let orderType = context.state.values["orderType"] ?? "delivery"
            let etaText = context.state.values["etaMinutes"] ?? ""
            let orderId = context.state.values["orderId"] ?? ""

            // Lock Screen / Banner view
            TrackingPill(status: status, orderType: orderType, etaText: etaText)
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
                .activityBackgroundTint(.clear)
                .widgetURL(URL(string: "sashiko://order-tracking/\(orderId)"))

        } dynamicIsland: { context in
            let status = context.state.values["status"] ?? "pending"
            let orderType = context.state.values["orderType"] ?? "delivery"
            let etaText = context.state.values["etaMinutes"] ?? ""
            let orderId = context.state.values["orderId"] ?? ""

            return DynamicIsland {
                // Expanded — shown on long press: same pill as the lock screen
                DynamicIslandExpandedRegion(.leading) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EmptyView()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    TrackingPill(status: status, orderType: orderType, etaText: etaText)
                        .padding(.horizontal, 4)
                        .padding(.top, 2)
                }
            } compactLeading: {
                Image("AppIconSmall")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 24, height: 24)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            } compactTrailing: {
                // Estimated delivery clock time (HH:mm) in compact trailing
                if let mins = Int(etaText), mins > 0,
                   !["delivered", "cancelled"].contains(status) {
                    let deliveryTime = Date().addingTimeInterval(Double(mins) * 60)
                    Text(deliveryTime, style: .time)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.accentColor)
                        .monospacedDigit()
                } else {
                    Image(systemName: statusIcon(status))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.accentColor)
                }
            } minimal: {
                Image("AppIconSmall")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 20, height: 20)
                    .clipShape(Circle())
            }
            .widgetURL(URL(string: "sashiko://order-tracking/\(orderId)"))
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "pending":          return "clock"
        case "confirmed":        return "checkmark.circle"
        case "preparing":        return "frying.pan"
        case "ready":            return "bag.fill"
        case "out_for_delivery": return "car.fill"
        case "onTheWay":         return "car.fill"
        case "delivered":        return "checkmark.seal.fill"
        case "cancelled":        return "xmark.circle.fill"
        default:                 return "circle"
        }
    }
}
