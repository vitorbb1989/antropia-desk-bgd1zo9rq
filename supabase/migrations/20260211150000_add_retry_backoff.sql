-- Migration: Add next_retry_at for exponential backoff retry scheduling

-- 1. Add column to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- 2. Add column to notifications_archive
ALTER TABLE public.notifications_archive
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
