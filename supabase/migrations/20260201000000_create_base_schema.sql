-- Migration: 20260201000000_create_base_schema.sql
-- Purpose: Create core schema (tables, enums, functions) that all other migrations depend on
-- This migration MUST run before any other migration.

-- ==============================================================================
-- 1. CREATE ENUMS
-- ==============================================================================

CREATE TYPE public.user_role AS ENUM ('ADMIN', 'AGENT', 'USER');
CREATE TYPE public.ticket_status AS ENUM ('RECEIVED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_APPROVAL', 'APPROVED', 'CLOSED');
CREATE TYPE public.ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE public.timeline_entry_type AS ENUM ('MESSAGE', 'EVENT');
CREATE TYPE public.notification_channel AS ENUM ('EMAIL', 'WHATSAPP', 'SMS');
CREATE TYPE public.notification_event_type AS ENUM (
  'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_ASSIGNED',
  'TICKET_COMMENT', 'TICKET_ATTACHMENT', 'TICKET_CLOSED',
  'MENTION', 'TEST',
  'WAITING_APPROVAL', 'APPROVAL_REMINDER_24H', 'SOLUTION_SENT',
  'SLA_WARNING', 'SLA_BREACH', 'REPORT',
  'STATUS_CHANGED', 'PRIORITY_UPDATED', 'TICKET_CUSTOMER_REPLY'
);
CREATE TYPE public.notification_status AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'EXPIRED', 'CANCELLED');

-- ==============================================================================
-- 2. CREATE CORE TABLES
-- ==============================================================================

-- ---- organizations ----
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organizations_slug ON public.organizations (slug);

-- ---- profiles ----
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- memberships ----
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_memberships_user_id ON public.memberships (user_id);
CREATE INDEX idx_memberships_org_id ON public.memberships (organization_id);

-- ---- tickets (core columns only — later migrations add category_id, due_date, tags, etc.) ----
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  requester_id UUID NOT NULL,
  assignee_id UUID,
  title TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'RECEIVED',
  priority public.ticket_priority NOT NULL DEFAULT 'MEDIUM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_org_id ON public.tickets (organization_id);
CREATE INDEX idx_tickets_status ON public.tickets (status);
CREATE INDEX idx_tickets_assignee ON public.tickets (assignee_id);
CREATE INDEX idx_tickets_requester ON public.tickets (requester_id);

-- ---- ticket_timeline ----
CREATE TABLE public.ticket_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  sender_id UUID,
  entry_type public.timeline_entry_type NOT NULL DEFAULT 'MESSAGE',
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_ticket ON public.ticket_timeline (ticket_id, created_at);
CREATE INDEX idx_timeline_org ON public.ticket_timeline (organization_id);

-- ---- attachments ----
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_ext TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'attachments',
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_ticket ON public.attachments (ticket_id);

-- ---- notifications ----
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  event_type public.notification_event_type NOT NULL,
  channel public.notification_channel NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'PENDING',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  template_data JSONB,
  external_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_org ON public.notifications (organization_id);
CREATE INDEX idx_notifications_recipient ON public.notifications (recipient_id);
CREATE INDEX idx_notifications_status ON public.notifications (status);
CREATE INDEX idx_notifications_status_created ON public.notifications (status, created_at) WHERE status = 'PENDING';

-- ---- notifications_archive ----
CREATE TABLE public.notifications_archive (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  ticket_id UUID,
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  event_type public.notification_event_type NOT NULL,
  channel public.notification_channel NOT NULL,
  status public.notification_status NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  template_data JSONB,
  external_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- organization_notification_settings ----
CREATE TABLE public.organization_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  smtp_enabled BOOLEAN NOT NULL DEFAULT false,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN,
  smtp_from_email TEXT,
  smtp_from_name TEXT,
  resend_enabled BOOLEAN NOT NULL DEFAULT false,
  resend_api_key TEXT,
  resend_from_email TEXT,
  resend_from_name TEXT,
  fallback_to_resend BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_provider TEXT,
  sms_api_key TEXT,
  sms_from_number TEXT,
  whatsapp_cloud_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_cloud_access_token TEXT,
  whatsapp_cloud_phone_number_id TEXT,
  whatsapp_cloud_waba_id TEXT,
  evolution_enabled BOOLEAN NOT NULL DEFAULT false,
  evolution_api_url TEXT,
  evolution_api_key TEXT,
  evolution_instance_name TEXT,
  test_mode BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- organization_settings ----
CREATE TABLE public.organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'attachments',
  max_attachment_bytes INTEGER NOT NULL DEFAULT 10485760,
  allowed_extensions TEXT[] NOT NULL DEFAULT '{pdf,jpg,jpeg,png,gif,doc,docx,xls,xlsx,txt}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- user_notification_preferences ----
CREATE TABLE public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  email_address TEXT,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  phone_number TEXT,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  digest_mode BOOLEAN NOT NULL DEFAULT false,
  digest_frequency TEXT,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  notify_on_ticket_created BOOLEAN NOT NULL DEFAULT true,
  notify_on_ticket_updated BOOLEAN NOT NULL DEFAULT true,
  notify_on_ticket_assigned BOOLEAN NOT NULL DEFAULT true,
  notify_on_ticket_closed BOOLEAN NOT NULL DEFAULT true,
  notify_on_new_message BOOLEAN NOT NULL DEFAULT true,
  notify_on_new_attachment BOOLEAN NOT NULL DEFAULT true,
  notify_on_mention BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

-- ---- kb_categories ----
CREATE TABLE public.kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_categories_org ON public.kb_categories (organization_id);

-- ---- kb_articles ----
CREATE TABLE public.kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  tags TEXT[],
  views_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_articles_org ON public.kb_articles (organization_id);
CREATE INDEX idx_kb_articles_category ON public.kb_articles (category_id);
CREATE INDEX idx_kb_articles_status ON public.kb_articles (status);

-- ---- kb_article_versions ----
CREATE TABLE public.kb_article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  tags TEXT[],
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_versions_article ON public.kb_article_versions (article_id, created_at DESC);

-- ---- kb_permissions ----
CREATE TABLE public.kb_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_publish BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. HELPER FUNCTIONS (needed by RLS policies and application)
-- ==============================================================================

-- Return IDs of organizations the current user belongs to
CREATE OR REPLACE FUNCTION public.my_orgs()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM public.memberships WHERE user_id = auth.uid();
$$;

-- Return user's role in a given organization
CREATE OR REPLACE FUNCTION public.my_role(org_id UUID)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.memberships WHERE user_id = auth.uid() AND organization_id = org_id;
$$;

-- Check if current user is a member of a given organization
CREATE OR REPLACE FUNCTION public.is_member(org_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = is_member.user_id AND m.organization_id = is_member.org_id
  );
$$;

-- Check if current user is ADMIN or AGENT in a given organization
CREATE OR REPLACE FUNCTION public.is_staff(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid() AND organization_id = p_org_id AND role IN ('ADMIN', 'AGENT')
  );
$$;

-- Check if current user can access a specific ticket
CREATE OR REPLACE FUNCTION public.can_access_ticket(p_ticket_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.memberships m ON m.organization_id = t.organization_id
    WHERE t.id = p_ticket_id AND m.user_id = auth.uid()
  );
$$;

-- Get organization ID from slug
CREATE OR REPLACE FUNCTION public.org_id_from_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.organizations WHERE slug = p_slug;
$$;

-- Increment article view count
CREATE OR REPLACE FUNCTION public.increment_article_views(p_article_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.kb_articles SET views_count = COALESCE(views_count, 0) + 1 WHERE id = p_article_id;
END;
$$;

-- Vote on article helpfulness
CREATE OR REPLACE FUNCTION public.vote_article(p_article_id UUID, p_helpful BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_helpful THEN
    UPDATE public.kb_articles SET helpful_count = COALESCE(helpful_count, 0) + 1 WHERE id = p_article_id;
  ELSE
    UPDATE public.kb_articles SET not_helpful_count = COALESCE(not_helpful_count, 0) + 1 WHERE id = p_article_id;
  END IF;
END;
$$;

-- Search KB articles
CREATE OR REPLACE FUNCTION public.search_kb_articles(p_org_id UUID, p_query TEXT, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  excerpt TEXT,
  status TEXT,
  category_id UUID,
  relevance REAL
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    a.id, a.title, a.slug, a.excerpt, a.status, a.category_id,
    ts_rank(
      to_tsvector('portuguese', COALESCE(a.title, '') || ' ' || COALESCE(a.content, '')),
      plainto_tsquery('portuguese', p_query)
    ) AS relevance
  FROM public.kb_articles a
  WHERE a.organization_id = p_org_id
    AND a.status = 'PUBLISHED'
    AND to_tsvector('portuguese', COALESCE(a.title, '') || ' ' || COALESCE(a.content, ''))
        @@ plainto_tsquery('portuguese', p_query)
  ORDER BY relevance DESC
  LIMIT p_limit;
$$;

-- Check if storage object exists
CREATE OR REPLACE FUNCTION public.storage_object_exists(p_bucket TEXT, p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = p_bucket AND name = p_name
  );
$$;

-- Create attachment from upload
CREATE OR REPLACE FUNCTION public.create_attachment_from_upload(
  p_ticket_id UUID,
  p_organization_id UUID,
  p_uploaded_by UUID,
  p_file_name TEXT,
  p_file_ext TEXT,
  p_file_size INTEGER,
  p_mime_type TEXT,
  p_storage_path TEXT,
  p_storage_bucket TEXT DEFAULT 'attachments'
)
RETURNS public.attachments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_attachment public.attachments;
BEGIN
  INSERT INTO public.attachments (ticket_id, organization_id, uploaded_by, file_name, file_ext, file_size, mime_type, storage_path, storage_bucket)
  VALUES (p_ticket_id, p_organization_id, p_uploaded_by, p_file_name, p_file_ext, p_file_size, p_mime_type, p_storage_path, p_storage_bucket)
  RETURNING * INTO new_attachment;
  RETURN new_attachment;
END;
$$;

-- Get enabled notification channels for an organization
CREATE OR REPLACE FUNCTION public.get_org_enabled_channels(p_org_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  channels TEXT[] := '{}';
  settings RECORD;
BEGIN
  SELECT * INTO settings FROM public.organization_notification_settings WHERE organization_id = p_org_id;
  IF settings IS NULL THEN RETURN channels; END IF;
  IF settings.smtp_enabled OR settings.resend_enabled THEN channels := array_append(channels, 'EMAIL'); END IF;
  IF settings.whatsapp_cloud_enabled OR settings.evolution_enabled THEN channels := array_append(channels, 'WHATSAPP'); END IF;
  IF settings.sms_enabled THEN channels := array_append(channels, 'SMS'); END IF;
  RETURN channels;
END;
$$;

-- Get organization notification settings
CREATE OR REPLACE FUNCTION public.get_org_notification_settings(p_org_id UUID)
RETURNS public.organization_notification_settings
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM public.organization_notification_settings WHERE organization_id = p_org_id;
$$;

-- Get user notification channels for a specific event type
CREATE OR REPLACE FUNCTION public.get_user_notification_channels(
  p_event_type public.notification_event_type,
  p_org_id UUID,
  p_user_id UUID
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  channels TEXT[] := '{}';
  prefs RECORD;
  org_channels TEXT[];
BEGIN
  SELECT * INTO prefs FROM public.user_notification_preferences
  WHERE user_id = p_user_id AND organization_id = p_org_id;

  IF prefs IS NULL THEN
    RETURN public.get_org_enabled_channels(p_org_id);
  END IF;

  org_channels := public.get_org_enabled_channels(p_org_id);

  IF prefs.email_enabled AND 'EMAIL' = ANY(org_channels) THEN channels := array_append(channels, 'EMAIL'); END IF;
  IF prefs.whatsapp_enabled AND 'WHATSAPP' = ANY(org_channels) THEN channels := array_append(channels, 'WHATSAPP'); END IF;
  IF prefs.sms_enabled AND 'SMS' = ANY(org_channels) THEN channels := array_append(channels, 'SMS'); END IF;

  RETURN channels;
END;
$$;

-- Archive old notifications
CREATE OR REPLACE FUNCTION public.archive_old_notifications()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  WITH moved AS (
    DELETE FROM public.notifications
    WHERE status IN ('SENT', 'FAILED', 'EXPIRED', 'CANCELLED')
      AND updated_at < NOW() - interval '30 days'
    RETURNING *
  )
  INSERT INTO public.notifications_archive SELECT * FROM moved;
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN json_build_object('archived', archived_count);
END;
$$;

-- Cleanup expired notifications
CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications SET status = 'EXPIRED'
  WHERE status = 'PENDING' AND expires_at < NOW();
END;
$$;

-- Cleanup notifications archive
CREATE OR REPLACE FUNCTION public.cleanup_notifications_archive()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notifications_archive WHERE created_at < NOW() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN json_build_object('deleted', deleted_count);
END;
$$;

-- Delete old notifications
CREATE OR REPLACE FUNCTION public.delete_old_notifications()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notifications
  WHERE status IN ('SENT', 'FAILED', 'EXPIRED', 'CANCELLED')
    AND updated_at < NOW() - interval '60 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN json_build_object('deleted', deleted_count);
END;
$$;

-- Process notification queue (placeholder - actual logic in Edge Function)
CREATE OR REPLACE FUNCTION public.process_notification_queue()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  processed INTEGER := 0;
BEGIN
  -- Mark expired
  UPDATE public.notifications SET status = 'EXPIRED'
  WHERE status = 'PENDING' AND expires_at < NOW();
  RETURN json_build_object('processed', processed);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.my_orgs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_ticket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_id_from_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_article_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_article(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_kb_articles(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_object_exists(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_attachment_from_upload(UUID, UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_enabled_channels(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_notification_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_notification_channels(public.notification_event_type, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_notifications_archive() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_old_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_notification_queue() TO authenticated;

-- ==============================================================================
-- 4. VIEWS
-- ==============================================================================

-- KB articles with aggregated stats
CREATE OR REPLACE VIEW public.kb_articles_with_stats AS
SELECT
  a.*,
  c.name AS category_name,
  c.slug AS category_slug,
  (SELECT COUNT(*) FROM public.kb_article_versions v WHERE v.article_id = a.id) AS version_count
FROM public.kb_articles a
LEFT JOIN public.kb_categories c ON c.id = a.category_id;

-- Notification logs view (joins with org and user info)
CREATE OR REPLACE VIEW public.notification_logs_view AS
SELECT
  n.*,
  o.name AS organization_name,
  p.full_name AS recipient_user_email
FROM public.notifications n
LEFT JOIN public.organizations o ON o.id = n.organization_id
LEFT JOIN public.profiles p ON p.id = n.recipient_id;

-- Organization notification settings view (masks sensitive fields)
CREATE OR REPLACE VIEW public.organization_notification_settings_view AS
SELECT
  s.*,
  CASE WHEN s.smtp_password IS NOT NULL THEN '********' ELSE NULL END AS smtp_password_masked,
  CASE WHEN s.resend_api_key IS NOT NULL THEN '********' ELSE NULL END AS resend_api_key_masked,
  CASE WHEN s.sms_api_key IS NOT NULL THEN '********' ELSE NULL END AS sms_api_key_masked,
  CASE WHEN s.whatsapp_cloud_access_token IS NOT NULL THEN '********' ELSE NULL END AS whatsapp_access_token_masked,
  CASE WHEN s.evolution_api_key IS NOT NULL THEN '********' ELSE NULL END AS evolution_api_key_masked,
  (s.smtp_enabled AND s.smtp_host IS NOT NULL) OR (s.resend_enabled AND s.resend_api_key IS NOT NULL) AS email_available,
  s.whatsapp_cloud_enabled OR s.evolution_enabled AS whatsapp_available,
  s.sms_enabled AS sms_available
FROM public.organization_notification_settings s;

-- ==============================================================================
-- 5. BASIC RLS (organizations and profiles — other tables get RLS in later migrations)
-- ==============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organizations they belong to"
  ON public.organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()));

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view memberships of their organizations"
  ON public.memberships FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage memberships"
  ON public.memberships FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ==============================================================================
-- DONE
-- ==============================================================================
DO $$ BEGIN RAISE NOTICE 'Base schema migration 20260201000000 completed successfully'; END $$;
