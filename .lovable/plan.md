# Android 16 (API 36) Target Update — Release Phase

Google Play requires apps to target Android 16 (API level 36) for updates after Nov 1, 2026. The uploaded bundle `version 7 / 1.6` already contains the API 36 fix, but it is currently **Inactive** in Play Console. The policy warning will only clear once this bundle is rolled out to production.

## Current state

- Latest production release: **6 (1.5)** — Active, 80% install base.
- Uploaded but inactive bundle: **7 (1.6)** — needs to be promoted to a release track.

## Play Console release steps

1. In **Latest releases and bundles**, click the arrow on the right of the **7 / 1.6** row (or go to **Production** > **Create release**).
2. Choose **Production** as the track.
3. Select the existing **7 / 1.6** App Bundle (AAB) for the release.
4. Fill in the release notes:
   - Title: `Target Android 16 (API 36) update`
   - Body: `Updated target SDK to Android 16 (API 36) to comply with Google Play policy.`
5. Review the release. Confirm:
   - Target SDK is **36**.
   - No new permissions or feature changes are introduced.
6. Start the **full rollout** to all countries (currently 176 of 177).
7. Wait for review. For a target-SDK-only bump, review is usually quick, but it can take from a few hours up to a couple of days.
8. Once the release is **live and rolled out to 100%**, the policy warning on the Dashboard will clear within a few hours.

## After release is live

- No code changes are needed on the repo side; the uploaded bundle already contains the API 36 target.
- Future local builds: remember that Play Console already has `versionCode 7`, so your next build must use `versionCode 8` or higher before you can upload again.

## Rollback plan

If the new release causes issues, you can pause the rollout in Play Console and re-promote the previous production release **6 (1.5)**. Note that older releases target API 35, so you can only use them temporarily; a permanent fix must still target API 36.
