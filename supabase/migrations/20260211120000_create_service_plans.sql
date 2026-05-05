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

-- Service plans and categories are created by admins via the application UI.

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
