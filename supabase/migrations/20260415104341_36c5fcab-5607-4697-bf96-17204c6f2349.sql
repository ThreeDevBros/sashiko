
-- 1. Fix user_roles: Add explicit WITH CHECK to admin policy and ensure no non-admin INSERT
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add INSERT policy for order_item_modifiers scoped to order ownership
CREATE POLICY "Users can insert order item modifiers for their orders"
  ON public.order_item_modifiers
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_modifiers.order_item_id
        AND (o.user_id = auth.uid() OR (o.user_id IS NULL AND o.guest_email IS NOT NULL))
    )
  );
