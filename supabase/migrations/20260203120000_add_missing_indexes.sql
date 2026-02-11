-- Migration to add missing indexes for performance optimization based on Acceptance Criteria

-- Tickets: Filter by Assignee (high traffic for "My Tickets" view)
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id 
ON public.tickets (assignee_id);

-- KB Articles: Lookup by Organization and Slug (critical for public help center access)
CREATE INDEX IF NOT EXISTS idx_kb_articles_org_slug 
ON public.kb_articles (organization_id, slug);

-- Ensure we have an index for finding active tickets for SLA checks
CREATE INDEX IF NOT EXISTS idx_tickets_status_due_date 
ON public.tickets (status, due_date) 
WHERE status != 'CLOSED';

-- Index for analytics aggregation (Cost and CSAT queries)
CREATE INDEX IF NOT EXISTS idx_tickets_org_cost_csat
ON public.tickets (organization_id, estimated_cost, satisfaction_score);
