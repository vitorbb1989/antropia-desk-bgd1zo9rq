-- Add fields to track SLA notifications
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_warning_sent_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_breach_sent_at TIMESTAMPTZ;

-- Ensure categories and tickets are set up (idempotent checks if reference migration ran)
-- We assume the reference migration 20260202140000_create_ticket_categories.sql handles the table creation.
-- This migration focuses strictly on the notification tracking fields required for the Edge Function.
