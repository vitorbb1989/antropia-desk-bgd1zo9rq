-- Migration: Add delivery status tracking for WhatsApp webhooks
-- Adds DELIVERED and READ status values, delivered_at/read_at columns, and external_id index

-- 1. Add new enum values
ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE public.notification_status ADD VALUE IF NOT EXISTS 'READ';

-- 2. Add timestamp columns to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 3. Add same columns to notifications_archive
ALTER TABLE public.notifications_archive
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 4. Index on external_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_notifications_external_id
  ON public.notifications (external_id)
  WHERE external_id IS NOT NULL;

-- 5. Update archive function to include new statuses
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
    WHERE status IN ('SENT', 'DELIVERED', 'READ', 'FAILED', 'EXPIRED', 'CANCELLED')
      AND updated_at < NOW() - interval '30 days'
    RETURNING *
  )
  INSERT INTO public.notifications_archive SELECT * FROM moved;
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN json_build_object('archived', archived_count);
END;
$$;
