  -- Migration: 20260517030000_retention_and_db_size_alert.sql
  -- Purpose: rodar com Supabase Free (500 MB de DB sem PITR). Adiciona:
  --   1. purge_old_integration_logs()  — DELETE em integration_logs > 30 dias
  --   2. check_db_size()               — RPC retornando size_mb e pct_used
  --   3. cron job 'retention-cleanup'  — diario 03:00 UTC. Chama
  --      archive_old_notifications() (ja existe) + purge_old_integration_logs()
  --   4. cron job 'db-size-alert'      — semanal domingo 09:00 UTC. Cria
  --      notification em PENDING se uso do DB > 70%. process-notifications
  --      (1x/min) entrega via SMTP configurado.
  --
  -- Razao: snapshot do Supabase Free pode sumir; nao ha PITR. Crescimento
  -- descontrolado de notifications/integration_logs estoura o limite e o
  -- banco vira read-only silenciosamente, quebrando o app.

  -- ==============================================================================
  -- 1. PURGE de integration_logs antigos
  -- ==============================================================================

  CREATE OR REPLACE FUNCTION public.purge_old_integration_logs()
  RETURNS JSON
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $body$
  DECLARE
    removed INTEGER;
  BEGIN
    DELETE FROM public.integration_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS removed = ROW_COUNT;
    RETURN json_build_object('removed', removed);
  END;
  $body$;

  -- Apenas service_role chama via cron; nao expor a authenticated.
  REVOKE EXECUTE ON FUNCTION public.purge_old_integration_logs() FROM PUBLIC;

  -- ==============================================================================
  -- 2. CHECK_DB_SIZE — usado pelo cron de alerta e por dashboards externos
  -- ==============================================================================

  -- 500 MB = limite do plano Free. Quando upgrade para Pro (8 GB), substituir
  -- o divisor abaixo via nova migration.
  CREATE OR REPLACE FUNCTION public.check_db_size()
  RETURNS TABLE (size_mb NUMERIC, pct_used NUMERIC)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
  AS $body$
    SELECT
      ROUND(pg_database_size(current_database())::numeric / 1024 / 1024, 2)            AS size_mb,
      ROUND(pg_database_size(current_database())::numeric / (500 * 1024 * 1024) * 100, 2) AS pct_used;
  $body$;

  -- Apenas service_role usa via cron interno. Authenticated nao precisa.
  REVOKE EXECUTE ON FUNCTION public.check_db_size() FROM PUBLIC;

  -- ==============================================================================
  -- 3. CRON: retention-cleanup (diario 03:00 UTC = 00h BRT)
  -- ==============================================================================

  -- pg_cron deve estar habilitado (parte dos pre-requisitos do plano).
  -- Unschedule antes para idempotencia. Tag $do$ exclusiva evita conflito
  -- com outros dollar-quotes nesta migration.
  DO $do$ BEGIN
    PERFORM cron.unschedule('retention-cleanup');
  EXCEPTION WHEN OTHERS THEN NULL;
  END $do$;

  SELECT cron.schedule(
    'retention-cleanup',
    '0 3 * * *',
    $job$
      SELECT public.archive_old_notifications();
      SELECT public.purge_old_integration_logs();
    $job$
  );

  -- ==============================================================================
  -- 4. CRON: db-size-alert (semanal domingo 09:00 UTC)
  -- ==============================================================================
  --
  -- IMPORTANTE: este job insere uma row em `notifications` com status PENDING.
  -- O process-notifications (cron 1x/min) drena e envia via SMTP configurado.
  -- Sem SMTP cadastrado, o alerta empilha mas nao sai.
  --
  -- O recipient_id e resolvido dinamicamente: primeiro ADMIN da primeira org
  -- (assumindo deployment single-tenant). Se for multi-tenant no futuro,
  -- substituir por loop por org.
  --
  -- Threshold: 70% (350 MB de 500 MB). Quando upgrade para Pro, ajustar.

  DO $do$ BEGIN
    PERFORM cron.unschedule('db-size-alert');
  EXCEPTION WHEN OTHERS THEN NULL;
  END $do$;

  SELECT cron.schedule(
    'db-size-alert',
    '0 9 * * 0',
    $job$
      INSERT INTO public.notifications (
        organization_id,
        recipient_id,
        event_type,
        channel,
        status,
        subject,
        body,
        metadata,
        created_at,
        updated_at
      )
      SELECT
        m.organization_id,
        m.user_id,
        'TEST'::public.notification_event_type,
        'EMAIL'::public.notification_channel,
        'PENDING'::public.notification_status,
        'Antropia Desk: DB Supabase em ' || s.pct_used || '% (' || s.size_mb || ' MB / 500 MB)',
        E'Aviso automatico de uso do banco.\n\n' ||
        'Tamanho atual: ' || s.size_mb || ' MB\n' ||
        'Percentual usado: ' || s.pct_used || '% do limite Free (500 MB)\n' ||
        'Threshold do alerta: 70%\n\n' ||
        'Acoes recomendadas:\n' ||
        '  1. SELECT pg_size_pretty(pg_total_relation_size(schemaname||''.''||tablename))\n' ||
        '       FROM pg_tables WHERE schemaname=''public''\n' ||
        '       ORDER BY pg_total_relation_size(schemaname||''.''||tablename) DESC LIMIT 10;\n' ||
        '  2. Confirmar que retention-cleanup esta rodando ok\n' ||
        '  3. Avaliar upgrade para Supabase Pro (US$ 25/mes, 8 GB + PITR)\n',
        jsonb_build_object(
          'source', 'db-size-alert',
          'size_mb', s.size_mb,
          'pct_used', s.pct_used
        ),
        NOW(),
        NOW()
      FROM public.check_db_size() s
      CROSS JOIN LATERAL (
        SELECT user_id, organization_id
          FROM public.memberships
        WHERE role = 'ADMIN'
        ORDER BY created_at ASC
        LIMIT 1
      ) m
      WHERE s.pct_used > 70;
    $job$
  );

  -- ==============================================================================
  -- 5. VERIFICACAO POS-APLICACAO (rodar manualmente apos `db push`)
  -- ==============================================================================
  --
  -- SELECT jobname, schedule, active FROM cron.job
  --  WHERE jobname IN ('retention-cleanup', 'db-size-alert');
  --
  -- SELECT * FROM public.check_db_size();
  --
  -- -- Forcar um run agora pra validar (sem esperar o cron):
  -- SELECT public.archive_old_notifications();
  -- SELECT public.purge_old_integration_logs();
