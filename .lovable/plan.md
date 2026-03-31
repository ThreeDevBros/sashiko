

# Fix: "Failed to update branding" — Missing tenant_settings Row

## Root Cause

The `tenant_settings` table has **zero rows**. When the Customise page loads, the query returns null, so `branding?.id` is `undefined`. The update call `.update(updates).eq('id', undefined)` fails silently or errors out, triggering the "Failed to update branding" toast.

## Solution

**Upsert instead of update**: Modify the mutation in `Customise.tsx` to handle the case where no row exists yet. Use an **upsert** pattern — if `branding?.id` exists, update; otherwise, insert a new row.

### Changes

**File: `src/pages/admin/Customise.tsx`** (lines 99-117)

Update `updateBrandingMutation` to:
1. If `branding?.id` exists, perform `.update(updates).eq('id', branding.id)` as before
2. If `branding?.id` is undefined/null, perform `.insert(updates)` to create the initial row
3. Alternatively, use `.upsert()` with a default ID

The simplest approach: change the mutation to check for `branding?.id` and either insert or update accordingly:

```typescript
mutationFn: async (updates: any) => {
  if (branding?.id) {
    const { error } = await supabase
      .from('tenant_settings')
      .update(updates)
      .eq('id', branding.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('tenant_settings')
      .insert(updates);
    if (error) throw error;
  }
},
```

This single change fixes the "Failed to update branding" error for fresh setups where no tenant_settings row exists yet.

### Also: Seed the initial row via migration

Create a migration to insert a default `tenant_settings` row so the table is never empty going forward. This is a safety net:

```sql
INSERT INTO public.tenant_settings (tenant_name)
VALUES ('Sashiko')
ON CONFLICT DO NOTHING;
```

## Files Modified

| File | Change |
|------|--------|
| `src/pages/admin/Customise.tsx` | Use insert-or-update pattern in mutation |
| Migration | Seed default tenant_settings row |

