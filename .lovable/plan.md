

# Implement Native iOS Push Notifications

## Current State

The foundation is already in place:
- **Client hook** (`usePushNotifications.ts`): Requests permissions, registers with APNs/FCM, saves tokens to `push_device_tokens` table. Already called in `App.tsx`.
- **Database**: `push_device_tokens` table exists with proper RLS policies.
- **Broadcast edge function**: Already has FCM sending logic, but uses the **deprecated legacy FCM API** (`fcm.googleapis.com/fcm/send`).

**What's missing:**
1. `FCM_SERVER_KEY` secret is **not configured** — push sending silently skips.
2. The legacy FCM HTTP API is deprecated (June 2024). Should migrate to **FCM HTTP v2 API** using a service account.
3. No **order-specific push notifications** — customers don't get notified when their order status changes.
4. Foreground notification handling just logs to console instead of showing an in-app alert.

## Plan

### 1. Migrate edge function to FCM HTTP v2 API
Update `send-broadcast-notification/index.ts` to use the modern FCM v2 endpoint (`https://fcm.googleapis.com/v2/projects/{project_id}/messages:send`) with a **Google Service Account** for authentication instead of the deprecated server key.

- Replace `FCM_SERVER_KEY` with a new secret `FIREBASE_SERVICE_ACCOUNT_JSON` containing the Firebase service account JSON.
- Generate an OAuth2 access token from the service account to authenticate requests.
- Send individual messages per device token (v2 API doesn't support `registration_ids` batch).

### 2. Create order status push notification edge function
New edge function `send-order-push` that triggers when an order status changes (e.g., confirmed, preparing, ready, out for delivery, delivered). Sends a push notification to the customer's registered devices.

- Accepts `order_id` and `new_status` as input.
- Looks up the order's `user_id`, fetches their device tokens.
- Sends a contextual push message (e.g., "Your order is being prepared!").

### 3. Trigger push on order status change
Update the staff/admin order management flow to call the `send-order-push` edge function whenever an order status is updated.

### 4. Improve foreground notification handling
Update `usePushNotifications.ts` to show a toast notification when a push is received while the app is in the foreground, and navigate to the relevant order when tapped.

### 5. Request Firebase Service Account secret
Prompt you to provide the `FIREBASE_SERVICE_ACCOUNT_JSON` secret value from your Firebase project.

## What you need to do (native/Xcode side)
These are manual steps required outside Lovable:
- **Firebase Console**: Upload your APNs Authentication Key (.p8 file) under Project Settings → Cloud Messaging → iOS app.
- **Xcode**: Ensure "Push Notifications" capability is enabled in your app target.
- **GoogleService-Info.plist**: Must be present in the iOS project (you likely already have this for Google Sign-In).

## Technical Details

**FCM v2 auth flow in edge function:**
```
Service Account JSON → JWT → Exchange for OAuth2 token → POST to FCM v2 endpoint
```

**Order push message examples:**
| Status | Message |
|---|---|
| confirmed | "Your order #123 has been confirmed!" |
| preparing | "Your order #123 is being prepared" |
| ready | "Your order #123 is ready for pickup!" |
| out_for_delivery | "Your order #123 is on its way!" |
| delivered | "Your order #123 has been delivered" |

