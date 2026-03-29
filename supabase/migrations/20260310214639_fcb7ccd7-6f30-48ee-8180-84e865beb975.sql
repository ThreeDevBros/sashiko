CREATE POLICY "Staff can update branch pause status"
ON public.branches
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'staff'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);