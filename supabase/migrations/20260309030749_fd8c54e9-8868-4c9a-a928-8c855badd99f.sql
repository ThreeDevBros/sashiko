
-- Allow drivers to update their own location records (needed for upsert)
CREATE POLICY "Drivers can update their own locations"
  ON public.driver_locations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = driver_id AND has_role(auth.uid(), 'delivery'::app_role))
  WITH CHECK (auth.uid() = driver_id AND has_role(auth.uid(), 'delivery'::app_role));
