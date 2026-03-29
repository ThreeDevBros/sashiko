-- Add cashback_rate to tenant_settings (cents per euro, e.g., 5 = 5% cashback)
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS cashback_rate numeric DEFAULT 0;

-- Add cashback_balance to profiles (stored in currency units, e.g., euros)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cashback_balance numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.tenant_settings.cashback_rate IS 'Cashback percentage (e.g., 5 = 5% cashback on orders)';
COMMENT ON COLUMN public.profiles.cashback_balance IS 'User accumulated cashback balance in currency units';