## Goal

Turn Sashiko into a repeatable multi-tenant restaurant platform, manually operated until 4-5 clients justify automation. Zero risk to live Sashiko production.

## Who does what

**You (manual, in Lovable dashboard):**
1. Remix this project → name it `restaurant-template`.
2. Enable Lovable Cloud on it (fresh backend, not Sashiko's).
3. Later: create a third Lovable project for the operator panel.
4. Tell me which project you have open at each step.

**I do (inside whichever project you open):**
All code changes — `client.config.ts`, `src/overrides/` scaffolding, refactors, `docs/TEMPLATE.md`, panel UI, registry migrations, runbook screens.

I can't fork projects, switch projects, or push files across projects. Cross-project access is read-only.

## Roadmap

### STEP 1 — Prep in THIS Sashiko project (safe, no publish)
- Delete draft `client.config.ts` (it's not wired to anything yet).
- Grep for tenant-specific values: `Sashiko`, `com.sashiko.app`, `sashikoasianfusion.com`, `support@sashiko…`, hardcoded Lovable OAuth client ID, Google Maps managed-key assumptions.
- Write `docs/TEMPLATE-CANDIDATES.md` listing every hit with file:line — the checklist for STEP 3.
- Verify Sashiko's current Google Maps setup (managed connector vs. own key).
- No runtime code changes. No production risk.

### STEP 2 — You remix → `restaurant-template`
Your action only. Ping me when open.

### STEP 3 — Template refactor (in `restaurant-template`, 1-2 days)
- Add real `client.config.ts` (brand, native IDs, domain, feature flags).
- Create `src/overrides/<slug>/` convention + resolver.
- Replace every hit from TEMPLATE-CANDIDATES with `clientConfig.*` reads (React, `capacitor.config.ts`, `index.html`, edge functions).
- Write `docs/TEMPLATE.md` — the forkable checklist.
- Verify template builds and runs generic.

### STEP 4 — You create panel project → I build panel (~1 day)
- Auth + `user_roles` (admin only).
- `clients` registry: `slug`, `template_version`, `status`, `ownership`, `feature_flags` jsonb, Google Cloud project ID, key vault refs, signing cred refs.
- `audit_log` table.
- Runbook UI pages (guided manual, not automated):
  - "Provision new client" — multi-step form with copy-paste shell commands and confirmation checkboxes.
  - "Upgrade client to template vX" — shows diff steps to run manually.
  - "Trigger native build" — emits a checklist.
- No end-customer data in panel backend.

### STEP 5 — Dry run with throwaway "Test Bistro" (~half day)
Run the panel runbook end-to-end. Fix rough edges. Delete when done.

### STEP 6 — Adopt Sashiko as client #1 (~1-2 days, careful)
- Register Sashiko row in panel.
- Create new git branch in this project.
- Move Sashiko-specific code into `src/overrides/sashiko/`.
- Wire `client.config.ts`.
- Test preview must match production 1:1.
- Merge → publish web → rebuild native → resubmit to stores.

### STEP 7 — Onboard real client #2
Follow the runbook. Hours, not days (excluding Apple/Google review).

## Deferred until 4-5 clients
Automated provisioning, upgrade-all workflows, metrics dashboards, CI native builds. Not worth building for 1-2 clients.

## Key decisions locked in
- Template lives in a fresh remix, not this project.
- Sashiko stays untouched until the template is proven.
- Google Maps: per-client Google Cloud project + billing (managed key only works on `*.lovable.app`).
- Panel is registry + guided-manual runbook, no automation yet.

## Cost at 10 clients
12 Lovable projects, 12 Lovable Cloud backends, 10 Google Cloud projects, 1 shared Apple + 1 shared Google Play account.

## Open questions before STEP 1
1. Approve this roadmap?
2. Start STEP 1 in this Sashiko project now? (Just deletes the unused draft `client.config.ts` and adds an audit doc — zero production impact, no publish.)
3. Google Cloud accounts for future clients: created under your Google account with client added to billing, OR client creates their own and adds you as editor?
