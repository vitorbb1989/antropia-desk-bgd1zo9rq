-- Seed: 5 service plans + 18 categorias para a organizacao Antrop-IA
-- Aplicar com: supabase db query --linked --file <este-arquivo>

DO $$
DECLARE
  v_org UUID;

  -- Service plan IDs
  v_plan_ai          UUID;
  v_plan_smartflows  UUID;
  v_plan_ads         UUID;
  v_plan_dev         UUID;
  v_plan_infra       UUID;

  -- Categoria IDs (Agentes de IA)
  v_cat_ai_setup     UUID;
  v_cat_ai_prompts   UUID;
  v_cat_ai_channels  UUID;
  v_cat_ai_analytics UUID;

  -- Categoria IDs (SmartFlows)
  v_cat_sf_new       UUID;
  v_cat_sf_edit      UUID;
  v_cat_sf_integ     UUID;
  v_cat_sf_bug       UUID;

  -- Categoria IDs (Trafego Pago)
  v_cat_ads_new      UUID;
  v_cat_ads_optim    UUID;
  v_cat_ads_report   UUID;
  v_cat_ads_strat    UUID;

  -- Categoria IDs (Desenvolvimento)
  v_cat_dev_feat     UUID;
  v_cat_dev_bug      UUID;
  v_cat_dev_maint    UUID;

  -- Categoria IDs (Infraestrutura)
  v_cat_infra_down   UUID;
  v_cat_infra_backup UUID;
  v_cat_infra_access UUID;
BEGIN
  -- Buscar a organizacao Antrop-IA
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'antrop-ia' LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organizacao antrop-ia nao encontrada';
  END IF;

  -- ==========================================================================
  -- SERVICE PLANS
  -- ==========================================================================

  INSERT INTO public.service_plans (id, organization_id, name, description, color, icon, display_order)
  VALUES (gen_random_uuid(), v_org, 'Agentes de IA',
          'Configuracao, ajustes e suporte a agentes de IA (chatbots, atendentes virtuais).',
          '#8B5CF6', 'bot', 1)
  RETURNING id INTO v_plan_ai;

  INSERT INTO public.service_plans (id, organization_id, name, description, color, icon, display_order)
  VALUES (gen_random_uuid(), v_org, 'SmartFlows / Automacao',
          'Criacao e manutencao de fluxos automatizados, integracoes entre sistemas.',
          '#06B6D4', 'workflow', 2)
  RETURNING id INTO v_plan_smartflows;

  INSERT INTO public.service_plans (id, organization_id, name, description, color, icon, display_order)
  VALUES (gen_random_uuid(), v_org, 'Trafego Pago',
          'Gestao de campanhas Meta Ads e Google Ads, otimizacao e relatorios.',
          '#F59E0B', 'megaphone', 3)
  RETURNING id INTO v_plan_ads;

  INSERT INTO public.service_plans (id, organization_id, name, description, color, icon, display_order)
  VALUES (gen_random_uuid(), v_org, 'Desenvolvimento Web/App',
          'Desenvolvimento e manutencao de sites, sistemas e aplicacoes customizadas.',
          '#10B981', 'code', 4)
  RETURNING id INTO v_plan_dev;

  INSERT INTO public.service_plans (id, organization_id, name, description, color, icon, display_order)
  VALUES (gen_random_uuid(), v_org, 'Infraestrutura & Suporte',
          'Suporte de infraestrutura, sistemas em producao, backups e acessos.',
          '#EF4444', 'server', 5)
  RETURNING id INTO v_plan_infra;

  -- ==========================================================================
  -- CATEGORIAS — Agentes de IA
  -- ==========================================================================

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Configuracao de Novo Agente',
          'Setup inicial de um novo agente de IA, treinamento com base de conhecimento, definicao de personalidade.',
          48, '#8B5CF6', 'ai-novo-agente')
  RETURNING id INTO v_cat_ai_setup;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Ajuste de Prompts e Comportamento',
          'Refinamento de respostas do agente, tom de voz, regras de negocio e logica conversacional.',
          24, '#A78BFA', 'ai-prompts')
  RETURNING id INTO v_cat_ai_prompts;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Integracao com Canais',
          'Conectar o agente a WhatsApp, Telegram, Instagram, site, ou outros canais de comunicacao.',
          48, '#7C3AED', 'ai-canais')
  RETURNING id INTO v_cat_ai_channels;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Analise de Conversas',
          'Relatorio de qualidade das conversas, taxa de conversao, identificacao de gargalos.',
          72, '#6D28D9', 'ai-analytics')
  RETURNING id INTO v_cat_ai_analytics;

  -- ==========================================================================
  -- CATEGORIAS — SmartFlows
  -- ==========================================================================

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Nova Automacao',
          'Solicitar criacao de um fluxo automatizado novo (briefing + setup).',
          48, '#06B6D4', 'sf-nova')
  RETURNING id INTO v_cat_sf_new;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Ajuste em Fluxo Existente',
          'Mudar logica, adicionar ou remover etapas em um fluxo ja em producao.',
          24, '#0891B2', 'sf-ajuste')
  RETURNING id INTO v_cat_sf_edit;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Integracao com Sistema Externo',
          'Conectar SmartFlow a APIs externas, webhooks, ERPs, CRMs ou outros sistemas.',
          72, '#0E7490', 'sf-integracao')
  RETURNING id INTO v_cat_sf_integ;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Erro ou Bug em Fluxo',
          'Fluxo parado, executando incorretamente ou comportamento inesperado em producao.',
          8, '#DC2626', 'sf-bug')
  RETURNING id INTO v_cat_sf_bug;

  -- ==========================================================================
  -- CATEGORIAS — Trafego Pago
  -- ==========================================================================

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Solicitacao de Nova Campanha',
          'Criacao de nova campanha de anuncios em Meta Ads (Facebook/Instagram) ou Google Ads.',
          48, '#F59E0B', 'ads-nova-campanha')
  RETURNING id INTO v_cat_ads_new;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Otimizacao de Campanha Ativa',
          'Ajustes de lance, segmentacao, criativos ou pausa em campanhas em andamento.',
          24, '#D97706', 'ads-otimizacao')
  RETURNING id INTO v_cat_ads_optim;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Relatorio de Performance',
          'Relatorio detalhado de metricas: alcance, conversoes, CPA, ROI, investimento.',
          48, '#B45309', 'ads-relatorio')
  RETURNING id INTO v_cat_ads_report;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Detalhamento Estrategico',
          'Esclarecimentos sobre decisoes estrategicas: segmentacoes, lances, direcionamentos.',
          72, '#92400E', 'ads-estrategia')
  RETURNING id INTO v_cat_ads_strat;

  -- ==========================================================================
  -- CATEGORIAS — Desenvolvimento Web/App
  -- ==========================================================================

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Nova Funcionalidade',
          'Solicitacao de feature nova em sistema/aplicacao/site existente.',
          120, '#10B981', 'dev-feature')
  RETURNING id INTO v_cat_dev_feat;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Bug em Producao',
          'Erro em sistema ja em producao que afeta usuarios — necessita correcao urgente.',
          24, '#DC2626', 'dev-bug')
  RETURNING id INTO v_cat_dev_bug;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Manutencao e Atualizacao',
          'Update de dependencias, refatoracao, melhorias de performance, ajustes pequenos.',
          72, '#059669', 'dev-manutencao')
  RETURNING id INTO v_cat_dev_maint;

  -- ==========================================================================
  -- CATEGORIAS — Infraestrutura
  -- ==========================================================================

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Sistema Indisponivel (CRITICO)',
          'Sistema/site/aplicacao em producao indisponivel ou inacessivel — incident response.',
          4, '#DC2626', 'infra-down')
  RETURNING id INTO v_cat_infra_down;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Backup e Restauracao',
          'Solicitar backup pontual, restaurar dados/configuracoes a partir de backup.',
          24, '#EF4444', 'infra-backup')
  RETURNING id INTO v_cat_infra_backup;

  INSERT INTO public.ticket_categories (id, organization_id, name, description, sla_hours, color, slug)
  VALUES (gen_random_uuid(), v_org, 'Acessos e Permissoes',
          'Liberar acesso de novo usuario, resetar senha, alterar permissoes ou revogar acesso.',
          24, '#F87171', 'infra-acesso')
  RETURNING id INTO v_cat_infra_access;

  -- ==========================================================================
  -- VINCULOS service_plan -> categorias
  -- ==========================================================================

  INSERT INTO public.service_plan_categories (service_plan_id, category_id) VALUES
    -- Agentes de IA
    (v_plan_ai,         v_cat_ai_setup),
    (v_plan_ai,         v_cat_ai_prompts),
    (v_plan_ai,         v_cat_ai_channels),
    (v_plan_ai,         v_cat_ai_analytics),

    -- SmartFlows
    (v_plan_smartflows, v_cat_sf_new),
    (v_plan_smartflows, v_cat_sf_edit),
    (v_plan_smartflows, v_cat_sf_integ),
    (v_plan_smartflows, v_cat_sf_bug),

    -- Trafego Pago
    (v_plan_ads,        v_cat_ads_new),
    (v_plan_ads,        v_cat_ads_optim),
    (v_plan_ads,        v_cat_ads_report),
    (v_plan_ads,        v_cat_ads_strat),

    -- Desenvolvimento
    (v_plan_dev,        v_cat_dev_feat),
    (v_plan_dev,        v_cat_dev_bug),
    (v_plan_dev,        v_cat_dev_maint),

    -- Infraestrutura
    (v_plan_infra,      v_cat_infra_down),
    (v_plan_infra,      v_cat_infra_backup),
    (v_plan_infra,      v_cat_infra_access);

  RAISE NOTICE 'Seed Antrop-IA concluido: 5 plans, 18 categorias, 18 vinculos.';
END $$;
