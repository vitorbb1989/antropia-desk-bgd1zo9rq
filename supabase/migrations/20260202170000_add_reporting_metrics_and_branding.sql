-- Add metrics to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS satisfaction_comment TEXT;

-- Add logo_url to organization_notification_settings (central place for org-wide branding for reports)
ALTER TABLE public.organization_notification_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add header and footer to notification_templates for branded customization
ALTER TABLE public.notification_templates ADD COLUMN IF NOT EXISTS header TEXT;
ALTER TABLE public.notification_templates ADD COLUMN IF NOT EXISTS footer TEXT;

-- Function to calculate resolution time in hours
CREATE OR REPLACE FUNCTION calculate_resolution_time(created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE)
RETURNS NUMERIC AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
