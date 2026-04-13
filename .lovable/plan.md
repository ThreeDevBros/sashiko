

# Plan: Unify Dynamic Island Expanded View with Lock Screen Layout

## Problem
The expanded Dynamic Island (long press) uses a cramped `leading`/`trailing` split layout that clips the status message text. The lock screen/notification centre version has a much better layout with the icon circle, full status text, and ETA counter side by side.

## Fix

Replace the three `DynamicIslandExpandedRegion` blocks (leading, trailing, bottom) with a single `.bottom` region that replicates the exact same `HStack` layout used in the lock screen view — status icon in a colored circle, full status message, and ETA minutes on the right.

### `setup/swift/OrderTrackingWidgetLiveActivity.swift`

Replace the expanded region (lines 63–84) with:

```swift
DynamicIslandExpandedRegion(.bottom) {
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
}
```

Empty the `.leading` and `.trailing` regions (required by API but can contain `EmptyView()`).

### One file modified
- `setup/swift/OrderTrackingWidgetLiveActivity.swift`

