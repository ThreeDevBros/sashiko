
-- Staff-branch assignment table
CREATE TABLE public.staff_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

-- Enable RLS
ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;

-- Admins can manage all assignments
CREATE POLICY "Admins can manage staff branches"
ON public.staff_branches FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Staff can view their own assignments
CREATE POLICY "Users can view their own branch assignments"
ON public.staff_branches FOR SELECT
USING (auth.uid() = user_id);

-- Security definer function to get staff member's branch id
CREATE OR REPLACE FUNCTION public.get_staff_branch_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id
  FROM public.staff_branches
  WHERE user_id = _user_id
  LIMIT 1
$$;
