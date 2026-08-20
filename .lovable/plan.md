# Clear the Android 16 (API 36) Policy Warning

No code changes are needed. `android/variables.gradle` already targets API 36 and `android/app/build.gradle` is at versionCode 6 / versionName 1.6. The warning stays until the API 36 bundle is actually **live in production at 100%**.

The Play Console notification "Your recent app update has been approved and is ready for you to publish" means the release passed review but has **not been published yet**.

## Steps in Play Console

1. Open **Publishing overview** (from the notification link).
2. You will see changes listed as "Ready to publish". Click **Send changes for review / Publish changes** to release them.
3. Go to **Test and release > Production** and confirm the API 36 bundle is the active release with rollout at **100%** (not halted, not staged at a lower percentage).
4. Under **Test and release > App bundle explorer**, check the live bundle's **Target SDK = 36**.
5. Confirm no older, still-active release (e.g. 1.5 targeting API 35) remains on any active track (production, open, closed, internal). Any active track with API 35 keeps the warning alive — deactivate or replace those releases too.
6. After the API 36 release is 100% live, the warning on **Policy status** clears automatically, usually within a few hours (occasionally up to ~24h).

## If it still shows after rollout is 100%

- The warning text names your "highest non-compliant target API level". If it still says 35, an older bundle is still active on some track — find it in App bundle explorer and retire that track's release.
- Play Console policy status is a cached report; it can lag a day. If the release is 100% live with target 36 on every active track and the warning persists after ~48h, use **Get support** from that same Policy status page.

## Repo note

Play Console now holds versionCode 7 (the uploaded bundle) while the repo says 6. Before the next upload, bump `android/app/build.gradle` to versionCode 8 or higher. Say the word and I can bump it now so the repo can't collide on the next build.
