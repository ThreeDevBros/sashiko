
Goal

Stabilize the native iOS app so it never shows template/default restaurant data during slow starts, never misclassifies signed-in users as guests, and isolate the Live Activity failure correctly.

What is actually broken

- Native auth/session restoration is racing the UI. Many screens call `supabase.auth.getUser()` on mount and immediately decide “guest vs signed-in” before the session is fully restored.
- The app is allowed to render fallback/template data. `src/hooks/useBranding.ts` returns `getDefaultBranding()` when data is missing, and `src/App.tsx` force-hides the loading screen after 6 seconds even if real data/auth are not truly ready.
- Signed-in orders can be created as guest orders if checkout runs before auth is ready. That matches your admin symptom.
- The admin/staff UI also labels some authenticated orders as “Guest” when `profiles.full_name` is empty because the fallback is `profile name -> guest name -> "Guest"`.
- The Live Activity screenshot confirms a separate native issue: JS reaches iOS, but the Capacitor plugin is not registered (`[LiveActivity] Plugin found: false`).

Plan

1. Add a single auth bootstrap layer
- Create one central auth-ready hook/context that restores session once and tracks `user`, `session`, and `isAuthReady`.
- Stop deciding guest/auth state with raw `getUser()` calls on first mount.
- Gate all auth-dependent loading/actions until `isAuthReady === true`.

2. Wire critical native flows to auth readiness
- Update these areas to wait for auth readiness before querying or deciding guest mode:
  - `src/App.tsx`
  - `src/pages/Checkout.tsx`
  - `src/components/checkout/CheckoutForm.tsx`
  - `src/pages/OrderTracking.tsx`
  - `src/components/ActiveOrderBanner.tsx`
  - `src/hooks/useSavedCards.ts`
  - `src/hooks/useRoleRedirect.ts`
  - `src/components/PhonePromptDialog.tsx`
  - `src/hooks/usePushNotifications.ts`

3. Remove runtime template fallback
- Stop using `getDefaultBranding()` as the runtime fallback for slow/offline native launches.
- Cache last-known-good branding and branch payloads locally and hydrate from that cache first.
- Keep the loading overlay up until we have either:
  - fresh real data, or
  - valid cached real data.
- If it is a first-ever launch with no cache and no network, show a retry/offline state instead of the template.

4. Prevent signed-in orders from silently becoming guest orders
- Pass an explicit “this checkout requires auth” flag from authenticated checkout flows.
- In `create-cash-order` (and any equivalent authenticated checkout function), reject the request if the client expects auth but no authenticated user is present.
- This turns the current silent failure into a safe retry instead of creating the wrong kind of order.

5. Fix admin/staff customer labeling
- Update order tables so they do not show “Guest” just because `profiles.full_name` is blank.
- Use logic based on `order.user_id` first:
  - authenticated order: show profile name or “Registered customer”
  - guest order: show guest name or “Guest”

6. Resolve Live Activity as a separate native registration issue
- Do not keep debugging JS for Live Activity until native registration is fixed.
- In Xcode, verify target membership:
  - App target: `LiveActivityPlugin.swift`, `LiveActivityPlugin.m`, `GenericAttributes.swift`
  - Widget target: `GenericAttributes.swift`, `OrderTrackingWidgetLiveActivity.swift`
- Then do a clean native rebuild. The success condition is Xcode showing `Plugin found: true`.

Verification after implementation

- Cold launch on weak internet never shows template/default restaurant content.
- Signed-in users stay signed-in consistently across launch, checkout, and order tracking.
- Orders created while signed in are stored as authenticated orders and no longer appear as guest orders in admin.
- Admin/staff UI no longer mislabels authenticated users as “Guest”.
- Xcode logs show the Live Activity plugin is registered, and the Live Activity appears on-device.

Technical details

- `src/hooks/useBranding.ts` is the main reason template content can appear now.
- `src/App.tsx` currently hides the loader too early for unreliable native startup conditions.
- `src/components/checkout/CheckoutForm.tsx` + `supabase/functions/create-cash-order/index.ts` currently allow a signed-in checkout to degrade into a guest order.
- Your screenshot confirms the Live Activity failure is native registration, not order-tracking JS logic.

Files I expect to touch after approval

- `src/App.tsx`
- `src/hooks/useBranding.ts`
- `src/hooks/useBranch.ts`
- new auth bootstrap hook/context
- `src/pages/Checkout.tsx`
- `src/components/checkout/CheckoutForm.tsx`
- `src/pages/OrderTracking.tsx`
- `src/components/ActiveOrderBanner.tsx`
- `src/hooks/useSavedCards.ts`
- `src/hooks/useRoleRedirect.ts`
- `src/components/PhonePromptDialog.tsx`
- `src/hooks/usePushNotifications.ts`
- `src/pages/admin/OrderManagement.tsx`
- `src/pages/admin/StaffDashboard.tsx`
- `supabase/functions/create-cash-order/index.ts`

Do I know what the issue is? Yes.

1. Native auth restoration is racing the UI.
2. The app can render fallback/template data instead of cached or real tenant data.
3. Signed-in checkout can silently create guest orders.
4. Live Activity is currently blocked by missing native plugin registration in Xcode.
