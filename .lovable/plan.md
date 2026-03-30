

## Route Protection for Admin, Staff, and Driver Routes

### Problem
In `App.tsx` (line 81), the route-protection logic returns early when there is no authenticated user:
```
if (!user || isAuthRoute || isQrMenuRoute) return;
```
This means **unauthenticated guests can navigate directly to `/admin`, `/staff`, and `/driver` routes**. While the layout components (AdminLayout, StaffLayout, DriverLayout) each show an "Access Denied" screen, the page components still load and the user is never redirected to `/auth`.

### Solution
Modify the `checkRoleAccess` function in `App.tsx` to redirect unauthenticated users to `/auth` when they try to access any protected route prefix (`/admin`, `/staff`, `/driver`).

### Changes

**File: `src/App.tsx`** (lines 78-97)
- In the `checkRoleAccess` effect, after checking for no user, add a guard: if the current path starts with `/admin`, `/staff`, or `/driver`, redirect to `/auth`.
- This catches guests before any layout or page component renders.

```typescript
const checkRoleAccess = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (isAuthRoute || isQrMenuRoute) return;

  const isProtectedPanel = location.pathname.startsWith('/admin') ||
                           location.pathname.startsWith('/staff') ||
                           location.pathname.startsWith('/driver');

  if (!user) {
    if (isProtectedPanel) {
      navigate('/auth', { replace: true });
    }
    return;
  }

  // existing role-check logic continues...
};
```

This is a single-file, minimal change. The existing layout-level checks remain as a second layer of defense for authenticated users without the correct role.

