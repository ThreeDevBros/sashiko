

# Fix Plan: Live Activity Not Working + Related Bugs

## Issues Identified

### 1. Live Activity — Silent Failure (Main Issue)
The `nativeLiveActivity.ts` functions have **no debug logging** on key paths. When `areLiveActivitiesSupported()` returns `false` or the plugin isn't found, it fails silently — nothing appears in the console. This makes it impossible to diagnose from the Xcode logs you shared.

Additionally, in `CheckoutForm.tsx` (line 248-268), the code handles `current-location` but does **not** handle `selected-location` — it falls through to the Supabase query which tries to use `"selected-location"` as a UUID, causing the error.

### 2. Address UUID Error
`Error loading address: invalid input syntax for type uuid: "selected-location"` — In `CheckoutForm.tsx` line 270, the code queries `user_addresses` with `selectedAddressId` without first checking if it's `"selected-location"`. This string is not a UUID.

### 3. `delivery_address_id` Passed as Non-UUID
In `Checkout.tsx` line 441, `selectedAddressId` (which can be `"current-location"` or `"selected-location"`) is passed directly as `delivery_address_id` to the `create-payment-intent` edge function. If the DB column expects a UUID, this will fail.

---

## Plan

### Step 1: Add Debug Logging to Live Activity Bridge
In `src/lib/nativeLiveActivity.ts`:
- Add `console.log` statements in `getLiveActivityPlugin()`, `areLiveActivitiesSupported()`, and `startOrderLiveActivity()` so we can see exactly where it fails
- Log: plugin found or not, `isAvailable` result, start result or error

### Step 2: Fix `CheckoutForm.tsx` — Handle `selected-location`
Add a guard for `selectedAddressId === 'selected-location'` (similar to the existing `current-location` guard) so it doesn't fall through to the UUID-based Supabase query.

### Step 3: Fix `Checkout.tsx` — Don't Pass Non-UUID as `delivery_address_id`
Set `delivery_address_id` to `null` when `selectedAddressId` is `"current-location"` or `"selected-location"`, since these are not real DB address IDs.

---

## Technical Details

**Why Live Activity might not work even with correct Xcode setup:**
The plugin is accessed via `(Capacitor as any).Plugins?.LiveActivity`. In Capacitor 7, custom plugins using `CAPBridgedPlugin` should auto-register, but the `.m` bridge file (`CAP_PLUGIN` macro) might conflict or be insufficient. Adding logging will confirm whether the plugin is found at all. If it's not, the fix would be to ensure the plugin is properly registered (potentially removing the `.m` file since the Swift class already declares `CAPBridgedPlugin`).

**Files to modify:**
1. `src/lib/nativeLiveActivity.ts` — add logging
2. `src/components/checkout/CheckoutForm.tsx` — add `selected-location` guard
3. `src/pages/Checkout.tsx` — sanitize `delivery_address_id`

