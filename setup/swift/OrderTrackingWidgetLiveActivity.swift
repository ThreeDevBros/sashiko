import ActivityKit
import WidgetKit
import SwiftUI

/// Live Activity widget for order tracking.
/// This file goes into the OrderTrackingWidget extension target.
/// Make sure GenericAttributes.swift is shared with this target.
///
/// NOTE: Add a small app icon image named "AppIconSmall" (or reuse "AppIcon")
/// in the widget extension's asset catalog for the compact leading slot.
struct OrderTrackingWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            let status = context.state.values["status"] ?? "pending"
            let statusMessage = context.state.values["statusMessage"] ?? "Processing…"
            let etaText = context.state.values["etaMinutes"] ?? ""
            let orderId = context.state.values["orderId"] ?? ""

            // Lock Screen / Banner view
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(statusColor(status).opacity(0.15))
                        .frame(width: 46, height: 46)
                    Image(systemName: statusIcon(status))
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(statusColor(status))
                }

                Text(statusMessage)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                    .lineLimit(2)

                Spacer()

                if !etaText.isEmpty, let mins = Int(etaText), mins > 0 {
                    VStack(spacing: 1) {
                        Text("\(mins)")
                            .font(.title2)
                            .fontWeight(.heavy)
                            .foregroundColor(statusColor(status))
                        Text("min")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .frame(minWidth: 48)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .activityBackgroundTint(.clear)
            .widgetURL(URL(string: "sashiko://order-tracking/\(orderId)"))

        } dynamicIsland: { context in
            let status = context.state.values["status"] ?? "pending"
            let statusMessage = context.state.values["statusMessage"] ?? ""
            let etaText = context.state.values["etaMinutes"] ?? ""
            let orderId = context.state.values["orderId"] ?? ""

            return DynamicIsland {
                // Expanded — shown on long press
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: statusIcon(status))
                            .foregroundColor(statusColor(status))
                        Text(statusMessage)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .lineLimit(2)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if !etaText.isEmpty, let mins = Int(etaText), mins > 0 {
                        Text("~\(mins) min")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(statusColor(status))
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    EmptyView()
                }
            } compactLeading: {
                // App icon in compact leading
                Image("AppIconSmall")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 24, height: 24)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            } compactTrailing: {
                // Estimated delivery clock time (HH:mm) in compact trailing
                if !etaText.isEmpty, let mins = Int(etaText), mins > 0 {
                    let deliveryTime = Date().addingTimeInterval(Double(mins) * 60)
                    Text(deliveryTime, style: .time)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(statusColor(status))
                        .monospacedDigit()
                } else {
                    // Show status icon instead of uninformative dot
                    Image(systemName: statusIcon(status))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(statusColor(status))
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

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "pending":          return .orange
        case "confirmed":        return .blue
        case "preparing":        return .orange
        case "ready":            return .green
        case "out_for_delivery": return .blue
        case "onTheWay":         return .blue
        case "delivered":        return .green
        case "cancelled":        return .red
        default:                 return .gray
        }
    }
}
