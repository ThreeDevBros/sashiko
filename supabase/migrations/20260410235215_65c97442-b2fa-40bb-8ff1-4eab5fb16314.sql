
CREATE POLICY "Anon can update device tokens"
ON public.push_device_tokens
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
