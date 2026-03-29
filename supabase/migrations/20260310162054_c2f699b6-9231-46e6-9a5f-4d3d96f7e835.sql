
-- Add display_number column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS display_number integer;

-- Create function to assign sequential display numbers (0-999)
CREATE OR REPLACE FUNCTION public.assign_display_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  last_number integer;
BEGIN
  -- Get the last display_number used
  SELECT display_number INTO last_number
  FROM public.orders
  WHERE display_number IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_number IS NULL THEN
    NEW.display_number := 0;
  ELSE
    NEW.display_number := (last_number + 1) % 1000;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign on insert
DROP TRIGGER IF EXISTS trg_assign_display_number ON public.orders;
CREATE TRIGGER trg_assign_display_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_order_number();

-- Backfill existing orders with sequential numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS rn
  FROM public.orders
  WHERE display_number IS NULL
)
UPDATE public.orders
SET display_number = (numbered.rn % 1000)::integer
FROM numbered
WHERE orders.id = numbered.id;
