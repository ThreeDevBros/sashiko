

# Plan: Fix Cash Order Validation + Cross-Platform Compatibility

## Problem
When an authenticated user places a cash order, the client sends `guest_info` with empty `name` (from `user.user_metadata.full_name` which is `''`) and empty `phone` (not in user_metadata). The Zod schema requires `name >= 2 chars` and `phone >= 1 char`, so validation fails at line 67 — before the edge function even gets to line 128 where it would populate these fields from the profile.

The profile actually has `phone: +35799627013` but `full_name: ''` (empty).

## Fixes

### 1. Edge function: Move validation after auth resolution
**File: `supabase/functions/create-cash-order/index.ts`**

- Make `guest_info` schema fields lenient (allow empty strings) since for authenticated users the function overwrites them from the profile anyway
- OR better: split validation — validate `guest_info` strictly only when no auth user is resolved (guest checkout), and skip `guest_info` validation for authenticated users
- Simplest approach: change the `guestInfoSchema` to allow empty strings, since the edge function already handles populating from profile for auth users and rejects missing guest_info for guests at line 148

### 2. Client: Send profile data instead of user_metadata
**File: `src/components/checkout/CheckoutForm.tsx`**

- For authenticated users, fetch name/phone from the profile (which the Checkout page likely already has) instead of `user.user_metadata`
- This ensures the data sent matches what's actually in the database

### 3. Fix empty profile full_name
**Migration**: Update the profile for user `4c6074df-213f-4078-8deb-3c0db2a1194f` to have a non-empty `full_name` (from their auth metadata or order history)

### 4. Cross-platform error handling
**File: `src/components/checkout/CheckoutForm.tsx`**

- Parse edge function errors properly instead of showing `{"name":"FunctionsHttpError","context":{}}` — extract the actual error message from the response body so users see "Full name must be at least 2 characters" instead of a cryptic JSON blob
- This applies to web, Android, and iOS equally since checkout is a shared component

## Files to modify
1. `supabase/functions/create-cash-order/index.ts` — relax `guest_info` validation for authenticated users
2. `src/components/checkout/CheckoutForm.tsx` — use profile data for auth users, improve error parsing
3. Database migration — fix empty `full_name` in profiles

## Technical details
- The Zod `guestInfoSchema` currently requires `name.min(2)` and `phone.min(1)` — these will be relaxed to allow empty strings, with the edge function's existing profile-lookup logic (line 128-145) handling the real population
- The `supabase.functions.invoke` error object has the response body in `context` but it needs `await error.context.json()` to extract it — currently not being parsed
- All changes are in shared web code (React + edge function), so they work identically on iOS, Android, and web via Capacitor
