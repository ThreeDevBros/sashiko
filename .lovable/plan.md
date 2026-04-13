

# Fix: ETA Mismatch Between LiveOrderCountdown and Live Activity

## Problem 1: ETA Mismatch

The `computeEtaMinutes` function (used for Live Activity pushes on status changes) and `LiveOrderCountdown` (used for the in-app countdown AND the per-tick Live Activity sync via `handleRemainingMinutesChange`) use **different formulas**:

| Status | `computeEtaMinutes` (Live Activity) | `LiveOrderCountdown` (in-app + tick sync) |
|---|---|---|
| `ready` + delivery | `transitMinutes + 5` | `transitMinutes ?? 15` (no +5) |
| `out_for_delivery` | `transitMinutes \|\| null` | `transitMinutes ?? 15` |

So on every status change, the Live Activity gets `transitMinutes + 5` via the server push, but then immediately the countdown tick overrides it with `transitMinutes` (no +5) via `handleRemainingMinutesChange`. The value bounces.

**Fix**: Update `LiveOrderCountdown` to add the +5 driver pickup buffer for `ready` + delivery, matching `computeEtaMinutes` and `DeliveryTimeEstimate`.

## Problem 2: Mapping Bloat (39+ entries)

The `liveactivity_id_map` in Preferences keeps growing because entries are never pruned except on `endActivity`. On every app restart, old stale entries accumulate. This doesn't directly cause duplicate Live Activities (the Swift plugin handles that), but it's wasteful.

**Fix**: When restoring mappings, cap at a reasonable size (keep only the most recent entries).

## Files to modify

1. **`src/components/order/LiveOrderCountdown.tsx`** — Add +5 buffer for `ready` + delivery status in `remainingMinutes` calculation (line 67)
2. **`src/lib/nativeLiveActivity.ts`** — Prune old mapping entries during restore if count > 10

## Technical detail

```text
Before (ready + delivery):
  computeEtaMinutes → transitMinutes + 5
  LiveOrderCountdown → transitMinutes (no +5)
  handleRemainingMinutesChange → sends transitMinutes to Live Activity
  → Live Activity shows wrong ETA, bouncing between two values

After:
  computeEtaMinutes → transitMinutes + 5  
  LiveOrderCountdown → (transitMinutes ?? 15) + 5
  handleRemainingMinutesChange → sends transitMinutes + 5 to Live Activity
  → All sources agree
```

