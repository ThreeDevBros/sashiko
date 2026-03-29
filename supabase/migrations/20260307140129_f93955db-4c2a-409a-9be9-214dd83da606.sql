ALTER TABLE public.branches 
  ADD COLUMN allow_cash_pickup boolean NOT NULL DEFAULT true,
  ADD COLUMN allow_cash_delivery boolean NOT NULL DEFAULT true;