# Sashiko → White-Label Restaurant Platform

Advisory plan. No code changes. Confirms the architecture, tells you where Lovable helps and where it hurts, and lays out a build order.

## My recommendation, in one line

**Keep Lovable for the two web apps (the template + the operator panel). Do the release/orchestration work in Claude Code on your machine.** Do NOT migrate everything off Lovable — the parts Lovable is bad at are the same parts Claude Code is good at, and vice versa. Using both is cheaper in hours than picking one.

Why not "just Claude Code for everything": you already have ~200 files of polished UI, i18n, Capacitor plumbing, Stripe, Live Activities, push, RLS, edge functions. Rewriting that outside Lovable buys you nothing. Lovable's speed advantage is exactly on the surface (screens, forms, admin CRUD) you'll keep editing per client.

Why not "just Lovable for everything": Lovable cannot submit to App Store / Play Store, cannot run Fastlane, cannot script the Supabase Management API to spin up new projects, and cannot manage N git repos at once. Those are terminal jobs.

## Target architecture

```text
                    ┌───────────────────────────┐
                    │   Operator Panel (web)    │  ← built in Lovable
                    │   your admin over all     │    (own Supabase)
                    │   clients & releases      │
                    └───────────┬───────────────┘
                                │ Supabase Mgmt API + GitHub API
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
       ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
       │ sashiko repo │  │ client-B repo│  │ client-C repo│
       │ (this one)   │  │ (fork)       │  │ (fork)       │
       └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
              │                 │                 │
       Supabase A         Supabase B        Supabase C
       iOS+Android A      iOS+Android B     iOS+Android C
```

- **Template repo** = this project, cleaned up. Source of truth for shared code.
- **Client repos** = git forks of the template. Each has its own Supabase project, its own Capacitor bundle IDs, its own store listings.
- **Overlay layer** = a small `client.config.ts` + `src/overrides/` folder per client. Branding, feature flags, custom screens live there. Everything else is inherited from the template.
- **Operator panel** = a separate Lovable project with its own Supabase. Reads a registry table of all clients, calls GitHub Actions + Supabase Management API to provision, monitor, and update them.

## Tool split (be strict about this)

| Job                                              | Tool                   | Why                                                        |
| ------------------------------------------------ | ---------------------- | ---------------------------------------------------------- |
| Edit template UI / screens / edge functions      | **Lovable (template)** | Fastest surface iteration                                  |
| Build operator panel UI (client list, deploys)   | **Lovable (panel)**    | It's just another React+Supabase app                       |
| Per-client branding & custom features            | **Lovable (client)**   | Only touches `src/overrides/` — safe from template updates |
| Spin up new Supabase project for a client        | **Claude Code**        | Supabase Management API + secrets                          |
| Fork template repo, wire secrets, first deploy   | **Claude Code**        | GitHub API + gh CLI                                        |
| Rebase a client onto latest template ("upgrade") | **Claude Code**        | Git merges must run locally, cannot be done in Lovable     |
| iOS/Android build, sign, submit                  | **Claude Code + Fastlane** | Needs Xcode/Android Studio, certs, keychain            |
| Push OTA JS-only updates (Capacitor Live Update) | Either                 | Triggered from the operator panel, executed via CI         |
| Monitor errors, uptime, revenue per client       | **Lovable (panel)**    | Reads Supabase + Sentry + Stripe APIs                      |

Rule of thumb: **if it touches a filesystem outside a Lovable sandbox (git merges, signing certs, App Store Connect), it is not a Lovable job.**

## What the operator panel actually does (built in Lovable)

Its own Supabase with a `clients` registry:

- `clients` (id, name, slug, supabase_project_ref, supabase_anon_key, github_repo, template_version, custom_domain, ios_bundle_id, android_package_id, store_status, plan, created_at)
- `client_features` (client_id, feature_key, enabled) — feature flags per client
- `client_deployments` (client_id, template_version, status, deployed_at, released_by)
- `client_metrics_daily` (client_id, orders, revenue, active_users, errors) — populated by a nightly edge function that fans out to each client's Supabase

Screens: client list, client detail, "provision new client" wizard, "upgrade to template vX" action (which fires a GitHub Actions workflow), a global feature-flag matrix, revenue & error dashboards, secret rotation. All of that is comfortable Lovable territory.

## What the template repo needs before it can be forked cleanly

The current Sashiko codebase has ~80 places where tenant details are baked in (bundle ID `com.sashiko.app`, domain `sashikoasianfusion.com`, Google client IDs in `android/app/`, tenant name in `AdminLayout`, hardcoded copy). Before fork #1, we need one pass to move all of that behind:

- `client.config.ts` — one file per client: name, bundle IDs, domains, colors, feature flags, provider IDs.
- Rename or template-ize: `capacitor.config.ts`, `AndroidManifest.xml`, `google-services.json`, iOS Info.plist, `index.html` meta, i18n brand strings, `useBranding` fallbacks.
- Move Sashiko-specific screens (if any) to `src/overrides/sashiko/` so removing them for another client is a delete, not a hunt.

This is a one-time ~1–2 day chore. Without it, every client fork will drift and "update all to latest template" is impossible.

## Phased build order

**Phase 0 — Decide & inventory (0.5 day, chat only).** Confirm this plan. List the tenant-specific hardcoded strings you're aware of.

**Phase 1 — Template-ize Sashiko (Lovable, 1–2 days).** Introduce `client.config.ts`, move hardcoded values behind it, add `src/overrides/` convention, document what a client fork must change. Sashiko itself becomes "client #1" using the new system, still deployed to the current stores — no user-visible change.

**Phase 2 — Fork tooling (Claude Code, 2–3 days).** Scripts that: create a new Supabase project via Management API, fork the template repo via GitHub API, write the new `client.config.ts`, seed initial data, wire secrets. Output: `npm run new-client -- --slug=foo` provisions a working staging copy in <10 min.

**Phase 3 — Operator panel MVP (Lovable, 3–5 days).** New Lovable project. Clients registry, list view, "provision" button that calls the Phase-2 script via a GitHub Actions dispatch, per-client metrics pulled nightly.

**Phase 4 — Store submission pipeline (Claude Code + Fastlane, 2–4 days).** One Fastlane setup per platform, reused across clients. GitHub Action that takes a client slug + version and produces signed IPAs/AABs and uploads to TestFlight / Play Internal.

**Phase 5 — "Update all to latest template" (Claude Code, 2 days).** Script that rebases each client repo onto latest template main, runs tests, opens a PR per client, and — on green + operator approval in the panel — merges and triggers a release. Overlays in `src/overrides/` survive because they don't touch template files.

**Phase 6 — Per-client custom features (Lovable, ongoing).** Each client repo is its own Lovable project. Custom UI/features live under `src/overrides/<client>/` and behind feature flags read from the panel. Never edit template files inside a client repo — that's the discipline that keeps upgrades cheap.

## Honest tradeoffs

- **Cost:** 2 Lovable projects per client (template + client fork) plus 1 for the panel. At 10 clients that's 12 projects. Not free — factor it in.
- **Custom feature request from one client:** default answer is "we build it under a feature flag in the template," not "we hack it into their fork." One-off fork-only code is where hybrid platforms die.
- **Store review is still per client, per submission.** No platform removes that.
- **The "one-line upgrade" is a lie the first two times.** Expect merge conflicts on the first 2–3 clients while you learn where the template's boundaries need to move. It settles down.

## What I'd like from you before Phase 1

1. Confirm the plan.
2. Tell me: do the future clients need to run on **your** Apple/Google developer accounts (simpler, you own the listings) or on **each client's own** developer accounts (more paperwork, cleaner ownership)? This changes Phase 4 significantly.
3. Any client-facing feature you already know will need to be a flag (loyalty on/off, reservations on/off, delivery on/off)? Cheap to list now, expensive to retrofit.
