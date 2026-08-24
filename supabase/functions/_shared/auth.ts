/**
 * Shared authentication / authorization helpers for edge functions.
 * All Lovable-managed functions deploy with verify_jwt = false, so the JWT
 * must be validated in code.
 */

export interface AuthedUser {
  id: string;
  email?: string | null;
}

/** Resolve the caller from the Authorization header. Returns null when absent/invalid. */
export async function getCallerUser(req: Request, admin: any): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email };
}

/** Roles allowed to operate on other customers' orders/reservations. */
export const STAFF_ROLES = ['admin', 'manager', 'branch_manager', 'staff', 'delivery'];

export async function getUserRoles(admin: any, userId: string): Promise<string[]> {
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}

export async function hasAnyRole(admin: any, userId: string, roles: string[]): Promise<boolean> {
  const userRoles = await getUserRoles(admin, userId);
  return userRoles.some((r) => roles.includes(r));
}

/**
 * Require an authenticated caller holding one of `roles`.
 * Returns a Response on failure (caller should return it), or the user.
 */
export async function requireRole(
  req: Request,
  admin: any,
  roles: string[],
  corsHeaders: Record<string, string>,
): Promise<{ user: AuthedUser } | { response: Response }> {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const user = await getCallerUser(req, admin);
  if (!user) return { response: json({ error: 'Unauthorized' }, 401) };

  if (!(await hasAnyRole(admin, user.id, roles))) {
    return { response: json({ error: 'Forbidden' }, 403) };
  }

  return { user };
}
