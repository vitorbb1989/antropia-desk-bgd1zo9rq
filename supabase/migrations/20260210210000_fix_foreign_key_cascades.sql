-- Fix foreign key constraints: add ON DELETE CASCADE / SET NULL where missing
-- ticket_categories.organization_id -> CASCADE (deleting org removes categories)
-- notification_templates.organization_id -> CASCADE (deleting org removes templates)
-- tickets.category_id -> SET NULL (deleting category nullifies, doesn't delete ticket)

-- 1. ticket_categories.organization_id: add ON DELETE CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_categories_organization_id_fkey'
      AND table_name = 'ticket_categories'
  ) THEN
    ALTER TABLE ticket_categories DROP CONSTRAINT ticket_categories_organization_id_fkey;
  END IF;
  ALTER TABLE ticket_categories
    ADD CONSTRAINT ticket_categories_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
END $$;

-- 2. notification_templates.organization_id: add ON DELETE CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notification_templates_organization_id_fkey'
      AND table_name = 'notification_templates'
  ) THEN
    ALTER TABLE notification_templates DROP CONSTRAINT notification_templates_organization_id_fkey;
  END IF;
  ALTER TABLE notification_templates
    ADD CONSTRAINT notification_templates_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
END $$;

-- 3. tickets.category_id: add ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tickets_category_id_fkey'
      AND table_name = 'tickets'
  ) THEN
    ALTER TABLE tickets DROP CONSTRAINT tickets_category_id_fkey;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE SET NULL;
  END IF;
END $$;
