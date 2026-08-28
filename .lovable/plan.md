# Plan: White-Label Template + Developer Dashboard

## Goal
Turn the Sashiko app into a reusable restaurant-app template, and build a separate developer dashboard ("Control Center") that provisions and manages tenants (domains, Apple/Google credentials, feature toggles, global updates).

## The two projects
1. **Restaurant template** — a remix of this project, cleaned and generalised.
2. **Control Center** — a brand-new Lovable project: admin dashboard for you and your team.

---

## Phase 1 — Template cleanup (remix of Sashiko)
Remix this project, then in the remix:

- **Strip brand hardcoding** — move Sashiko-specific values (site URL in `src/config/site.ts`, app name, bundle ID `com.sashiko.app`, Capacitor config, email sender names) into `tenant_settings` + environment config. One source of truth per tenant.
- **Tenant onboarding flow** — an admin wizard in the template itself: set name, logo, colours, currency, tax, branches, domain → stored in `tenant_settings`.
- **Feature toggle table** — new `tenant_features` table (reservations, loyalty/cashback, delivery, table booking, live activities, wallet payments…) with an admin UI; UI/features read toggles and hide when off.
- **Seed scripts** — SQL seeds for a blank tenant (default settings, empty menu structure, default legal pages).
- **Docs** — `TENANT_SETUP.md` checklist: which secrets to set (Stripe, Google Maps, Apple), which Supabase config to flip.

Output: a template project where "new restaurant" = remix + run wizard + set secrets.

## Phase 2 — Control Center (new project)
New Lovable project with its own Lovable Cloud backend:

- **Auth + team roles** — you and your team only (admin/manager roles, no public signup).
- **Tenant registry** — `tenants` table: name, slug, status, template version, domain, Lovable project URL, Supabase project ref, feature toggle state, notes.
- **Domain automation** — registrar integration (Cloudflare/Porkbun API): search, buy, set DNS records from the dashboard. Stored API key as a secret. "Attach to hosting" stays a guided one-click manual step (Lovable has no domain-attach API — honest ceiling).
- **Apple automation** — store App Store Connect API key (Issuer ID, Key ID, .p8) as secrets. Edge functions call the ASC API to: create Bundle IDs, enable capabilities (push, Sign in with Apple, Apple Pay), create Service IDs, list certificates/profiles. 
- **Google checklist** — Google has no API to create OAuth clients, so the dashboard generates a per-tenant provisioning checklist with direct links and tracks completion status. Semi-automated, not fake-automated.
- **Feature toggles per tenant** — dashboard writes to each tenant's `tenant_features` via their Supabase Management API / stored service key.
- **Per-tenant custom features** — a `custom_requests` tracker: spec, status, which tenant, deployed version. (Actual custom code still ships per-tenant — the dashboard tracks it, doesn't hot-deploy it.)
- **Global updates** — version tracking: which template version each tenant runs, changelog per template release, "tenants behind latest" view. Updates propagate by you merging template changes into each tenant remix; the dashboard orchestrates and tracks this.

## Phase 3 — Native builds (later, optional)
Codemagic (or EAS-like) CI with a YAML template: inject tenant name/bundle ID/assets → builds iOS + Android and uploads to App Store Connect / Play. Dashboard triggers builds via Codemagic API. This is the biggest chunk; do it only after Phase 1–2 prove out with 1–2 real tenants.

## Realistic order
1. Remix Sashiko → Phase 1 cleanup (I do this in the remix).
2. New project → Phase 2 Control Center (auth + tenant registry first, then Apple/domain automation incrementally).
3. Onboard one real pilot tenant end-to-end to validate the flow.
4. Phase 3 CI only if volume justifies it.

## What stays manual (by platform limitation, not by choice)
- Attaching a custom domain to Lovable hosting (one click in the publish dialog per tenant).
- Creating Google OAuth clients (2 min guided checklist).
- Apple Developer account enrollment & paid agreements per organisation.
- Actual App Store review submission (can be CI-assisted later).
