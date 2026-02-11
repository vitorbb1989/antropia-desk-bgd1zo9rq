-- ================================================================
-- Migration: Fix User Onboarding Pipeline
-- 1. Trigger para auto-criar profile quando auth.users é criado
-- 2. Fix RLS em memberships para permitir leitura própria
-- 3. Fix RLS em profiles para permitir leitura própria
-- 4. RPC para admins convidarem usuários (cria auth user + profile + membership)
-- ================================================================

-- ================================================================
-- 1. TRIGGER: Auto-criar profile em auth.users INSERT
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Criar trigger apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_auth_user();
  END IF;
END;
$$;

-- ================================================================
-- 2. FIX RLS: memberships - permitir usuário ver seus próprios memberships
-- ================================================================
DROP POLICY IF EXISTS "Users can view memberships of their organizations" ON public.memberships;

CREATE POLICY "Users can view own and org memberships"
  ON public.memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    organization_id IN (
      SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

-- ================================================================
-- 3. FIX RLS: profiles - permitir usuário ver seu próprio perfil
-- ================================================================
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Próprio perfil sempre visível
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Perfis de colegas na mesma org
CREATE POLICY "Users can view org member profiles"
  ON public.profiles
  FOR SELECT
  USING (
    id IN (
      SELECT m2.user_id FROM public.memberships m1
      JOIN public.memberships m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = auth.uid()
    )
  );

-- ================================================================
-- 4. RPC: Admin convidar usuário (cria user + profile + membership)
-- ================================================================
CREATE OR REPLACE FUNCTION public.invite_user(
  p_email TEXT,
  p_full_name TEXT DEFAULT '',
  p_role public.user_role DEFAULT 'USER'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_org_id UUID;
  caller_role TEXT;
  new_user_id UUID;
  existing_user_id UUID;
BEGIN
  -- Verificar se quem chama é ADMIN
  SELECT m.organization_id, m.role INTO caller_org_id, caller_role
  FROM public.memberships m
  WHERE m.user_id = auth.uid()
  LIMIT 1;

  IF caller_role IS NULL OR caller_role != 'ADMIN' THEN
    RAISE EXCEPTION 'Apenas administradores podem convidar usuários.';
  END IF;

  -- Verificar se email já existe em auth.users
  SELECT id INTO existing_user_id
  FROM auth.users
  WHERE email = p_email;

  IF existing_user_id IS NOT NULL THEN
    -- Usuário já existe, verificar se já tem membership nessa org
    IF EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = existing_user_id AND organization_id = caller_org_id
    ) THEN
      RAISE EXCEPTION 'Usuário já pertence a esta organização.';
    END IF;

    -- Criar membership para usuário existente
    INSERT INTO public.memberships (organization_id, user_id, role)
    VALUES (caller_org_id, existing_user_id, p_role);

    -- Atualizar nome se fornecido
    IF p_full_name != '' THEN
      UPDATE public.profiles
      SET full_name = p_full_name, updated_at = NOW()
      WHERE id = existing_user_id AND (full_name IS NULL OR full_name = '');
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'user_id', existing_user_id,
      'action', 'membership_created'
    );
  END IF;

  -- Criar novo usuário via Supabase Auth admin API
  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, email,
    encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data,
    aud, role, created_at, updated_at
  )
  VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt('temp-' || substr(md5(random()::text), 1, 12), gen_salt('bf')),
    NOW(),
    jsonb_build_object('full_name', p_full_name),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  );

  -- Profile é criado automaticamente pelo trigger on_auth_user_created
  -- Mas garantir que o nome está correto
  UPDATE public.profiles
  SET full_name = p_full_name, updated_at = NOW()
  WHERE id = new_user_id;

  -- Criar membership
  INSERT INTO public.memberships (organization_id, user_id, role)
  VALUES (caller_org_id, new_user_id, p_role);

  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'action', 'user_created',
    'note', 'Usuário deve usar "Esqueceu a senha" para definir sua senha.'
  );
END;
$$;
