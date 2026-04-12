

# Plan: Make Live Activity Alert on Every Status Change

## Problem
Currently, Live Activity APNs updates are sent as **silent** pushes (no `alertTitle`, `alertBody`, or `sound`). The widget updates its content but doesn't buzz or expand on the lock screen.

## Fix

### `supabase/functions/send-order-push/index.ts` (lines 155–172)

Add `alertTitle`, `alertBody`, and `sound` to every Live Activity update payload so iOS expands the Live Activity banner and triggers haptic feedback on each status change:

```typescript
const updates = laTokens.map((t: any) => ({
  pushToken: t.push_token,
  event: isTerminal ? 'end' as const : 'update' as const,
  contentState: { ... }, // unchanged
  alertTitle: title,           // ← ADD: "Order #042 Update"
  alertBody: messageTemplate,  // ← ADD: "Preparing your food"
  sound: 'default',            // ← ADD: triggers buzz/haptic
  staleDate: ...,
  ...
}));
```

That's the only change needed. The `buildApnsPayload` helper in `apns-live-activity.ts` already supports `alertTitle`, `alertBody`, and `sound` — they just weren't being passed. Adding them will cause iOS to:

1. **Expand** the Live Activity on the lock screen with the alert
2. **Vibrate/buzz** the device (via the `sound: 'default'` trigger)
3. Show the updated status message prominently

### One file modified
- **`supabase/functions/send-order-push/index.ts`** — Add 3 fields to the Live Activity update objects

