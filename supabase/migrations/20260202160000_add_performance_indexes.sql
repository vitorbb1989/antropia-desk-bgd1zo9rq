-- Migration to add indexes for performance optimization based on User Story

-- Tickets: Filter by Organization, Status and Sort by Created At
CREATE INDEX IF NOT EXISTS idx_tickets_org_status_created 
ON public.tickets (organization_id, status, created_at DESC);

-- KB Articles: Filter by Organization, Status, Category
CREATE INDEX IF NOT EXISTS idx_kb_articles_org_status_category 
ON public.kb_articles (organization_id, status, category_id);

-- Ticket Timeline: Filter by Ticket and Sort by Created At
CREATE INDEX IF NOT EXISTS idx_ticket_timeline_ticket_created 
ON public.ticket_timeline (ticket_id, created_at ASC);

-- Notifications: Filter by Organization, Recipient and Status
CREATE INDEX IF NOT EXISTS idx_notifications_org_recipient_status 
ON public.notifications (organization_id, recipient_id, status);

