
Plan: Fix staff orders visibility and new-order alerts

What’s actually broken
1. Staff pages are reading `useStaffBranch()` before the provider exists. In `StaffOrders`, `StaffOrderHistory`, and `StaffReport`, the hook runs before `<StaffLayout>` mounts its `StaffBranchProvider`, so those pages get the default context (`selectedBranchId = null`). Result: the staff orders query is disabled, `pendingOrderIds` stays empty, and no alert/vibration logic runs.
2. The backend is missing staff-facing `orders` policies. Current policies only cover admin and end users. Without a branch-scoped staff `SELECT` policy, staff queries can silently return no rows, and realtime order inserts won’t reach staff clients. There is also no staff `UPDATE` policy for accepting/preparing orders.

Implementation
1. Fix the provider misuse in staff pages
- Refactor `StaffOrders`, `StaffOrderHistory`, and `StaffReport` so `useStaffBranch()` is only called inside a child component rendered within `<StaffLayout>`.
- Keep branch-scoped query keys and `.eq('branch_id', staffBranchId)` filters exactly as they are once the context is valid.

2. Add proper branch-scoped backend access for staff orders
- Create a migration adding `orders` RLS policies so authenticated staff/manager/branch_manager users can:
  - `SELECT` orders only for branches assigned to them in `staff_branches`
  - `UPDATE` orders only for branches assigned to them
- Preserve admin access and keep branch isolation strict.

3. Restore popup + vibration behavior for new orders
- After the branch context fix and RLS fix, realtime inserts should start reaching staff again.
- Strengthen `NewOrderPopup` so it also triggers haptics when a pending order popup opens, instead of relying only on the orders list hook.
- Keep the popup filtered by `payload.new.branch_id === staffBranchId`.

4. Tighten staff diagnostics
- Keep/improve explicit error states in `StaffOrders` so policy/query failures don’t look like “No orders found”.
- Add focused logging around staff branch selection and order subscription flow to make future failures obvious.

Files to change
- `src/pages/staff/StaffOrders.tsx`
- `src/pages/staff/StaffOrderHistory.tsx`
- `src/pages/staff/StaffReport.tsx`
- `src/components/staff/NewOrderPopup.tsx`
- new migration in `supabase/migrations/` for staff order RLS

Expected result
- Orders appear again in `/staff`
- New pending orders trigger realtime popup reliably
- Staff devices get vibration/haptic feedback again
- Staff can act on orders in their assigned branch only

Technical note
Recommended RLS pattern:
- Use branch-scoped policies based on `staff_branches` (or `get_staff_branch_id` where appropriate), not public access.
- Example logic: allow staff roles only when `branch_id` belongs to one of the authenticated user’s assignments.
