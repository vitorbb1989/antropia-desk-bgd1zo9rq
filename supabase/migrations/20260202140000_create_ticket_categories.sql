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

-- Seed Data Function
DO $$
DECLARE
    org_rec RECORD;
BEGIN
    FOR org_rec IN SELECT id FROM organizations LOOP
        INSERT INTO ticket_categories (organization_id, name, description, sla_hours, color, slug) VALUES
        (org_rec.id, 'Bug', 'Falha técnica ou erro no funcionamento do sistema.', 24, '#EF4444', 'bug'),
        (org_rec.id, 'Financeiro', 'Questões relacionadas a pagamentos, faturas e cobranças.', 48, '#10B981', 'financeiro'),
        (org_rec.id, 'Problema Crítico', 'Interrupção total de serviços essenciais.', 24, '#DC2626', 'problema-critico'),
        (org_rec.id, 'Problema Médio', 'Dificuldade parcial que afeta a produtividade mas não impede o trabalho.', 32, '#F59E0B', 'problema-medio'),
        (org_rec.id, 'Problema Leve', 'Dúvidas gerais ou ajustes estéticos e menores.', 72, '#3B82F6', 'problema-leve'),
        (org_rec.id, 'Outros', 'Assuntos diversos não contemplados nas outras categorias.', 96, '#6B7280', 'outros');
    END LOOP;
END $$;
