import ActivityKit
import WidgetKit
import SwiftUI

/// Live Activity widget for order tracking.
/// This file goes into the OrderTrackingWidget extension target.
/// Make sure GenericAttributes.swift is shared with this target.
struct OrderTrackingWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            let status = context.state.values["status"] ?? "pending"
            let orderNumber = context.state.values["orderNumber"] ?? "#000"
            let statusMessage = context.state.values["statusMessage"] ?? "Processing…"
            let etaText = context.state.values["etaMinutes"] ?? ""

            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(statusColor(status).opacity(0.15))
                        .frame(width: 44, height: 44)
                    Image(systemName: statusIcon(status))
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(statusColor(status))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Order \(orderNumber)")
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                    Text(statusMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                if !etaText.isEmpty, let mins = Int(etaText), mins > 0 {
                    VStack(spacing: 1) {
                        Text("\(mins)")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(statusColor(status))
                        Text("min")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .frame(minWidth: 48)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .activityBackgroundTint(.clear)

        } dynamicIsland: { context in
            let status = context.state.values["status"] ?? "pending"
            let orderNumber = context.state.values["orderNumber"] ?? "#000"
            let statusMessage = context.state.values["statusMessage"] ?? ""
            let etaText = context.state.values["etaMinutes"] ?? ""

            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: statusIcon(status))
                            .foregroundColor(statusColor(status))
                        Text(orderNumber)
                            .font(.headline)
                            .fontWeight(.bold)
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
                    Text(statusMessage)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            } compactLeading: {
                Image(systemName: statusIcon(status))
                    .foregroundColor(statusColor(status))
            } compactTrailing: {
                if !etaText.isEmpty, let mins = Int(etaText), mins > 0 {
                    Text("\(mins)m")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(statusColor(status))
                } else {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 6))
                        .foregroundColor(statusColor(status))
                }
            } minimal: {
                Image(systemName: statusIcon(status))
                    .foregroundColor(statusColor(status))
            }
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "pending":          return "clock"
        case "confirmed":        return "checkmark.circle"
        case "preparing":        return "frying.pan"
        case "ready":            return "bag.fill"
        case "out_for_delivery": return "car.fill"
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
        case "delivered":        return .green
        case "cancelled":        return .red
        default:                 return .gray
        }
    }
}
