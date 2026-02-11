-- Migration: Add duration_ms to integration_logs for response time tracking

ALTER TABLE public.integration_logs
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
