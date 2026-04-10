-- Make user_id nullable to support guest device tokens
ALTER TABLE public.push_device_tokens ALTER COLUMN user_id DROP NOT NULL;

-- Drop the old unique constraint on (user_id, token) if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_device_tokens_user_id_token_key'
  ) THEN
    ALTER TABLE public.push_device_tokens DROP CONSTRAINT push_device_tokens_user_id_token_key;
  END IF;
END $$;

-- Create a unique index on token alone (one row per device)
CREATE UNIQUE INDEX IF NOT EXISTS push_device_tokens_token_key ON public.push_device_tokens(token);

-- Allow anon and authenticated users to insert device tokens (for guest support)
CREATE POLICY "Anyone can insert device tokens"
  ON public.push_device_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow service role to read all tokens (for broadcast edge function)
CREATE POLICY "Service role can read all device tokens"
  ON public.push_device_tokens FOR SELECT
  TO service_role
  USING (true);

-- Allow service role to update tokens (to link guest tokens to users)
CREATE POLICY "Service role can update all device tokens"
  ON public.push_device_tokens FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);