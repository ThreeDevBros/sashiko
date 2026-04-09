

## Store Firebase Service Account Secret

You have the Firebase service account JSON ready. I'll request it as a secret so the edge functions can authenticate with FCM v2 for push notifications.

### Steps
1. Use the `add_secret` tool to request `FIREBASE_SERVICE_ACCOUNT_JSON` from you
2. You'll paste the entire contents of the downloaded JSON file
3. Once stored, the `send-order-push` and `send-broadcast-notification` edge functions will be able to send push notifications

