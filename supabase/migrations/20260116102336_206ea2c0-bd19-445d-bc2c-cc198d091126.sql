-- Add cashback_used column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cashback_used numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.orders.cashback_used IS 'Amount of cashback redeemed for this order';

-- Create function to safely deduct cashback from user balance
CREATE OR REPLACE FUNCTION public.deduct_cashback(p_user_id uuid, p_amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET cashback_balance = GREATEST(0, COALESCE(cashback_balance, 0) - p_amount)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;