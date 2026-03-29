-- Create staff shifts table
CREATE TABLE public.staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  status TEXT NOT NULL DEFAULT 'active',
  orders_handled INTEGER DEFAULT 0,
  reservations_handled INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;

-- Staff can view their own shifts
CREATE POLICY "Staff can view their own shifts"
ON public.staff_shifts
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Staff can insert their own shifts (clock in)
CREATE POLICY "Staff can create their own shifts"
ON public.staff_shifts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Staff can update their own shifts (clock out)
CREATE POLICY "Staff can update their own shifts"
ON public.staff_shifts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins and managers can manage all shifts
CREATE POLICY "Admins can manage all shifts"
ON public.staff_shifts
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Create updated_at trigger
CREATE TRIGGER handle_staff_shifts_updated_at
BEFORE UPDATE ON public.staff_shifts
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();