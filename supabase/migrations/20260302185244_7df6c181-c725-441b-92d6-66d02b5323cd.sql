CREATE POLICY "Staff can view profiles for orders"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'branch_manager'::app_role)
  OR has_role(auth.uid(), 'delivery'::app_role)
);