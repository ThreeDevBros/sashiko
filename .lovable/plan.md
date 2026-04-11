

# Plan: Fix Customer Name Inconsistencies

## Problem
The user `4c6074df-213f-4078-8deb-3c0db2a1194f` has `full_name = ''` (empty string) in their profile. All their orders also have `guest_name = NULL`. The JS fallback chain `order.profiles?.full_name || order.guest_name || 'Registered customer'` treats empty string `''` as truthy, so it displays nothing useful — but actually it displays "Registered customer" because `''` is falsy in JS... wait, `''` IS falsy in JS. So `'' || null || 'Registered customer'` = `'Registered customer'`. That's correct — the profile simply has no name set.

The real fix is two-fold:

## Step 1: Fix the empty profile name in the database
Update the profile for user `4c6074df-213f-4078-8deb-3c0db2a1194f` to pull the name from their email prefix or prompt them. Since we can see their email is `ioannisgeo22@icloud.com`, the best approach is to also look up their auth email and display it as a fallback in the admin panel when no name is available.

## Step 2: Update admin display logic to show email as last resort
Change the customer name display across all admin/staff panels to:
```
profiles.full_name || guest_name || guest_email || auth_email || 'Unknown'
```

Since the orders table doesn't store the auth email for registered users, we need to show what we have. The query already joins `profiles`, so we can also join `orders.guest_email`. For registered users with no name, show their email from the profile or a truncated user ID.

**Actually**, the simplest and most correct fix: the admin orders query should also fetch the user's email. We can't query `auth.users` from the client, but we can use `guest_email` for guest orders. For registered users, the profile doesn't have email. 

**Better approach**: Show the email from `guest_email` for guest orders, and for registered users, if `full_name` is empty, show "User (no name set)" or fetch it differently.

## Step 3: Ensure future orders always have a name
Update the checkout flow so that when an authenticated user places an order, their profile name (or checkout form name) is stored in `guest_name` as a backup, ensuring the admin always has a name to display.

## Files to change

1. **`src/pages/admin/OrderManagement.tsx`** — Update customer cell to show email fallback
2. **`src/pages/admin/StaffDashboard.tsx`** — Same fallback logic
3. **`src/pages/staff/StaffOrders.tsx`** — Same fallback logic
4. **`src/components/admin/MobileOrderCards.tsx`** — Same fallback logic
5. **`src/components/checkout/CheckoutForm.tsx`** or **`src/pages/Checkout.tsx`** — Store profile name in `guest_name` for authenticated orders as backup
6. **`supabase/functions/create-cash-order/index.ts`** — For authenticated users, populate `guest_name` from profile if available

## Concise summary of display logic change
```
// For all admin panels:
const customerName = order.user_id
  ? (order.profiles?.full_name || order.guest_name || order.guest_email || 'Registered customer')
  : (order.guest_name || order.guest_email || 'Guest');
```

This already works but the issue is that the specific user has no `full_name`, no `guest_name`, and no `guest_email` on their orders. So we need the edge function fix to populate `guest_name` from the profile for future orders, and show email-based fallback for existing ones.

