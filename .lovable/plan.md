# Lovable-Only Multi-Tenant Platform Plan

Advisory plan. No code changes yet. Approve to start Phase 1.

## Verdict

Yes — you can run this entirely inside Lovable. The only thing that physically cannot live in Lovable is the machine that compiles the iOS/Android binary and uploads it to the stores. Everything else (template code, per-client customizations, operator panel, provisioning, monitoring, "upgrade all clients" workflows) is authored in Lovable projects and executed via the GitHub + Supabase Management connectors from edge functions.

For the native build step, the operator panel will fire a generic webhook / GitHub workflow_dispatch. What sits behind that trigger (your Mac, GitHub Actions macOS runners, Codemagic, EAS) can be swapped without changing anything in Lovable.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Lovable project: TEMPLATE (this Sashiko project, cleaned) │
│  - Source of truth for shared code                          │
│  - Reads client.config.ts + src/overrides/<client>/         │
└───────────────┬─────────────────────────────────────────────┘
                │ git fork
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Lovable project per client (Client A, Client B, ...)       │
│  - Own GitHub repo, own Supabase project, own bundle IDs    │
│  - You open it in Lovable to tweak that client's UI         │
│  - Pulls template updates via automated PR                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Lovable project: OPERATOR PANEL (separate Supabase)        │
│  - clients registry table                                   │
│  - "Provision new client" wizard                            │
│  - "Upgrade all clients to template v.X" button             │
│  - Per-client metrics dashboard                             │
│  - Native build trigger (webhook — swappable)               │
└─────────────────────────────────────────────────────────────┘
```

## Roles per piece

| Piece | Where it lives | How you edit it |
|---|---|---|
| Template code | Lovable project + GitHub | Lovable chat |
| Per-client UI tweaks | That client's Lovable project | Lovable chat (open the client's project) |
| Operator panel UI | Panel Lovable project | Lovable chat |
| Provisioning (fork repo, create Supabase, seed data) | Edge function in panel, using GitHub + Supabase Management connectors | Lovable chat |
| Upgrade-all-clients | GitHub Action in template repo, dispatched by panel edge function | Lovable chat authors the workflow YAML; GitHub runs it |
| Native build + store upload | External CI runner (swappable) | Configured once outside Lovable |

## Overlay convention (per client)

```text
client.config.ts        // branding, feature flags, tenant identifiers
src/overrides/
  components/           // shadowed components (client-specific replacements)
  screens/              // client-only screens
public/branding/        // logos, splash, icons
```

Template components read `client.config.ts` for anything that varies. Overrides folder is git-ignored by rebase logic during upgrades so template updates never fight per-client custom work.

## Phased build

### Phase 1 — Template-ize Sashiko (in this project)
- Extract tenant-specific values (name, colors, bundle IDs, Supabase URL, feature flags) into `client.config.ts`.
- Establish `src/overrides/` convention with a documented resolver.
- Document "what makes a client repo": file list, required secrets, minimum Supabase schema.
- Deliverable: this repo can be forked and a new `client.config.ts` produces a fully-branded working app.

### Phase 2 — Operator panel MVP (new Lovable project)
- New Lovable project with its own Supabase (Lovable Cloud).
- `clients` table registry.
- List view + per-client detail page.
- "Provision new client" wizard — edge function calls:
  - GitHub connector → fork template repo, commit `client.config.ts`.
  - Supabase Management API → create new project, run initial migrations, return keys.
  - Writes client row to registry.
- Auth: admin-only, RBAC via `user_roles` per your standard.

### Phase 3 — Upgrade pipeline
- `.github/workflows/upgrade-client.yml` in template repo.
- Accepts a target client repo, rebases it onto template `main`, opens a PR in the client repo. Conflicts are surfaced in the PR for you to resolve in Lovable by opening the client's project.
- Panel button "Upgrade all clients to latest" → edge function loops registry and dispatches the workflow per client.

### Phase 4 — Native build trigger (swappable)
- Panel button "Build & submit iOS/Android for client X" → edge function fires a `workflow_dispatch` at a per-client repo action.
- Initially the workflow can just email/notify you to build manually on your Mac.
- Later, swap the workflow's contents for Fastlane + hosted macOS runner, or Codemagic, or EAS — the panel doesn't change.

### Phase 5 — Monitoring
- Nightly edge function in panel pulls basic metrics (order count, errors) from each client's Supabase via stored service-role keys, writes to panel Supabase for the dashboard.

### Phase 6 — Per-client custom work (ongoing)
- Open that client's Lovable project directly, edit `src/overrides/<client>/…`.
- Feature flags in `client.config.ts` toggle template features on/off per client.

## Costs you should know before starting

- **Lovable projects at 10 clients**: 1 template + 1 panel + 10 clients = 12 projects. Confirm your workspace pricing tolerates this.
- **Supabase projects at 10 clients**: 12 Supabase projects (each Lovable Cloud project = 1 Supabase project). Free tier caps and paid tier costs apply per project.
- **Secrets storage**: per-client service role keys live in panel Supabase, encrypted at rest via the secrets tool. Rotation is manual per client for now.
- **Store review time**: unchanged — every client, every submission, still goes through Apple/Google review individually.

## What I need before Phase 1

1. Approve this plan.
2. Confirm future clients' native apps go on **your** Apple/Google developer accounts or **each client's own** accounts. This changes how signing secrets are stored (one set vs. one per client) but doesn't change Lovable architecture.
3. Name the feature flags you already know you'll need (loyalty, reservations, delivery, table booking, cashback). Cheap to define now, expensive to retrofit later.

Answer those three and I'll start Phase 1 in this project.
