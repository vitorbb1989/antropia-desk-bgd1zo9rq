-- Migration: 20260517020000_due_date_priority_fallback.sql
-- Purpose: garantir que TODO ticket inserido tenha due_date preenchido,
--   mesmo quando criado sem category_id. Fallback por priority:
--     URGENT  → 2h
--     HIGH    → 8h
--     MEDIUM  → 24h
--     LOW     → 72h
-- Razao: trigger anterior (20260505100000) so calculava due_date quando
--   havia category_id + ticket_categories.sla_hours definidos. Tickets
--   criados sem categoria ficavam sem prazo e o check-sla nao tinha o que
--   monitorar. Esta migration estende o trigger BEFORE INSERT.

-- ==============================================================================
-- 1. ATUALIZAR FUNCAO DO TRIGGER BEFORE INSERT
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

  -- Auto-calcular due_date se nao informado:
  --   a) preferencia: usar sla_hours da categoria
  --   b) fallback:    calcular por priority
  IF NEW.due_date IS NULL THEN
    IF NEW.category_id IS NOT NULL THEN
      SELECT sla_hours INTO v_sla_hours
        FROM public.ticket_categories
       WHERE id = NEW.category_id;
    END IF;

    IF v_sla_hours IS NULL THEN
      v_sla_hours := CASE NEW.priority
        WHEN 'URGENT' THEN 2
        WHEN 'HIGH'   THEN 8
        WHEN 'MEDIUM' THEN 24
        WHEN 'LOW'    THEN 72
        ELSE 24
      END;
    END IF;

    NEW.due_date := COALESCE(NEW.created_at, NOW()) + (v_sla_hours || ' hours')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger ja foi criado em 20260505100000; recreate idempotente.
DROP TRIGGER IF EXISTS trg_tickets_before_insert ON public.tickets;
CREATE TRIGGER trg_tickets_before_insert
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_before_insert_trigger();

-- ==============================================================================
-- 2. BACKFILL: tickets existentes sem categoria e sem due_date
-- ==============================================================================

UPDATE public.tickets
   SET due_date = created_at + (
     CASE priority
       WHEN 'URGENT' THEN INTERVAL '2 hours'
       WHEN 'HIGH'   THEN INTERVAL '8 hours'
       WHEN 'MEDIUM' THEN INTERVAL '24 hours'
       WHEN 'LOW'    THEN INTERVAL '72 hours'
       ELSE                 INTERVAL '24 hours'
     END
   )
 WHERE due_date IS NULL;
