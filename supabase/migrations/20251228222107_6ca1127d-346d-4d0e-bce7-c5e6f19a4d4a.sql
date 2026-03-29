-- Add guest_delivery_address column to orders table for guest checkout
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS guest_delivery_address TEXT;