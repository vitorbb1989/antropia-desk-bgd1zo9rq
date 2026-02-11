-- Add indexes for analytics dashboard performance
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_date ON public.tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_org_analytics ON public.tickets (organization_id);
