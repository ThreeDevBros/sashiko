

# Plan: Enhance All Notification Text with Order-Type Awareness

## Problem
The `statusMessages` in `send-order-push` are static and don't account for `order_type`. A delivery order marked "ready" shows "Your order is ready for pickup!" which is wrong. The proximity notification also needs polish.

## Changes

### 1. `supabase/functions/send-order-push/index.ts`
Replace the static `statusMessages` map with a function that takes `order_type` (delivery, pickup, dine_in) and returns context-appropriate, engaging text:

| Status | Delivery | Pickup | Dine-in |
|--------|----------|--------|---------|
| confirmed | Great news! Your order has been confirmed 🎉 | Great news! Your order has been confirmed 🎉 | Great news! Your order has been confirmed 🎉 |
| preparing | Our kitchen is preparing your order 👨‍🍳 | Our kitchen is preparing your order 👨‍🍳 | Our kitchen is preparing your order 👨‍🍳 |
| ready | Your order is ready and waiting for a driver 🚗 | Your order is ready for pickup! Head over whenever you're ready 🙌 | Your order is ready! Enjoy your meal 🍽️ |
| out_for_delivery | Your order is on its way to you! 🚗 | *(not used)* | *(not used)* |
| delivered | Your order has been delivered — enjoy! 😋 | Your order has been picked up — enjoy! 😋 | Your order is complete — thank you! 😋 |
| cancelled | Your order has been cancelled | Your order has been cancelled | Your order has been cancelled |

Also update the title format from plain "Order #001" to "Order #001 Update" for mid-flow statuses to feel more dynamic.

### 2. `supabase/functions/check-driver-proximity/index.ts`
Change the proximity notification:
- Title: `Your driver is almost there! 📍`  
- Body: `Order {label} — Your driver is just steps away`

### 3. Files to change

| File | Change |
|------|--------|
| `supabase/functions/send-order-push/index.ts` | Replace static `statusMessages` with order-type-aware function, update title |
| `supabase/functions/check-driver-proximity/index.ts` | Enhance proximity notification text |

