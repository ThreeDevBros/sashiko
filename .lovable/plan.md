
Goal: break the git conflict loop, then harden the repo so local iOS files stop blocking pulls.

1. Immediate recovery
- Root cause: `git stash pop` keeps re-applying generated local iOS files plus old `package.json` / `package-lock.json` edits.
- The repo already has the correct Capacitor-compatible dependency version (`@capacitor/preferences` is pinned to `~7.0.0`), so the main blocker is your local conflicted worktree.

Recommended recovery path:
```bash
git reset --hard HEAD
git clean -fd ios
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```

Important notes:
- Do not run `git stash pop` again for this iOS sync work.
- If you made any manual native-only edits inside `ios/` that you want to keep, copy them out first before `git clean -fd ios`.

2. Reconnect the native push file
- After Xcode opens, copy `scripts/PushNotificationSetup.swift` into the Xcode App group so it exists at:
  `ios/App/App/PushNotificationSetup.swift`
- Confirm `AppDelegate.swift` still calls:
  `PushNotificationSetup.shared.configure()`
- Confirm `GoogleService-Info.plist` is still in the App target.

3. Why this happened
- The build error was originally from trying to install the latest `@capacitor/preferences` (v8), which is incompatible with your Capacitor 7 project.
- The pull errors happened because your machine had unresolved/stashed local changes in:
  - `package.json`
  - `package-lock.json`
  - generated `ios/` files
- Since `ios/` is locally generated, stashing and popping it keeps recreating the same merge problems.

4. Prevent this from happening again
After approval, I would make two repo changes:
- Add `ios/` to `.gitignore` so generated native files are not accidentally staged
- Harden `scripts/setup-ios.sh` so the iOS setup follows a clean reset workflow and uses `scripts/PushNotificationSetup.swift` as the source of truth

Technical details
- `src/hooks/usePushNotifications.ts` now imports `@capacitor/preferences`
- `package.json` already pins the correct plugin major version for Capacitor 7
- The current issue is not the Swift code itself; it is the dirty git state caused by local generated native files and old lockfile changes
