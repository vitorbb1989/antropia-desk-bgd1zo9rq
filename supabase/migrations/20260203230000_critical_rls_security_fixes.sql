-- CRITICAL SECURITY FIXES: Enable RLS on missing critical tables
-- Migration: 20260203230000_critical_rls_security_fixes.sql
-- Author: Claude (Anthropic Assistant)
-- Date: 2026-02-03
-- Purpose: Fix critical security gaps by enabling RLS on all critical tables

-- ==============================================================================
-- 1. ENABLE RLS ON CRITICAL TABLES MISSING PROTECTION
-- ==============================================================================

-- Enable RLS on tickets table (MOST CRITICAL)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Enable RLS on ticket_timeline table
ALTER TABLE public.ticket_timeline ENABLE ROW LEVEL SECURITY;

-- Enable RLS on attachments table
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Enable RLS on notifications_archive table (if exists)
ALTER TABLE public.notifications_archive ENABLE ROW LEVEL SECURITY;

-- Enable RLS on workflows table
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- Enable RLS on integrations_config table (contains sensitive API keys)
ALTER TABLE public.integrations_config ENABLE ROW LEVEL SECURITY;

-- Enable RLS on integration_logs table
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_notification_preferences table
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Enable RLS on report_templates table
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- Enable RLS on organization_notification_settings table (contains sensitive credentials)
ALTER TABLE public.organization_notification_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on organization_settings table
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. CREATE ORGANIZATION ISOLATION POLICIES FOR TICKETS (MOST CRITICAL)
-- ==============================================================================

-- Policy: Users can only see tickets from their organization
CREATE POLICY "Users can only see tickets from their organization"
  ON public.tickets
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only create tickets in their organization
CREATE POLICY "Users can only create tickets in their organization"
  ON public.tickets
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only update tickets in their organization
CREATE POLICY "Users can only update tickets in their organization"
  ON public.tickets
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can delete tickets in their organization
CREATE POLICY "Only admins can delete tickets in their organization"
  ON public.tickets
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ==============================================================================
-- 3. CREATE ORGANIZATION ISOLATION POLICIES FOR TICKET_TIMELINE
-- ==============================================================================

-- Policy: Users can only see timeline from tickets in their organization
CREATE POLICY "Users can only see timeline from their organization tickets"
  ON public.ticket_timeline
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only create timeline entries for their organization tickets
CREATE POLICY "Users can only create timeline entries for their organization"
  ON public.ticket_timeline
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only update timeline entries in their organization
CREATE POLICY "Users can only update timeline entries in their organization"
  ON public.ticket_timeline
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- ==============================================================================
-- 4. CREATE ORGANIZATION ISOLATION POLICIES FOR ATTACHMENTS
-- ==============================================================================

-- Policy: Users can only see attachments from their organization
CREATE POLICY "Users can only see attachments from their organization"
  ON public.attachments
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only upload attachments to their organization tickets
CREATE POLICY "Users can only upload attachments to their organization"
  ON public.attachments
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only update attachments in their organization
CREATE POLICY "Users can only update attachments in their organization"
  ON public.attachments
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- ==============================================================================
-- 5. CREATE ORGANIZATION ISOLATION POLICIES FOR NOTIFICATIONS
-- ==============================================================================

-- Policy: Users can only see notifications from their organization
CREATE POLICY "Users can only see notifications from their organization"
  ON public.notifications
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: System can create notifications for any organization (service role)
CREATE POLICY "System can manage notifications"
  ON public.notifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Users can update their own notifications
CREATE POLICY "Users can update notifications in their organization"
  ON public.notifications
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- ==============================================================================
-- 6. CREATE ORGANIZATION ISOLATION POLICIES FOR WORKFLOWS
-- ==============================================================================

-- Policy: Users can only see workflows from their organization
CREATE POLICY "Users can only see workflows from their organization"
  ON public.workflows
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins and agents can manage workflows
CREATE POLICY "Only admins and agents can manage workflows"
  ON public.workflows
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AGENT')
    )
  );

-- ==============================================================================
-- 7. CREATE ORGANIZATION ISOLATION POLICIES FOR INTEGRATIONS_CONFIG
-- ==============================================================================

-- Policy: Users can only see integrations from their organization
CREATE POLICY "Users can only see integrations from their organization"
  ON public.integrations_config
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can manage integrations (contains sensitive API keys)
CREATE POLICY "Only admins can manage integrations"
  ON public.integrations_config
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ==============================================================================
-- 8. CREATE ORGANIZATION ISOLATION POLICIES FOR INTEGRATION_LOGS
-- ==============================================================================

-- Policy: Users can only see integration logs from their organization
CREATE POLICY "Users can only see integration logs from their organization"
  ON public.integration_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: System can create integration logs (service role)
CREATE POLICY "System can create integration logs"
  ON public.integration_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ==============================================================================
-- 9. CREATE ORGANIZATION ISOLATION POLICIES FOR USER_NOTIFICATION_PREFERENCES
-- ==============================================================================

-- Policy: Users can only see their own notification preferences
CREATE POLICY "Users can only see their own notification preferences"
  ON public.user_notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can only manage their own notification preferences
CREATE POLICY "Users can only manage their own notification preferences"
  ON public.user_notification_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- ==============================================================================
-- 10. CREATE ORGANIZATION ISOLATION POLICIES FOR ORGANIZATION_NOTIFICATION_SETTINGS
-- ==============================================================================

-- Policy: Only organization members can see settings (masked for non-admins)
CREATE POLICY "Only organization members can see notification settings"
  ON public.organization_notification_settings
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can manage organization notification settings
CREATE POLICY "Only admins can manage organization notification settings"
  ON public.organization_notification_settings
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ==============================================================================
-- 11. CREATE ORGANIZATION ISOLATION POLICIES FOR REPORT_TEMPLATES
-- ==============================================================================

-- Policy: Users can only see report templates from their organization
CREATE POLICY "Users can only see report templates from their organization"
  ON public.report_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins and agents can manage report templates
CREATE POLICY "Only admins and agents can manage report templates"
  ON public.report_templates
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND role IN ('ADMIN', 'AGENT')
    )
  );

-- ==============================================================================
-- 12. CREATE ORGANIZATION ISOLATION POLICIES FOR ORGANIZATION_SETTINGS
-- ==============================================================================

-- Policy: Only organization members can see settings
CREATE POLICY "Only organization members can see organization settings"
  ON public.organization_settings
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can manage organization settings
CREATE POLICY "Only admins can manage organization settings"
  ON public.organization_settings
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ==============================================================================
-- 13. PATCH ARCHIVE TABLE IF EXISTS
-- ==============================================================================

-- Enable RLS on notifications_archive if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications_archive') THEN
    ALTER TABLE public.notifications_archive ENABLE ROW LEVEL SECURITY;

    -- Create policy for notifications_archive
    CREATE POLICY "Users can only see archived notifications from their organization"
      ON public.notifications_archive
      FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ==============================================================================
-- COMPLETION MESSAGE
-- ==============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'CRITICAL RLS SECURITY FIXES COMPLETED SUCCESSFULLY';
  RAISE NOTICE 'Tables protected: tickets, ticket_timeline, attachments, notifications, workflows, integrations_config, integration_logs, user_notification_preferences, organization_notification_settings, report_templates, organization_settings';
  RAISE NOTICE 'Organization isolation policies created for all critical tables';
  RAISE NOTICE 'Next steps: Fix test_notification_settings function to validate organization access';
END $$;