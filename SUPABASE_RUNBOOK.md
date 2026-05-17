# SUPABASE RUNBOOK — Go-Live

> **Objetivo:** deixar o Supabase 100% pronto antes de qualquer passo no GCP.
> **Tempo total estimado:** 1h30 a 2h, sequencial.
> **Projeto:** `wevgxuxaplcmrnsktoud` (https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud)
> **Plano atual:** Free. Decisão Pro está no passo F.

Pré-requisito único: ter acesso de owner ao projeto no Supabase.

Cada passo tem **CLIQUES** (Dashboard) ou **SQL** (SQL Editor) + **VALIDAÇÃO** (como saber que deu certo). Não pule validações.

---

## PASSO A — Rotacionar credenciais expostas (10 min) `[BLOQUEADOR]`

A senha `<ROTACIONADA-VER-COFRE>` estava em vários `.md` versionados. A `service_role_key` também é citada em `claude.md:482`. Ambas precisam mudar.

### A.1 — Trocar senha do admin

1. `https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/auth/users`
2. Buscar `admin@antrop-ia.com` → 3 pontinhos → **Send password recovery**
3. Abrir o email, clicar no link, definir senha forte (16+ chars, com número/símbolo)
4. **Salvar no cofre** (Bitwarden / 1Password) — não anotar em arquivo
5. **Validação:** logar em `https://desk.antrop-ia.com` com a nova senha → deve entrar; com a antiga (`<ROTACIONADA-VER-COFRE>`) → deve falhar

### A.2 — Rotacionar `service_role_key`

⚠️ **Impacto:** todas as edge functions e scripts que usam `SUPABASE_SERVICE_ROLE_KEY` vão parar até reconfigurar. Fazer fora do horário de pico.

1. `https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/settings/api`
2. Seção **Project API keys** → na linha de `service_role` → **Reset** → confirmar
3. Copiar a nova `service_role` (mostra **uma vez**) → salvar no cofre
4. **Re-cadastrar nos secrets das Edge Functions:**
   `https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/functions/secrets`
   → editar `SUPABASE_SERVICE_ROLE_KEY` → colar nova chave → salvar
5. **Validação:** chamar uma edge function manualmente:
   ```bash
   curl -X POST 'https://wevgxuxaplcmrnsktoud.supabase.co/functions/v1/check-sla' \
     -H 'x-cron-secret: <CRON_SECRET-do-passo-E>' \
     -H 'content-type: application/json' \
     -d '{}'
   ```
   Esperado: HTTP 200 com `{"message":"SLA check complete",...}`. Se 500 com `INTERNAL_ERROR`, key não foi atualizada.

---

## PASSO B — Confirmar/configurar SMTP (Resend) (30 min) `[BLOQUEADOR]`

Sem isso: zero email sai (reset de senha, convite de usuário, notificação de ticket, `db-size-alert`).

### B.1 — Criar conta Resend (externo)

1. `https://resend.com` → Sign up com `accounts@antrop-ia.com`
2. Confirmar email
3. **Domains → Add Domain → `antrop-ia.com`**
4. Resend mostra ~4 registros DNS (SPF TXT, DKIM CNAME, DMARC TXT). Copiar.
5. No provedor de DNS do `antrop-ia.com` (Cloudflare/Registro.br/etc.):
   - Adicionar exatamente esses registros
   - Aguardar propagação (5–30 min)
6. Voltar no Resend → **Verify Domain** → deve ficar verde
7. **API Keys → Create API Key** → nome `antropia-desk-prod`, permission *Sending access* → copiar `re_xxxxxxx` → salvar no cofre

### B.2 — Cadastrar SMTP no Supabase Auth (para emails do GoTrue)

1. `https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/settings/auth`
2. Rolar até **SMTP Settings** → toggle **Enable Custom SMTP**
3. Preencher:
   - Sender email: `noreply@antrop-ia.com`
   - Sender name: `Antrop-IA Desk`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Min interval: `60` (segundos entre emails para o mesmo destinatário)
   - Username: `resend`
   - Password: a API key `re_xxxxxxx`
4. **Save**
5. **Validação:** clicar **Send test email** → digitar seu email pessoal → chega em <2 min

### B.3 — Cadastrar SMTP no app (para emails do produto — notificações de ticket, SLA, db-size-alert)

1. Logar em `https://desk.antrop-ia.com` com admin
2. **/admin/settings → aba Canais → Email**
3. Toggle **Ativar canal de email**
4. Mesmos valores do B.2 (Host/Port/User/Pass/From)
5. **Salvar**
6. **Validação:** botão **Testar canal** → digitar email pessoal → chega em <2 min

---

## PASSO C — Aplicar as 2 migrations novas (10 min) `[BLOQUEADOR]`

São 2 migrations não aplicadas ainda:
- `20260517020000_due_date_priority_fallback.sql` — trigger calcula `due_date` por priority quando categoria é NULL
- `20260517030000_retention_and_db_size_alert.sql` — `purge_old_integration_logs`, `check_db_size` e 2 cron jobs (`retention-cleanup`, `db-size-alert`)

### Opção 1 — via Supabase CLI (recomendado, registra histórico)

```bash
# No diretório do projeto, no seu terminal local:
supabase login   # se ainda não logado
supabase link --project-ref wevgxuxaplcmrnsktoud
supabase db push
```

Output esperado: lista 2 migrations novas → "Applying migration..." → "Finished supabase db push".

### Opção 2 — via SQL Editor (cole o conteúdo)

1. `https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/sql/new`
2. Colar o conteúdo de `supabase/migrations/20260517020000_due_date_priority_fallback.sql` → **RUN**
3. Idem para `20260517030000_retention_and_db_size_alert.sql`

### Validação C

No SQL Editor:
```sql
-- Trigger atualizado
SELECT pg_get_functiondef('public.tickets_before_insert_trigger'::regproc);
-- Deve mostrar bloco CASE NEW.priority ... no corpo

-- Funções da retenção
SELECT proname FROM pg_proc WHERE proname IN ('purge_old_integration_logs', 'check_db_size');
-- Deve retornar 2 rows

-- Tamanho atual do banco
SELECT * FROM public.check_db_size();
-- Retorna size_mb e pct_used
```

---

## PASSO D — Habilitar extensões (5 min)

Necessárias para os cron jobs e para o Vault de secrets.

### Cliques

`https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/database/extensions`

Buscar e ativar (toggle ON, manter schema default):
- `pg_cron` (schema `cron`)
- `pg_net` (schema `extensions`)
- `pgcrypto` (provavelmente já ativo)
- `pgtap` *(opcional — só se for rodar os testes de RLS)*

### Validação D

```sql
SELECT extname FROM pg_extension
 WHERE extname IN ('pg_cron', 'pg_net', 'pgcrypto');
-- Deve retornar 3 rows
```

---

## PASSO E — Gerar CRON_SECRET e cadastrar (15 min) `[BLOQUEADOR]`

Token único compartilhado entre `pg_cron` e as edge functions. Sem ele, as edge functions retornam 401 e a fila não drena.

### E.1 — Gerar o secret

```bash
openssl rand -hex 32
# saída: ex. f9d8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8
```
Copiar para o cofre como `CRON_SECRET`.

### E.2 — Salvar nos Edge Function secrets

`https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/functions/secrets`

Adicionar:
| Name | Value |
|---|---|
| `CRON_SECRET` | (o token gerado) |
| `ALLOWED_ORIGIN` | `https://desk.antrop-ia.com` |
| `EVOLUTION_WEBHOOK_SECRET` | (gerar outro `openssl rand -hex 32`) |
| `WEBHOOK_VERIFY_TOKEN` | (gerar outro `openssl rand -hex 32`, só se for usar WhatsApp Cloud API) |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm pré-populados — confirmar.

### E.3 — Salvar `cron_secret` no Vault (usado pelos jobs)

`https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/settings/vault/secrets`

Adicionar **2 secrets** (clique **New secret**):

| Name | Secret |
|---|---|
| `cron_secret` | (o **mesmo** valor do E.1) |
| `project_url` | `https://wevgxuxaplcmrnsktoud.supabase.co` |

### Validação E

```sql
SELECT name FROM vault.decrypted_secrets WHERE name IN ('cron_secret', 'project_url');
-- Deve retornar 2 rows
```

---

## PASSO F — Decisão: Free vs Pro (5 min de decisão)

**Antes do passo G**, decidir:
- **Free (0$):** mantém os limites 500MB/5GB/50k MAU. Backup pg_dump em GCS vira BLOQUEADOR (passo do GCP). Documentar a decisão no `OPERATIONS.md`.
- **Pro (US$ 25/mês):** libera PITR 7d, 8GB, 500 conexões, suporte. Recomendado se houver qualquer cliente externo pagante.

Se for **Pro**, fazer agora antes dos cron jobs:
1. `https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/settings/billing`
2. **Upgrade to Pro** → cartão → confirmar
3. Em `OPERATIONS.md` → seção "Histórico de upgrades" → preencher data + motivo
4. Em `supabase/migrations/20260517030000_*.sql` → trocar `500 * 1024 * 1024` por `8 * 1024 * 1024 * 1024` em `check_db_size()` → criar migration de ajuste

Se for **Free**, registrar a decisão em `OPERATIONS.md` e seguir.

---

## PASSO G — Agendar os 3 cron jobs (10 min) `[BLOQUEADOR]`

A migration `20260517030000` já agendou `retention-cleanup` e `db-size-alert`. Falta agendar os 3 que chamam as edge functions.

### G.1 — Rodar no SQL Editor

`https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/sql/new`

```sql
-- Idempotente: pode rodar de novo se algo der errado
DO $$ BEGIN
  PERFORM cron.unschedule(jobname)
    FROM cron.job
   WHERE jobname IN ('process-notifications', 'check-sla', 'generate-reports');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Job 1: drena notifications PENDING a cada 1 min
SELECT cron.schedule(
  'process-notifications', '* * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/process-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

-- Job 2: SLA warnings/breaches a cada 30 min
SELECT cron.schedule(
  'check-sla', '*/30 * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/check-sla',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

-- Job 3: relatórios agregados a cada hora
SELECT cron.schedule(
  'generate-reports', '0 * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/generate-reports',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
```

### Validação G

Imediato:
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- Esperado 5 linhas, todas active=true:
--   check-sla              */30 * * * *   t
--   db-size-alert           0 9 * * 0     t
--   generate-reports        0 * * * *     t
--   process-notifications   * * * * *     t
--   retention-cleanup       0 3 * * *     t
```

Após 2 min:
```sql
SELECT jobname, status, return_message, start_time
  FROM cron.job_run_details
 WHERE start_time > NOW() - INTERVAL '5 minutes'
 ORDER BY start_time DESC;
-- Pelo menos process-notifications deve ter executado com status='succeeded'.
-- Se status='failed' com message mencionando 401: CRON_SECRET não bate.
-- Se mencionar net.http_post não existe: extensão pg_net não está habilitada.
```

End-to-end:
```sql
-- 1) Criar ticket de teste (via UI: /tickets/new)
-- 2) Confirmar que a notification entrou em PENDING
SELECT id, status, recipient_email, created_at
  FROM notifications
 WHERE created_at > NOW() - INTERVAL '5 minutes'
 ORDER BY created_at DESC;
-- 3) Aguardar 1-2 min, repetir a query
-- 4) Esperado: status mudou de PENDING para SENT/DELIVERED
```

---

## PASSO H — CORS e configurações de API (5 min)

### H.1 — Allowed Origins no Supabase

`https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/settings/api`

Rolar até **API URL → CORS allowed origins** (ou similar — Supabase às vezes esconde isso em `Auth → URL Configuration`). Adicionar:
- `https://desk.antrop-ia.com`
- `https://staging-desk.antrop-ia.com` (se for usar staging)

### H.2 — Confirmar URLs de redirect do Auth

`https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/auth/url-configuration`

- **Site URL:** `https://desk.antrop-ia.com`
- **Redirect URLs:** adicionar `https://desk.antrop-ia.com/**`, `https://staging-desk.antrop-ia.com/**`
- (Se ainda houver) remover `http://localhost:5173/**` ou IPs antigos

Sem isso: reset de senha, magic link e convite quebram porque o redirect cai numa URL não autorizada.

---

## PASSO I — Capturar Database URL (para backup no GCP) (3 min)

`https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/settings/database`

Seção **Connection string → URI (pooler — Transaction)**. Algo como:
```
postgresql://postgres.wevgxuxaplcmrnsktoud:<password>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

- Trocar `<password>` pela senha do banco (mesma seção, **Reset database password** se não souber — atenção: invalida conexões diretas).
- Salvar no cofre como `SUPABASE_DB_URL`.
- **Não commitar em arquivo nenhum.**

Esse valor vai virar o secret `supabase-db-url` no Secret Manager do GCP (passo do GCP).

---

## PASSO J — Segundo projeto Free para restore drill (10 min)

Necessário no plano Free (sem PITR, drill mensal obrigatório). Pular se foi para Pro.

1. `https://supabase.com/dashboard/projects` → **New project**
2. Organização: mesma (Free permite **2 projects por org**)
3. Nome: `antropia-desk-staging-restore`
4. Region: `South America (São Paulo)` (mesma da produção)
5. DB password: gerar forte e salvar no cofre como `SUPABASE_STAGING_DB_URL`
6. Aguardar provisionar (~3 min)
7. Copiar a connection string do pooler (igual ao passo I)
8. **Salvar no cofre.** Não commitar.

Esse projeto é descartável — usado só para `pg_restore` mensal. Não precisa migrar schema (o restore traz tudo).

---

## PASSO K — Regenerar types do TypeScript (5 min)

Os tipos em `src/lib/supabase/types.ts` estão defasados → typecheck do CI está non-blocking. Sem isso, refactors podem quebrar prod silenciosamente.

```bash
# No diretório do projeto, no seu terminal local:
supabase login   # se ainda não fez no passo C
supabase gen types typescript --project-id wevgxuxaplcmrnsktoud > src/lib/supabase/types.ts
npm run typecheck
```

Se passar limpo:
1. Editar `.github/workflows/ci.yml` → remover `continue-on-error: true` do step "Typecheck"
2. Commit + push

Se aparecerem erros novos (provável — schema mudou em vários pontos):
1. Corrigir os call sites (`src/services/servicePlanService.ts`, `src/services/templateService.ts`, etc.)
2. Repetir typecheck até passar
3. Só então remover `continue-on-error`

---

## PASSO L — Validação final do Supabase (10 min)

Antes de declarar "Supabase pronto" e passar para o GCP.

```sql
-- 1) Todos os crons ativos e rodando
SELECT jobname, schedule, active,
       (SELECT MAX(start_time) FROM cron.job_run_details d WHERE d.jobname = j.jobname) AS last_run
  FROM cron.job j
 WHERE jobname IN ('process-notifications', 'check-sla', 'generate-reports',
                   'retention-cleanup', 'db-size-alert')
 ORDER BY jobname;
-- Esperado: 5 jobs, active=true, last_run < 1h (exceto retention-cleanup e
-- db-size-alert que só rodam diário/semanal)

-- 2) Sem PENDING acumulado preso
SELECT status, count(*)
  FROM notifications
 WHERE created_at > NOW() - INTERVAL '1 hour'
 GROUP BY status;
-- Esperado: maioria em SENT/DELIVERED, poucos PENDING

-- 3) DB size sob controle
SELECT * FROM check_db_size();
-- Esperado em Free: < 100 MB no início (20% — verde)

-- 4) RLS habilitado em todas as tabelas críticas
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN ('tickets', 'notifications', 'attachments', 'memberships',
                     'kb_articles', 'integrations_config', 'workflows')
 ORDER BY tablename;
-- Esperado: rowsecurity=true em todas

-- 5) Triggers de due_date e public_id ativos
SELECT tgname, tgenabled FROM pg_trigger
 WHERE tgrelid = 'public.tickets'::regclass
   AND tgname LIKE 'trg_tickets_%';
-- Esperado: trg_tickets_before_insert e trg_tickets_before_update, ambos 'O' (origin)

-- 6) Edge function secrets cadastrados
-- (não há query SQL; conferir em https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/functions/secrets)
-- Devem estar presentes: CRON_SECRET, ALLOWED_ORIGIN, SUPABASE_URL,
-- SUPABASE_SERVICE_ROLE_KEY (+ EVOLUTION_WEBHOOK_SECRET se for usar)
```

End-to-end via UI:
1. Criar ticket teste → notification chega no email em < 2 min ✅
2. Reset de senha de um usuário teste → email chega ✅
3. Marcar ticket como `URGENT` → `sla_due_at` é calculado para +2h ✅
4. `/admin/status` mostra todos verdes ✅

---

## Checkpoint: Supabase pronto

Quando A→L estiverem todos validados, sinaliza aqui e a gente parte para o GCP. Os artefatos que você sai do Supabase com:

| Item | Onde | Vai para |
|---|---|---|
| Nova senha admin | Cofre | (uso humano) |
| Nova `service_role_key` | Cofre | Secret Manager GCP (`supabase-service-role`) |
| `CRON_SECRET` | Cofre + Edge Function Secrets + Vault | Não vai pro GCP — fica no Supabase |
| `SUPABASE_DB_URL` (pooler) | Cofre | Secret Manager GCP (`supabase-db-url`) |
| `VITE_SUPABASE_URL` | Já conhecido | Secret Manager GCP (`supabase-url`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (anon) | Settings → API | Secret Manager GCP (`supabase-anon-key`) |
| `SUPABASE_STAGING_DB_URL` | Cofre | Cofre (uso manual mensal) |
| Resend API key | Cofre + Auth SMTP + App Settings | (não precisa no GCP) |

Pronto para subir o `cloudbuild.yaml`.
