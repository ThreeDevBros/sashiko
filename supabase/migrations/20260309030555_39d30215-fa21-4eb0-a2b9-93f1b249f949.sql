
-- Create broadcast_notifications table
CREATE TABLE public.broadcast_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  channel text NOT NULL DEFAULT 'email', -- 'email', 'push', 'both'
  status text NOT NULL DEFAULT 'draft', -- 'draft', 'sending', 'sent', 'failed'
  recipient_filter text NOT NULL DEFAULT 'all', -- 'all', 'active'
  sent_at timestamp with time zone,
  sent_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcast notifications"
  ON public.broadcast_notifications
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view broadcast notifications"
  ON public.broadcast_notifications
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
