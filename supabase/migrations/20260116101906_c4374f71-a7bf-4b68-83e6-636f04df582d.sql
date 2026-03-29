-- Create function to credit cashback when order is delivered
CREATE OR REPLACE FUNCTION public.credit_cashback_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  cashback_percentage numeric;
  cashback_amount numeric;
  order_user_id uuid;
BEGIN
  -- Only process when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- Get the user_id from the order
    order_user_id := NEW.user_id;
    
    -- Only credit cashback for registered users (not guest orders)
    IF order_user_id IS NOT NULL THEN
      -- Get the cashback rate from tenant_settings
      SELECT COALESCE(cashback_rate, 0) INTO cashback_percentage
      FROM public.tenant_settings
      LIMIT 1;
      
      -- Calculate cashback amount (percentage of order total)
      IF cashback_percentage > 0 THEN
        cashback_amount := (NEW.total * cashback_percentage) / 100;
        
        -- Add cashback to user's balance
        UPDATE public.profiles
        SET cashback_balance = COALESCE(cashback_balance, 0) + cashback_amount
        WHERE id = order_user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_credit_cashback_on_delivery ON public.orders;
CREATE TRIGGER trigger_credit_cashback_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_cashback_on_delivery();