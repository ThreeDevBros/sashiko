-- Add driver_id to orders table to track which driver is assigned
ALTER TABLE orders ADD COLUMN driver_id UUID REFERENCES auth.users(id);

-- Create table for tracking driver locations in real-time
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  heading NUMERIC, -- Direction the driver is heading (0-360 degrees)
  speed NUMERIC, -- Speed in km/h
  accuracy NUMERIC, -- GPS accuracy in meters
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_driver_locations_order_id ON driver_locations(order_id);
CREATE INDEX idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_updated_at ON driver_locations(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for driver_locations
-- Drivers can insert their own location updates
CREATE POLICY "Drivers can insert their own locations"
ON driver_locations
FOR INSERT
WITH CHECK (auth.uid() = driver_id AND has_role(auth.uid(), 'delivery'::app_role));

-- Drivers can view their own location history
CREATE POLICY "Drivers can view their own locations"
ON driver_locations
FOR SELECT
USING (auth.uid() = driver_id);

-- Customers can view driver locations for their orders
CREATE POLICY "Customers can view driver locations for their orders"
ON driver_locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = driver_locations.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Admins and staff can view all driver locations
CREATE POLICY "Staff can view all driver locations"
ON driver_locations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'staff'::app_role)
);

-- Enable realtime for driver_locations table
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;

-- Set replica identity to full to get complete row data in realtime updates
ALTER TABLE driver_locations REPLICA IDENTITY FULL;

-- Add index on orders.driver_id for faster queries
CREATE INDEX idx_orders_driver_id ON orders(driver_id);

-- Update RLS policy to allow drivers to view orders assigned to them
CREATE POLICY "Drivers can view their assigned orders"
ON orders
FOR SELECT
USING (auth.uid() = driver_id AND has_role(auth.uid(), 'delivery'::app_role));