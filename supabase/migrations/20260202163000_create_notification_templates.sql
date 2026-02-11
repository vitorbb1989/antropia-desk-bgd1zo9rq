-- notification_event_type enum is already created in base schema migration
-- with all values including WAITING_APPROVAL, SLA_WARNING, SLA_BREACH, etc.

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  event_type text NOT NULL, -- Storing as text to be flexible with enum changes or strict typed
  channel text NOT NULL,    -- Storing as text 'EMAIL', 'WHATSAPP', 'SMS'
  subject_template TEXT,
  body_template TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates of their organization"
  ON notification_templates
  FOR SELECT
  USING (organization_id = (SELECT organization_id FROM memberships WHERE user_id = auth.uid()));

CREATE POLICY "Admins/Agents can manage templates"
  ON notification_templates
  FOR ALL
  USING (
    organization_id = (SELECT organization_id FROM memberships WHERE user_id = auth.uid()) 
    AND 
    EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AGENT'))
  );

-- Indexes
CREATE INDEX idx_notification_templates_org ON notification_templates(organization_id);
CREATE INDEX idx_notification_templates_event_channel ON notification_templates(organization_id, event_type, channel);
