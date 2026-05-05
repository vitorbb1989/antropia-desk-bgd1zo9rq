-- Migration: 20260505120000_fix_kb_articles_user_visibility.sql
-- Purpose: USER role nao deve ver artigos DRAFT — apenas PUBLISHED.
--          ADMIN/AGENT continua vendo tudo (incluindo drafts) para revisao.
-- Razao: Bug de exposicao identificado em audit (ver RELATORIO_VALIDACAO_INTERNA.md).

-- ==============================================================================
-- 1. AJUSTAR POLICY DE SELECT EM kb_articles
-- ==============================================================================

DROP POLICY IF EXISTS "Users can view kb articles of their org" ON public.kb_articles;

CREATE POLICY "Users can view kb articles of their org"
  ON public.kb_articles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
    )
    AND (
      -- ADMIN/AGENT veem tudo (incluindo DRAFT)
      EXISTS (
        SELECT 1 FROM public.memberships
        WHERE user_id = auth.uid()
          AND organization_id = kb_articles.organization_id
          AND role IN ('ADMIN', 'AGENT')
      )
      OR
      -- USER ve apenas PUBLISHED
      kb_articles.status = 'PUBLISHED'
    )
  );

COMMENT ON POLICY "Users can view kb articles of their org" ON public.kb_articles IS
  'Org isolation + USER ve apenas PUBLISHED; ADMIN/AGENT ve todos os status.';
