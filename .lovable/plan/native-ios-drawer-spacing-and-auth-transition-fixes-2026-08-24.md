# Native iOS drawer, spacing, and auth-transition fixes

## Goal
Stabilize the native iOS checkout and address-drawer experience, tighten the requested page spacing, simplify branch selection behavior, and provide clear full-screen feedback during sign-in and sign-out without changing ordering or authentication business rules.

## Confirmed diagnosis

- **Payment drawer jump:** the payment drawer in `CheckoutForm` is a modal Vaul drawer. Vaul 0.9.9 explicitly changes `document.body` to `position: fixed` and applies a negative `top` equal to the current scroll position on iOS Safari/WebView. Because checkout is commonly scrolled down to the payment section and contains a map near the top, that body mutation produces the visible jump/map flash. `shouldScaleBackground={false}` only disables scaling; it does not disable these body styles.
- **Address keyboard over-lift:** every homepage/order address picker uses the shared `DeliveryLocationSelector`. Vaul's `repositionInputs` behavior is enabled by default, while the browser/WebView also adjusts its visual viewport. The app additionally has a center-scrolling keyboard hook, although it is not currently wired into this selector. The fix should use one viewport strategy only and keep the drawer top bounded below the safe area.
- **Checkout spacing:** the fixed header is followed by a second safe-area spacer and then `pt-6`, stacking more vertical space than necessary. The place-order button is in normal page flow with another top margin.
- **Order spacing:** the order header's bottom padding and the menu/category container spacing stack immediately below the branch pill.
- **Other safe areas:** Homepage adds the top inset to both hero positioning and hero dimensions; Book Table and Profile combine root `pt-safe` with generous inner vertical padding.
- **Branch pill:** the requested dot is the `•` in the status text. The component always behaves as clickable, while the active-branch list is currently fetched only after opening the branch dialog.
- **Auth transitions:** auth buttons expose local loading states, but there is no app-level blurred transition overlay. Sign-out is called independently from several customer and management surfaces.

## Implementation

### 1. Eliminate the payment drawer jump
- Configure the payment-method drawer to opt out of Vaul's iOS body mutations with `noBodyStyles`, while preserving its portal, backdrop, focus trapping, dismiss behavior, and `shouldScaleBackground={false}`.
- Prevent scroll chaining inside the payment list and give the drawer a stable viewport-aware maximum height plus bottom safe-area padding.
- Capture and restore the checkout scroll position only as a defensive fallback around open/close; do not use transforms or body offsets that could move the map/header.
- Keep the fixed checkout header above the page content but beneath the modal overlay so it remains blurred/dimmed rather than disappearing.

### 2. Keep address drawers bounded when the keyboard opens
- Apply the fix once in the shared `DeliveryLocationSelector`, covering Homepage, `/order`, and `/checkout`.
- Disable Vaul's automatic input repositioning for this drawer and let the native visual viewport resize the available content area.
- Size the drawer from `visualViewport.height` while open, cap its top edge below the iOS safe area, and make only its inner results/list region scrollable.
- On input focus, scroll only the search field/results inside the drawer when needed—never center the entire drawer or scroll the document.
- Remove/avoid competing keyboard-scroll behavior for this flow and clean up viewport listeners on blur/close/unmount.

### 3. Tune the requested spacing
- **Cart:** raise the fixed checkout bar slightly above the home indicator while retaining safe-area padding; increase matching page-bottom clearance so cart content is not obscured.
- **Checkout:** replace the guessed header spacer with one exact header offset, reduce the extra content top padding, tighten the final summary/button gap, and keep the button fully inside the safe bottom region without pushing it excessively upward.
- **Order:** remove the stacked gap between `BranchInfoPill` and the category navigation while preserving the sticky category offset.
- **Homepage:** count the top inset once, reducing the oversized hero safe-area allowance without putting content under the notch.
- **Book Table and Profile:** retain notch clearance but reduce redundant inner top padding on both loaded and loading states.

### 4. Simplify branch-pill behavior
- Remove the `•` separator from all branch-pill status strings and adjust spacing so the labels still read naturally.
- Add a cached active-branch count query using the same `is_active = true` rule as the selector.
- When there is zero or one active branch, render the pill as non-interactive: no click handler, chevron, pointer cursor, hover lift, or branch dialog opening. Preserve the current visual/status information.
- Reuse the same active-branch data in the selector path where practical so count and available choices cannot disagree.

### 5. Add global sign-in/sign-out feedback
- Generalize the existing payment overlay visual into a reusable full-screen action overlay with background blur, accessible live status, spinner, and reduced-motion support.
- Add an auth-transition state at app/auth-provider level so it survives route changes and can cover every customer, admin, staff, and driver sign-out entry point.
- Show the overlay immediately before email, Google, or Apple sign-in begins and before any sign-out request; use clear copy such as “Signing you in…” and “Signing you out…”.
- Dismiss it on auth error, cancellation, or timeout; on success keep it visible through session hydration/navigation so users never see an uncertain intermediate screen.
- Preserve existing per-button disabled states to prevent duplicate actions.

## Technical constraints

- Keep the four-theme token system, safe-area utilities, native-first Capacitor behavior, and existing order/payment logic intact.
- Use existing Button/design-system components for controls; no new backend tables, policies, or edge-function changes are needed.
- Do not apply a global `noBodyStyles` change to every drawer. Scope the body-lock change to the payment drawer and the keyboard strategy to the shared address drawer so unrelated sheets retain their current behavior.
- Avoid relying on desktop emulation as proof of the iOS fixes; the decisive checks are in a native iOS build/WebView.

## Validation

1. **Native iOS payment drawer:** test from top, middle, and bottom of `/checkout`; open/close repeatedly and after scrolling. Confirm the checkout position, fixed header, and map never jump or flash above the backdrop.
2. **Native iOS address keyboard:** test Homepage, `/order`, and `/checkout`; focus/type/select/dismiss with short and long result lists. Confirm the drawer top never crosses the safe-area boundary and the entered text remains visible.
3. **Safe areas:** inspect notched and non-notched iPhone sizes plus Android/web for Cart, Checkout, Order, Homepage, Book Table, and Profile; confirm controls remain clear of system bars and content is not hidden.
4. **Branch behavior:** verify one active branch produces a static pill and multiple active branches open the selector; verify paused and out-of-radius labels no longer contain the dot.
5. **Auth transitions:** verify email/Google/Apple sign-in success, cancellation, and error, plus logout from customer, admin, staff, and driver surfaces. Confirm the overlay never gets stuck and duplicate actions are blocked.
6. Run focused lint/tests and a production build, then perform Playwright visual checks for the web layouts and interactions before the native-device checklist.
