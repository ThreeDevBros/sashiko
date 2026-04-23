

## Prefetch Menu, Profile & Roles at App Boot

### Current bottleneck
- **Menu** (`MenuDisplay.tsx`): `useQuery` for categories + `branch_menu_items` only fires when the user lands on `/order` — first paint shows the skeleton for ~500-1500ms.
- **Profile** (`Profile.tsx`): `loadProfile()` runs in a `useEffect` on mount — entering `/profile` shows a `LoadingScreen` until the `profiles` row arrives.
- **Admin/roles** (`useAdmin.ts`, `usePermissions.ts`): each uses local `useState` + `useEffect` — every consumer refetches `user_roles`/`user_permissions` separately, with delay on first admin/staff route entry.

### Goal
After the branch is resolved (or auth is ready), kick off these queries **in the background** via the existing React Query client. Any subsequent page visit reads instantly from the cache.

---

### Changes

**1. `src/lib/menuPrefetch.ts`** (NEW) — shared menu fetch + prefetch helper
```ts
export const fetchMenuCategories = async () => { /* same query as MenuDisplay */ };
export const fetchBranchMenuItems = async (branchId: string) => { /* same query */ };

export const prefetchMenuForBranch = (qc: QueryClient, branchId: string) => {
  qc.prefetchQuery({ queryKey: [QUERY_KEYS.MENU_CATEGORIES, branchId], queryFn: fetchMenuCategories, staleTime: 5*60*1000 });
  qc.prefetchQuery({ queryKey: [QUERY_KEYS.MENU_ITEMS, branchId], queryFn: () => fetchBranchMenuItems(branchId), staleTime: 5*60*1000 });
};
```

**2. `src/components/BranchRealtimeManager.tsx`** — call `prefetchMenuForBranch(qc, trackedBranchId)` whenever `trackedBranchId` changes (and on `branchChanged` event). One central place — fires on every branch resolve/switch, even before the user opens `/order`.

**3. `src/components/MenuDisplay.tsx`** — replace inline `queryFn`s with the new shared `fetchMenuCategories` / `fetchBranchMenuItems` so the prefetched cache is reused (same `queryKey` shape already aligns).

**4. `src/hooks/useAdmin.ts` + `src/hooks/usePermissions.ts`** — convert from `useState`/`useEffect` to `useQuery`:
- `['user-roles', userId]` — fetches `user_roles` once, shared between `useAdmin`, `usePermissions`, and the `AppRoutes` role check (which currently caches in a `useRef`).
- `['user-permissions', userId]` — fetches `user_permissions` (skipped when admin).
- `staleTime: 5min`, `gcTime: 10min`. Same return shape so consumers don't change.

**5. `src/lib/profilePrefetch.ts`** (NEW) — shared profile fetch helper + `prefetchProfile(qc, userId)` for `['profile', userId]` (selects `profiles.*`).

**6. `src/pages/Profile.tsx`** — replace local `loadProfile` `useEffect` with `useQuery(['profile', userId], …)` so the prefetched data is consumed instantly. `setFullName`/`setPhone` etc. seed from `data` via a small effect (kept for editable form state).

**7. `src/App.tsx`** (`AppContent`) — after `isAuthReady && user`, prefetch in parallel alongside the existing saved-cards/Stripe prefetch:
```ts
useEffect(() => {
  if (!isAuthReady || !user) return;
  prefetchProfile(qc, user.id);
  qc.prefetchQuery({ queryKey: ['user-roles', user.id], queryFn: () => fetchUserRoles(user.id), staleTime: 5*60*1000 });
  qc.prefetchQuery({ queryKey: ['user-permissions', user.id], queryFn: () => fetchUserPermissions(user.id), staleTime: 5*60*1000 });
}, [isAuthReady, user, qc]);
```

The `AppRoutes` role-access check also switches to reading from this cache (drops the `useRef` ad-hoc cache).

---

### Result

| Action | Before | After |
|---|---|---|
| Branch resolves at boot → user taps "Order" | 500-1500ms skeleton | Instant — menu already cached |
| Switch branch → enter `/order` | Refetch + skeleton | Prefetch kicks off on switch; usually ready before user navigates |
| Login → tap "Profile" | LoadingScreen until profile row arrives | Instant — profile prefetched |
| Admin/staff opens panel | Roles fetched on entry | Roles already in cache |
| `useAdmin` + `usePermissions` + AppRoutes role check | 3 separate `user_roles` fetches | 1 shared cached query |

### Files

**New**
- `src/lib/menuPrefetch.ts`
- `src/lib/profilePrefetch.ts`

**Edited**
- `src/components/BranchRealtimeManager.tsx` — trigger menu prefetch on branch change
- `src/components/MenuDisplay.tsx` — use shared fetchers
- `src/hooks/useAdmin.ts` — migrate to `useQuery`
- `src/hooks/usePermissions.ts` — migrate to `useQuery`
- `src/pages/Profile.tsx` — consume cached profile query
- `src/App.tsx` — prefetch profile + roles + permissions at boot; AppRoutes reads roles from cache

### Notes
- No backend / RLS / DB changes.
- All prefetches are fire-and-forget — no blocking on splash.
- Same `QUERY_KEYS.MENU_CATEGORIES` / `MENU_ITEMS` shape preserved so existing realtime invalidations continue to work.
- `prefetchQuery` is a no-op if data is already fresh, so branch realtime updates don't cause redundant fetches.
- The `branchChanged` event listener inside `MenuDisplay.tsx` (which currently calls `refetchCategories/refetchItems`) stays — it now hits cache populated by the prefetch.

