-- Migration: 20260505100000_add_ticket_due_date_and_public_id.sql
-- Purpose:
--   1. Auto-calcular due_date no INSERT/UPDATE de tickets baseado em category.sla_hours
--   2. Adicionar public_id sequencial por organizacao (formato AD-YYYY-NNNNN)
-- Razao: SLA automatico nao funcionava sem due_date populado; UI precisa de identificador legivel

-- ==============================================================================
-- 1. PUBLIC_ID SEQUENCIAL POR ORGANIZACAO
-- ==============================================================================

-- Sequence global (simples e suficiente; se quiser por org, requer tabela auxiliar)
CREATE SEQUENCE IF NOT EXISTS public.tickets_public_id_seq START 1;

-- Adicionar coluna se ainda nao existe
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS public_id TEXT;

-- Backfill: preencher public_id em tickets existentes
DO $$
DECLARE
  r RECORD;
  v_year TEXT;
  v_seq BIGINT;
BEGIN
  FOR r IN SELECT id, created_at FROM public.tickets WHERE public_id IS NULL ORDER BY created_at LOOP
    v_year := to_char(r.created_at, 'YYYY');
    v_seq := nextval('public.tickets_public_id_seq');
    UPDATE public.tickets
       SET public_id = 'AD-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- Tornar NOT NULL e UNIQUE apos backfill
ALTER TABLE public.tickets
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_public_id ON public.tickets (public_id);

-- ==============================================================================
-- 2. TRIGGER: auto-set public_id e due_date no INSERT
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.tickets_before_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq BIGINT;
  v_sla_hours INTEGER;
BEGIN
  -- Auto-gerar public_id se nao informado
  IF NEW.public_id IS NULL THEN
    v_year := to_char(COALESCE(NEW.created_at, NOW()), 'YYYY');
    v_seq := nextval('public.tickets_public_id_seq');
    NEW.public_id := 'AD-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
  END IF;

  -- Auto-calcular due_date se nao informado e categoria tem SLA
  IF NEW.due_date IS NULL AND NEW.category_id IS NOT NULL THEN
    SELECT sla_hours INTO v_sla_hours
      FROM public.ticket_categories
     WHERE id = NEW.category_id;

    IF v_sla_hours IS NOT NULL THEN
      NEW.due_date := COALESCE(NEW.created_at, NOW()) + (v_sla_hours || ' hours')::INTERVAL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_before_insert ON public.tickets;
CREATE TRIGGER trg_tickets_before_insert
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_before_insert_trigger();

-- ==============================================================================
-- 3. TRIGGER: ao mudar category_id em UPDATE, recalcular due_date
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.tickets_before_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla_hours INTEGER;
BEGIN
  -- Se categoria mudou e usuario nao definiu due_date manualmente nesta operacao
  IF NEW.category_id IS DISTINCT FROM OLD.category_id
     AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN

    IF NEW.category_id IS NOT NULL THEN
      SELECT sla_hours INTO v_sla_hours
        FROM public.ticket_categories
       WHERE id = NEW.category_id;

      IF v_sla_hours IS NOT NULL THEN
        NEW.due_date := COALESCE(NEW.created_at, NOW()) + (v_sla_hours || ' hours')::INTERVAL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_before_update ON public.tickets;
CREATE TRIGGER trg_tickets_before_update
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_before_update_trigger();

-- ==============================================================================
-- 4. BACKFILL DUE_DATE para tickets existentes que tem categoria mas nao due_date
-- ==============================================================================

UPDATE public.tickets t
   SET due_date = t.created_at + (c.sla_hours || ' hours')::INTERVAL
  FROM public.ticket_categories c
 WHERE t.category_id = c.id
   AND t.due_date IS NULL
   AND c.sla_hours IS NOT NULL;

-- Nota: Se esta migration falhar por permissao (RLS), executar como service_role no SQL Editor.
