-- Allow admins to view all user_xp records
CREATE POLICY "Admins can view all user XP"
ON public.user_xp FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all user addresses
CREATE POLICY "Admins can view all user addresses"
ON public.user_addresses FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all XP transactions
CREATE POLICY "Admins can view all XP transactions"
ON public.xp_transactions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));