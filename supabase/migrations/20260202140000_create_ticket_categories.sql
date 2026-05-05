CREATE TABLE ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  sla_hours INTEGER NOT NULL DEFAULT 24,
  color TEXT NOT NULL DEFAULT '#000000',
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies for ticket_categories
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories of their organization"
  ON ticket_categories
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins and Agents can manage categories"
  ON ticket_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE user_id = auth.uid() 
      AND organization_id = ticket_categories.organization_id
      AND role IN ('ADMIN', 'AGENT')
    )
  );

-- Update tickets table
ALTER TABLE tickets ADD COLUMN category_id UUID REFERENCES ticket_categories(id);
ALTER TABLE tickets ADD COLUMN due_date TIMESTAMPTZ;

-- Categories are created by admins via the application UI.
