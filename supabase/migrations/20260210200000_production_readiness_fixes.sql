-- Migration: 20260210200000_production_readiness_fixes.sql
-- Purpose: Comprehensive production-readiness fixes for Antropia Desk
-- Fixes: enum types, missing RLS, CASCADE, triggers, missing columns, broken RLS policies

-- ==============================================================================
-- 1. FIX ENUM: Add missing values to notification_event_type
--    The notification_event_type_new enum was created but never applied.
--    Adding missing values allows SLA_WARNING, SLA_BREACH, REPORT, etc.
-- ==============================================================================

-- Add missing enum values (safe in PG 12+, IF NOT EXISTS prevents duplicates)
DO $$
DECLARE
  enum_name text;
  val text;
BEGIN
  -- Find the actual enum type name used by notifications.event_type
  SELECT udt_name INTO enum_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'event_type';

  IF enum_name IS NOT NULL AND EXISTS (SELECT 1 FROM pg_type WHERE typname = enum_name AND typtype = 'e') THEN
    -- Add each missing value
    FOR val IN SELECT unnest(ARRAY['SLA_WARNING', 'SLA_BREACH', 'WAITING_APPROVAL', 'APPROVAL_REMINDER_24H', 'SOLUTION_SENT', 'REPORT', 'STATUS_CHANGED', 'PRIORITY_UPDATED', 'TICKET_CUSTOMER_REPLY'])
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = enum_name::regtype AND enumlabel = val
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, val);
      END IF;
    END LOOP;
  END IF;
END $$;

-- Drop unused enum type (was created but never used)
DROP TYPE IF EXISTS notification_event_type_new;

-- ==============================================================================
-- 2. ADD MISSING COLUMNS
-- ==============================================================================

-- Add description column to tickets if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add type column to tickets if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN type TEXT DEFAULT 'REQUEST';
  END IF;
END $$;

-- Add header/footer to notification_templates if missing (used by templateService)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_templates' AND column_name = 'header'
  ) THEN
    ALTER TABLE public.notification_templates ADD COLUMN header TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_templates' AND column_name = 'footer'
  ) THEN
    ALTER TABLE public.notification_templates ADD COLUMN footer TEXT;
  END IF;
END $$;

-- Fix notifications_archive.recipient_id to allow NULL (system notifications have no recipient)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications_archive'
  ) THEN
    ALTER TABLE public.notifications_archive ALTER COLUMN recipient_id DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Column may already be nullable
END $$;

-- ==============================================================================
-- 3. FIX FOREIGN KEY CASCADE: kb_article_versions → kb_articles
-- ==============================================================================

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.kb_article_versions'::regclass
    AND confrelid = 'public.kb_articles'::regclass
    AND contype = 'f';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.kb_article_versions DROP CONSTRAINT %I', fk_name);
    ALTER TABLE public.kb_article_versions
      ADD CONSTRAINT kb_article_versions_article_id_fkey
      FOREIGN KEY (article_id) REFERENCES public.kb_articles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- ==============================================================================
-- 4. FIX NOTIFICATION_TEMPLATES RLS (scalar subquery → IN for multi-org)
-- ==============================================================================

DROP POLICY IF EXISTS "Users can view templates of their organization" ON public.notification_templates;
DROP POLICY IF EXISTS "Admins/Agents can manage templates" ON public.notification_templates;

CREATE POLICY "Users can view notification templates of their org"
  ON public.notification_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Agents can manage notification templates"
  ON public.notification_templates
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AGENT')
    )
  );

-- ==============================================================================
-- 5. ENABLE RLS ON MISSING TABLES
-- ==============================================================================

-- ---- user_dashboard_preferences (user-scoped, no org_id) ----
ALTER TABLE public.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON public.user_dashboard_preferences;
CREATE POLICY "Users can view own dashboard preferences"
  ON public.user_dashboard_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own dashboard preferences" ON public.user_dashboard_preferences;
CREATE POLICY "Users can manage own dashboard preferences"
  ON public.user_dashboard_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- ---- profiles ----
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles
  FOR SELECT
  USING (
    id IN (
      SELECT m2.user_id FROM public.memberships m1
      JOIN public.memberships m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- ---- kb_categories ----
DO $$
BEGIN
  ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can view kb categories of their org" ON public.kb_categories;
  CREATE POLICY "Users can view kb categories of their org"
    ON public.kb_categories
    FOR SELECT
    USING (
      organization_id IN (
        SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Admins and Agents can manage kb categories" ON public.kb_categories;
  CREATE POLICY "Admins and Agents can manage kb categories"
    ON public.kb_categories
    FOR ALL
    USING (
      organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AGENT')
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table kb_categories does not exist, skipping RLS';
END $$;

-- ---- kb_articles ----
DO $$
BEGIN
  ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can view kb articles of their org" ON public.kb_articles;
  CREATE POLICY "Users can view kb articles of their org"
    ON public.kb_articles
    FOR SELECT
    USING (
      organization_id IN (
        SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Admins and Agents can manage kb articles" ON public.kb_articles;
  CREATE POLICY "Admins and Agents can manage kb articles"
    ON public.kb_articles
    FOR ALL
    USING (
      organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AGENT')
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table kb_articles does not exist, skipping RLS';
END $$;

-- ---- kb_article_versions ----
DO $$
BEGIN
  ALTER TABLE public.kb_article_versions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can view article versions of their org" ON public.kb_article_versions;
  CREATE POLICY "Users can view article versions of their org"
    ON public.kb_article_versions
    FOR SELECT
    USING (
      article_id IN (
        SELECT id FROM public.kb_articles
        WHERE organization_id IN (
          SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
        )
      )
    );

  DROP POLICY IF EXISTS "Admins and Agents can manage article versions" ON public.kb_article_versions;
  CREATE POLICY "Admins and Agents can manage article versions"
    ON public.kb_article_versions
    FOR ALL
    USING (
      article_id IN (
        SELECT id FROM public.kb_articles
        WHERE organization_id IN (
          SELECT organization_id FROM public.memberships
          WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AGENT')
        )
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table kb_article_versions does not exist, skipping RLS';
END $$;

-- ---- kb_permissions ----
DO $$
BEGIN
  ALTER TABLE public.kb_permissions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Admins can manage kb permissions" ON public.kb_permissions;
  CREATE POLICY "Admins can manage kb permissions"
    ON public.kb_permissions
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.memberships
        WHERE user_id = auth.uid() AND role = 'ADMIN'
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table kb_permissions does not exist, skipping RLS';
END $$;

-- ==============================================================================
-- 6. CREATE UPDATED_AT TRIGGER FUNCTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to main tables that have updated_at column
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'tickets', 'workflows', 'integrations_config',
    'notification_templates', 'report_templates', 'organization_notification_settings',
    'organization_settings', 'kb_articles', 'profiles'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
         CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 7. ADD MISSING INDEXES FOR PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_tickets_org_updated
  ON public.tickets (organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memberships_user_org
  ON public.memberships (user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_memberships_org_role
  ON public.memberships (organization_id, role);

-- ==============================================================================
-- DONE
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Production readiness migration 20260210200000 completed successfully';
END $$;
