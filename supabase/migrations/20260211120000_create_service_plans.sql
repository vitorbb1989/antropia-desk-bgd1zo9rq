-- ==============================================================================
-- MIGRATION: Service Plans & Category Filtering
-- Purpose: Allow admins to define contracted services per user (USER role).
--          Each service has specific ticket categories the client can open.
--          ADMIN/AGENT roles always see all categories (unfiltered).
-- ==============================================================================

-- 1. SERVICE PLANS TABLE
CREATE TABLE public.service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT 'briefcase',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_plans_org ON public.service_plans (organization_id);

ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;

-- Members can view their org's service plans
CREATE POLICY "Members can view service plans"
  ON public.service_plans FOR SELECT
  USING (organization_id IN (SELECT public.my_orgs()));

-- Only admins can manage service plans
CREATE POLICY "Admins can manage service plans"
  ON public.service_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = auth.uid()
        AND organization_id = service_plans.organization_id
        AND role = 'ADMIN'
    )
  );

-- 2. SERVICE PLAN <-> CATEGORY JUNCTION TABLE
CREATE TABLE public.service_plan_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_plan_id UUID NOT NULL REFERENCES public.service_plans(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.ticket_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_plan_id, category_id)
);

CREATE INDEX idx_spc_plan ON public.service_plan_categories (service_plan_id);
CREATE INDEX idx_spc_category ON public.service_plan_categories (category_id);

ALTER TABLE public.service_plan_categories ENABLE ROW LEVEL SECURITY;

-- Members can view junction rows for their org's plans
CREATE POLICY "Members can view service plan categories"
  ON public.service_plan_categories FOR SELECT
  USING (
    service_plan_id IN (
      SELECT id FROM public.service_plans WHERE organization_id IN (SELECT public.my_orgs())
    )
  );

-- Only admins can manage
CREATE POLICY "Admins can manage service plan categories"
  ON public.service_plan_categories FOR ALL
  USING (
    service_plan_id IN (
      SELECT sp.id FROM public.service_plans sp
      JOIN public.memberships m ON m.organization_id = sp.organization_id
      WHERE m.user_id = auth.uid() AND m.role = 'ADMIN'
    )
  );

-- 3. USER <-> SERVICE PLAN JUNCTION TABLE
CREATE TABLE public.user_service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service_plan_id UUID NOT NULL REFERENCES public.service_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, service_plan_id)
);

CREATE INDEX idx_usp_user ON public.user_service_plans (user_id);
CREATE INDEX idx_usp_plan ON public.user_service_plans (service_plan_id);

ALTER TABLE public.user_service_plans ENABLE ROW LEVEL SECURITY;

-- Users can see their own service plans
CREATE POLICY "Users can view own service plans"
  ON public.user_service_plans FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all user service plans in their org
CREATE POLICY "Admins can view org user service plans"
  ON public.user_service_plans FOR SELECT
  USING (
    service_plan_id IN (
      SELECT sp.id FROM public.service_plans sp
      WHERE sp.organization_id IN (SELECT public.my_orgs())
    )
  );

-- Only admins can manage user service plans
CREATE POLICY "Admins can manage user service plans"
  ON public.user_service_plans FOR ALL
  USING (
    service_plan_id IN (
      SELECT sp.id FROM public.service_plans sp
      JOIN public.memberships m ON m.organization_id = sp.organization_id
      WHERE m.user_id = auth.uid() AND m.role = 'ADMIN'
    )
  );

-- ==============================================================================
-- 4. SEED DATA: Trafego Pago (Meta Ads + Google Ads)
-- ==============================================================================

-- We use a DO block to insert with proper FK references
DO $$
DECLARE
  v_org_id UUID;
  v_plan_meta UUID;
  v_plan_google UUID;
  v_cat_meta_campanhas UUID;
  v_cat_meta_videos UUID;
  v_cat_meta_relatorio UUID;
  v_cat_meta_estrategia UUID;
  v_cat_google_campanhas UUID;
  v_cat_google_keywords UUID;
  v_cat_google_estrategia UUID;
BEGIN
  -- Get the first organization (Antropia)
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No organization found, skipping seed data.';
    RETURN;
  END IF;

  -- Create Service Plans
  INSERT INTO public.service_plans (id, organization_id, name, description, color, icon, display_order)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Meta Ads',
    'Gestao de campanhas de trafego pago na plataforma Meta (Facebook e Instagram Ads).',
    '#1877F2', 'megaphone', 1
  ) RETURNING id INTO v_plan_meta;

  INSERT INTO public.service_plans (id, organization_id, name, description, color, icon, display_order)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Google Ads',
    'Gestao de campanhas de trafego pago no Google Ads (Pesquisa, Display, YouTube).',
    '#4285F4', 'search', 2
  ) RETURNING id INTO v_plan_google;

  -- Create Categories for Meta Ads
  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Solicitacao de Novas Campanhas (Meta)',
    'Solicite a criacao de novas campanhas de anuncios na plataforma Meta (Facebook/Instagram). Nossa equipe analisara o briefing e iniciara a configuracao.',
    48, '#1877F2', 'meta-novas-campanhas'
  ) RETURNING id INTO v_cat_meta_campanhas;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Envio de Novos Videos (Meta)',
    'Envie novos materiais de video para utilizacao nas suas campanhas Meta Ads. Anexe os arquivos ao chamado para que nossa equipe aplique nas campanhas.',
    24, '#E91E63', 'meta-novos-videos'
  ) RETURNING id INTO v_cat_meta_videos;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Solicitar Relatorio (Meta)',
    'Solicite um relatorio detalhado de performance das suas campanhas Meta Ads com metricas de alcance, conversoes e investimento.',
    48, '#FF9800', 'meta-relatorio'
  ) RETURNING id INTO v_cat_meta_relatorio;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Detalhamento Estrategico (Meta)',
    'Solicite esclarecimentos sobre a estrategia de trafego executada nas suas campanhas Meta Ads. Ideal para entender melhor as decisoes, segmentacoes e direcionamentos adotados pela equipe.',
    72, '#9C27B0', 'meta-detalhamento-estrategico'
  ) RETURNING id INTO v_cat_meta_estrategia;

  -- Create Categories for Google Ads
  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Solicitacao de Novas Campanhas (Google)',
    'Solicite a criacao de novas campanhas no Google Ads (Pesquisa, Display, YouTube, etc). Descreva o objetivo e publico-alvo desejado.',
    48, '#4285F4', 'google-novas-campanhas'
  ) RETURNING id INTO v_cat_google_campanhas;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Revisao de Palavras-chave (Google)',
    'Solicite revisao e otimizacao das palavras-chave das suas campanhas Google Ads. Inclua sugestoes ou termos que deseja adicionar/remover.',
    48, '#34A853', 'google-revisao-palavras-chave'
  ) RETURNING id INTO v_cat_google_keywords;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (
    gen_random_uuid(), v_org_id,
    'Detalhamento Estrategico (Google)',
    'Solicite esclarecimentos sobre a estrategia de trafego executada nas suas campanhas Google Ads. Ideal para entender melhor as decisoes, lances e direcionamentos adotados pela equipe.',
    72, '#9C27B0', 'google-detalhamento-estrategico'
  ) RETURNING id INTO v_cat_google_estrategia;

  -- Link Categories to Service Plans
  INSERT INTO public.service_plan_categories (service_plan_id, category_id) VALUES
    (v_plan_meta, v_cat_meta_campanhas),
    (v_plan_meta, v_cat_meta_videos),
    (v_plan_meta, v_cat_meta_relatorio),
    (v_plan_meta, v_cat_meta_estrategia),
    (v_plan_google, v_cat_google_campanhas),
    (v_plan_google, v_cat_google_keywords),
    (v_plan_google, v_cat_google_estrategia);

  RAISE NOTICE 'Seed data created: 2 service plans, 7 categories, 7 links.';
END;
$$;

-- ==============================================================================
-- 5. HELPER FUNCTION: Get categories for a user based on their service plans
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_user_categories(p_user_id UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_description TEXT,
  category_sla_hours INTEGER,
  category_color TEXT,
  category_slug TEXT,
  service_plan_id UUID,
  service_plan_name TEXT,
  service_plan_color TEXT,
  service_plan_icon TEXT,
  service_plan_order INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    tc.id AS category_id,
    tc.name AS category_name,
    tc.description AS category_description,
    tc.sla_hours AS category_sla_hours,
    tc.color AS category_color,
    tc.slug AS category_slug,
    sp.id AS service_plan_id,
    sp.name AS service_plan_name,
    sp.color AS service_plan_color,
    sp.icon AS service_plan_icon,
    sp.display_order AS service_plan_order
  FROM public.user_service_plans usp
  JOIN public.service_plans sp ON sp.id = usp.service_plan_id AND sp.is_active = true
  JOIN public.service_plan_categories spc ON spc.service_plan_id = sp.id
  JOIN public.ticket_categories tc ON tc.id = spc.category_id
  WHERE usp.user_id = p_user_id
  ORDER BY sp.display_order, sp.name, tc.name;
$$;

-- Grant access
REVOKE ALL ON FUNCTION public.get_user_categories(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_categories(UUID) TO authenticated;
