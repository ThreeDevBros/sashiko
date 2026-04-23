

## Disable Delivery When Out of Range + Slider-Style Order Type Selector

### Problem
On `/checkout`, when the user's address is outside the delivery radius, "Delivery" is still selectable in the Order Type card and shows a red error message. The current radio layout (two bordered boxes side by side) also feels visually heavy.

### Goal
1. When delivery isn't available (out-of-radius, or no branch coordinates / no `delivery_radius_km`), make the **Delivery** option non-selectable and auto-switch the user to **Pickup** — so the destructive red alert never appears.
2. Replace the two-card radio with a sleek **segmented slider** (single rounded pill, animated highlight thumb that slides between Delivery and Pickup).

### Changes

**`src/pages/Checkout.tsx`**

1. **Compute `deliveryAvailable`** alongside the existing `canDeliver`:
   ```ts
   // Delivery is unavailable when the chosen location is out of the branch's radius
   const deliveryAvailable = hasDeliveryLocation ? isWithinRadius : true;
   ```
   (When no address is set yet, keep Delivery selectable so the user can pick one — the existing yellow "no location" warning still applies.)

2. **Auto-switch to Pickup** when delivery becomes unavailable:
   ```ts
   useEffect(() => {
     if (!deliveryAvailable && orderType === 'delivery') {
       setOrderType('pickup');
     }
   }, [deliveryAvailable, orderType]);
   ```

3. **Replace the RadioGroup (lines 663-679)** with a segmented slider:
   - One rounded `bg-muted` container (`rounded-full p-1 relative`).
   - An absolutely-positioned `bg-primary` thumb that animates `left` / `transform` with `transition-transform duration-300 ease-out` between the two halves.
   - Two button "tabs" (Delivery, Pickup) layered on top with `z-10`, each `flex-1`, icon + label, text turns `text-primary-foreground` when active.
   - When `!deliveryAvailable`: Delivery button gets `disabled`, `opacity-40`, `cursor-not-allowed`, and a tiny "Out of range" hint underneath (replacing the destructive red alert).
   - Removes lines 712-721 (the destructive "outside our delivery area" alert) — that state can no longer occur since Delivery is disabled.

4. **Keep**: branch-paused alert, branch-closed alert, and the yellow "no location selected" alert — those still apply.

### Visual sketch
```text
Before:                          After:
┌──────────┐ ┌──────────┐        ┌──────────────────────────┐
│● Delivery│ │○ Pickup  │   →   │ [██Delivery██] [ Pickup ] │   (thumb slides)
└──────────┘ └──────────┘        └──────────────────────────┘
[red error: outside area]        Delivery dimmed + "Out of range" caption
```

### Files
- `src/pages/Checkout.tsx` — only file touched.

### Notes
- No backend / RLS / data changes.
- Existing submit-button guard (`!canDeliver && selectedAddressId`) stays as a safety net but should never trigger now since `orderType` auto-flips to pickup.
- No removal of `RadioGroup` import if used elsewhere in the file; otherwise it'll be cleaned up.

