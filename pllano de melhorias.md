# GO-LIVE GCP — Plano de Execução

> **Para quem:** Claude Code (executor) + revisor humano.
> **Objetivo:** levar `desk.antrop-ia.com` ao Cloud Run em `southamerica-east1` com pipeline verde, observabilidade ativa, backup testado e CI mínimo bloqueando regressões.
> **Princípios:** anti-hype, anti-stack-creep. Não introduzir Fastify/Prisma/Express/Redis/Loki. Usar o nativo do GCP e do Supabase.
> **Status do projeto:** aprovado para piloto pelo `RELATORIO_VALIDACAO_INTERNA.md`. Risco real está em operação cega (sem observabilidade, sem CI, sem testes de regressão), não em features faltando.

---

## Convenções

- **Estado** = factual hoje, com referência a arquivo/migration quando aplicável.
- **Critério de pronto** = como o item é considerado fechado.
- **Comandos** = prontos pra colar, mas validar antes de executar em prod.
- **`[NÃO TOCAR EM PROD]`** = só rodar em staging; promover só após validação.
- **`gcloud` config padrão**: `PROJECT_ID=antropia-desk` (ajustar), `REGION=southamerica-east1`.
- **Sempre que houver dúvida**, parar e pedir validação humana antes de aplicar mudança destrutiva.

---

## Pré-requisitos (Dia 0)

Antes de qualquer item da Fase B, garantir:

```bash
# 1. Autenticar gcloud
gcloud auth login
gcloud config set project antropia-desk
gcloud config set run/region southamerica-east1

# 2. Habilitar APIs necessárias
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  cloudscheduler.googleapis.com \
  compute.googleapis.com

# 3. Criar Artifact Registry
gcloud artifacts repositories create desk \
  --repository-format=docker \
  --location=southamerica-east1 \
  --description="Antropia Desk container images"

# 4. Service Account para Cloud Build
gcloud iam service-accounts create cloudbuild-deploy \
  --display-name="Cloud Build deploy SA"

# 5. Conceder roles mínimos (Cloud Run + Secret Manager + Artifact Registry)
PROJECT_NUMBER=$(gcloud projects describe antropia-desk --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding antropia-desk \
  --member="serviceAccount:${CB_SA}" --role="roles/run.admin"
gcloud projects add-iam-policy-binding antropia-desk \
  --member="serviceAccount:${CB_SA}" --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding antropia-desk \
  --member="serviceAccount:${CB_SA}" --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding antropia-desk \
  --member="serviceAccount:${CB_SA}" --role="roles/artifactregistry.writer"
```

**Critério de pronto:** `gcloud services list --enabled` mostra as 7 APIs e `gcloud artifacts repositories list` mostra o repositório `desk`.

---

# FASE A — Quick wins paralelos (Dia 1)

Todos os itens desta fase são **independentes** entre si e do GCP. Podem rodar em paralelo. Total: ~4-5h.

---

## #1 — Trocar senha admin `Antrop1a`  `[BLOQUEADOR]`

**Estado:** senha provisória `Antrop1a` documentada em vários `.md` do repo (credencial pública).
**Quem executa:** humano (Claude Code não tem acesso ao Supabase Dashboard).

**Ação:**
1. Acessar `https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud` → Authentication → Users
2. Localizar `admin@antrop-ia.com` (ou equivalente)
3. Resetar senha via "Send password recovery" OU rotacionar via SQL Editor
4. Remover toda menção a `Antrop1a` dos arquivos `.md`:

```bash
# Localizar todas as ocorrências
grep -rn "Antrop1a" --include="*.md" .

# Após rotação, fazer commit removendo:
# - GO_LIVE_CHECKLIST.md
# - claude.md
# - qualquer outro doc listado pelo grep
```

**Critério de pronto:** `grep -rn "Antrop1a" .` retorna zero resultados E login funciona com nova senha.

---

## #13 — Decisão: Supabase Pro vs Free  `[BLOQUEADOR]`

**Estado:** plano Free hoje. Limites: 60 conexões diretas, 200 pooled, 500 MB DB, 2 GB egress, snapshot diário sem PITR.
**Quem executa:** humano (decisão executiva).

**Recomendação default: upgrade para Pro (US$ 25/mês).**

| Critério | Free | Pro |
|---|---|---|
| Conexões pooled | 200 | 500 |
| DB size | 500 MB | 8 GB |
| Backup | Snapshot diário | PITR 7 dias |
| Suporte | Comunidade | Email Anthropic-tier |
| Custo/mês | 0 | US$ 25 |

**Quando NÃO subir:** se piloto for explicitamente <10 usuários e <3 meses, Free aguenta. Mas então `#12` (backup pg_dump) vira obrigatório porque snapshot Supabase Free pode sumir.

**Critério de pronto:** decisão registrada em `OPERATIONS.md` com data e responsável.

---

## #14 — Padronizar erros das edge functions  `[ALTO]`

**Estado:** inconsistente. `evolution-webhook` retorna **string** em 401/405 quebrando contrato JSON. Outras funções fazem `{ error: err.message }` em 500, vazando paths/SQL.

**Ação:** criar helper compartilhado e refatorar handlers.

**1. Criar `supabase/functions/_shared/errors.ts`:**

```typescript
// supabase/functions/_shared/errors.ts
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_PAYLOAD'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'WORKFLOW_EXECUTION_FAILED'
  | 'SMTP_DELIVERY_FAILED';

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    request_id: string;
  };
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  requestId?: string,
): Response {
  const rid = requestId ?? crypto.randomUUID();
  const body: ErrorBody = {
    error: { code, message, request_id: rid },
  };
  console.error(JSON.stringify({
    severity: 'ERROR',
    code,
    message,
    request_id: rid,
  }));
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': rid },
  });
}

// Para erros 500 inesperados: nunca expor err.message cru
export function internalError(err: unknown, requestId?: string): Response {
  const rid = requestId ?? crypto.randomUUID();
  console.error(JSON.stringify({
    severity: 'ERROR',
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    request_id: rid,
  }));
  return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error', rid);
}
```

**2. Refatorar `supabase/functions/evolution-webhook/index.ts`:**

```typescript
// ANTES (linhas ~6, ~14)
return new Response('Unauthorized', { status: 401 });
return new Response('Method not allowed', { status: 405 });

// DEPOIS
import { errorResponse } from '../_shared/errors.ts';
return errorResponse(401, 'UNAUTHORIZED', 'Invalid or missing webhook secret');
return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed');
```

**3. Refatorar TODAS as 7 edge functions:** substituir `return new Response(JSON.stringify({ error: err.message }), { status: 500 })` por `return internalError(err)`.

Lista dos arquivos a tocar:
- `supabase/functions/check-sla/index.ts`
- `supabase/functions/process-notifications/index.ts`
- `supabase/functions/generate-reports/index.ts`
- `supabase/functions/execute-workflow/index.ts`
- `supabase/functions/test-integration/index.ts`
- `supabase/functions/evolution-webhook/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`

**Critério de pronto:**
- `grep -rn "err.message" supabase/functions/` retorna zero em handlers de 500
- `grep -rn 'new Response(.*[Uu]nauthorized' supabase/functions/` retorna zero
- Cada função deploy passa com `supabase functions deploy <name>`
- Teste manual: chamar `evolution-webhook` com header errado deve retornar JSON `{ error: { code: 'UNAUTHORIZED', ... } }`

---

## #7 — CORS explícito no nginx do Cloud Run  `[BLOQUEADOR]`

**Estado:** nginx.conf não tem header CORS. Hoje Traefik (não em uso) tinha; Supabase resolve por JWT mas defense in depth vale.

**Ação:** editar `docker/nginx.conf`. Adicionar dentro do `server { ... }`:

```nginx
# Em docker/nginx.conf, dentro do bloco server { }
# Adicionar antes do "location / { ... }"

# CORS para o próprio domínio (assets estáticos não precisam, mas reforça)
add_header Access-Control-Allow-Origin "https://desk.antrop-ia.com" always;
add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
add_header Access-Control-Max-Age "3600" always;

# Preflight
location = /options {
  if ($request_method = 'OPTIONS') {
    return 204;
  }
}
```

**Adicional no Supabase Dashboard:**
- Settings → API → CORS Allowed Origins
- Adicionar: `https://desk.antrop-ia.com` e `https://staging-desk.antrop-ia.com`

**Critério de pronto:**
- `curl -I -H "Origin: https://desk.antrop-ia.com" https://desk.antrop-ia.com/` retorna `Access-Control-Allow-Origin: https://desk.antrop-ia.com`
- `curl -I -H "Origin: https://evil.com" https://desk.antrop-ia.com/` NÃO retorna o header

---

## #11 — Code splitting + manualChunks  `[ALTO]`

**Estado:** bundle único de 1.6 MB (~400-500 KB gzipado). Login carrega KB editor, workflow editor, reports — tudo. LCP ruim em mobile 3G/4G.

**Ação:** dois diffs separados.

**Diff 1 — `src/App.tsx` (lazy load de rotas):**

```typescript
// ANTES
import TicketsPage from './pages/tickets/TicketsPage';
import KbPage from './pages/knowledge/KbPage';
import ReportsPage from './pages/reports/ReportsPage';
// ... 20+ imports

// DEPOIS
import { lazy, Suspense } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen'; // criar se não existir

const TicketsPage = lazy(() => import('./pages/tickets/TicketsPage'));
const KbPage = lazy(() => import('./pages/knowledge/KbPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
// ... aplicar para TODAS as páginas EXCETO Login e ErrorBoundary

// Wrap Routes em Suspense
<Suspense fallback={<LoadingScreen />}>
  <Routes>
    <Route path="/tickets" element={<TicketsPage />} />
    {/* ... */}
  </Routes>
</Suspense>
```

**Manter sync (não lazy):** `Login`, `ErrorBoundary`, `Index`, `NotFound` — entram no first paint.

**Diff 2 — `vite.config.ts` (manualChunks):**

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => ({
  // ... config existente
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            // listar os que estão em uso — confirmar com `grep -r "@radix-ui" src/`
          ],
          'supabase': ['@supabase/supabase-js'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
```

**Critério de pronto:**
- `npm run build` produz `dist/assets/` com pelo menos 5 chunks (não 1)
- Chunk inicial `index-*.js` < 500 KB (gzipado < 150 KB)
- Lighthouse mobile 3G slow: LCP < 4s (antes provavelmente > 8s)

---

## #8 — CI mínimo: lint + typecheck + build  `[BLOQUEADOR]`

**Estado:** zero CI. Qualquer commit em `main` pode quebrar produção.

**Ação:**

**1. Adicionar script `typecheck` em `package.json`:**

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "lint": "oxlint",
    "build": "vite build"
  }
}
```

**2. Criar `.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install deps
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Build
        env:
          # Build precisa dos envs mesmo que sejam dummy no CI
          VITE_SUPABASE_URL: https://dummy.supabase.co
          VITE_SUPABASE_PUBLISHABLE_KEY: dummy-key
        run: npm run build
```

**3. No GitHub: Settings → Branches → Branch protection rules:**
- Branch name pattern: `main`
- Require status checks to pass: `validate`
- Require pull request reviews: 1 aprovação
- Include administrators: ✅

**Critério de pronto:**
- PR de teste com erro de TypeScript é bloqueado pelo CI
- PR não pode ser merged sem CI verde + 1 review
- Status checks aparecem na UI do GitHub

---

## #0a — SMTP via Resend  `[BLOQUEADOR FUNCIONAL]`

**Estado:** SMTP não cadastrado em produção. Zero email sai (convite, reset, notificação de ticket).
**Quem executa:** humano (cadastro Resend + DNS) + Claude Code (config no app).

**Ação:**
1. Criar conta em `https://resend.com` (free tier: 3k emails/mês, 100/dia)
2. Adicionar domínio `antrop-ia.com` → copiar DNS records (SPF, DKIM, DMARC) → adicionar no provedor de DNS
3. Validar domínio no Resend
4. Gerar API key
5. Cadastrar no Supabase Dashboard → Settings → Auth → SMTP Settings:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Pass: `<api-key>`
   - Sender: `noreply@antrop-ia.com`
6. Cadastrar dentro do app (Settings → Notifications) os mesmos dados
7. Testar com botão "Send test email"

**Critério de pronto:**
- Email de teste chega na caixa de entrada (não spam)
- DKIM passa em `https://www.mail-tester.com/` (score ≥ 8/10)
- Criar ticket de teste → email de notificação chega para o requester

---

## #0b — Agendar pg_cron jobs  `[BLOQUEADOR FUNCIONAL]`

**Estado:** edge functions `process-notifications`, `check-sla`, `generate-reports` existem mas **nenhum cron job está agendado**. Funcionam sob demanda apenas.

**Ação:** rodar no Supabase SQL Editor (depois de validar URLs e secrets):

```sql
-- 1. Garantir extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Salvar URL base e cron secret no vault
-- Settings → Vault → adicionar:
--   project_url    = https://wevgxuxaplcmrnsktoud.supabase.co
--   cron_secret    = <gerar via `openssl rand -hex 32`>
--   service_role_key = <da Settings → API>

-- 3. Process notifications a cada 1 minuto
SELECT cron.schedule(
  'process-notifications',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. Check SLA a cada 30 minutos
SELECT cron.schedule(
  'check-sla',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/check-sla',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. Generate reports a cada 1 hora
SELECT cron.schedule(
  'generate-reports',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/generate-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 6. Verificar
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**Validar nas edge functions que `x-cron-secret` é lido de `Deno.env.get('CRON_SECRET')`.**

**Critério de pronto:**
- `SELECT * FROM cron.job` mostra 3 jobs ativos
- Após 2 minutos: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC` mostra execuções com `status = 'succeeded'`
- Criar ticket de teste → após 1 min, registro em `notifications` muda de `PENDING` para `SENT`

---

## #0c — `due_date` calculado automaticamente  `[BLOQUEADOR FUNCIONAL]`

**Estado:** `RELATORIO_VALIDACAO_INTERNA.md` aponta que `due_date` não é calculado automaticamente no INSERT do ticket. SLA function tem nada para checar.

**Ação:** **preciso ver `supabase/migrations/` para confirmar se o trigger existe e está broken, ou se nunca foi criado.**

```bash
# Investigar antes de criar:
grep -rn "due_date" supabase/migrations/
grep -rn "sla_due_at" supabase/migrations/
grep -rn "calculate_sla" supabase/migrations/
```

**Se o trigger não existir, criar migration:**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_calculate_ticket_due_date.sql

CREATE OR REPLACE FUNCTION calculate_ticket_due_date()
RETURNS TRIGGER AS $$
DECLARE
  sla_hours INT;
BEGIN
  -- Mapear priority → SLA em horas (ajustar conforme regras do org)
  CASE NEW.priority
    WHEN 'URGENT' THEN sla_hours := 2;
    WHEN 'HIGH' THEN sla_hours := 8;
    WHEN 'MEDIUM' THEN sla_hours := 24;
    WHEN 'LOW' THEN sla_hours := 72;
    ELSE sla_hours := 24;
  END CASE;

  -- TODO: respeitar horário comercial do organization_settings
  -- Por enquanto, soma simples
  NEW.sla_due_at := NEW.created_at + (sla_hours || ' hours')::INTERVAL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_calculate_due_date
  BEFORE INSERT ON tickets
  FOR EACH ROW
  WHEN (NEW.sla_due_at IS NULL)
  EXECUTE FUNCTION calculate_ticket_due_date();
```

**Critério de pronto:**
- Criar ticket via UI sem `sla_due_at` → registro fica com `sla_due_at` preenchido
- `check-sla` executa e marca `sla_breached_at` quando devido

---

# FASE B — Fundação GCP (Dia 1 tarde)

Pré-requisito: seção "Pré-requisitos (Dia 0)" completa.

---

## #3 — Secrets no Secret Manager  `[BLOQUEADOR]`

**Estado:** segredos em `.env` local. Para Cloud Build ler em build time, precisam estar no Secret Manager.

**Ação:**

```bash
# Criar secrets (substituir valores reais)
echo -n "https://wevgxuxaplcmrnsktoud.supabase.co" | \
  gcloud secrets create supabase-url --data-file=-

echo -n "<VITE_SUPABASE_PUBLISHABLE_KEY real>" | \
  gcloud secrets create supabase-anon-key --data-file=-

echo -n "<service_role_key>" | \
  gcloud secrets create supabase-service-role --data-file=-

echo -n "<resend-api-key>" | \
  gcloud secrets create resend-api-key --data-file=-

# Sentry DSN será criado depois (Fase D #4)

# Verificar
gcloud secrets list
```

**IAM já foi concedido ao Cloud Build SA na Fase 0.**

**Adicional:** rotacionar `service_role_key` no Supabase Dashboard (Settings → API → Reset key) **antes** de adicionar ao Secret Manager — porque a atual está em `OPERATIONS.md` versionado.

**Critério de pronto:**
- `gcloud secrets list` mostra os 4 secrets
- `gcloud secrets versions access latest --secret=supabase-url` retorna a URL correta
- `OPERATIONS.md` não tem mais valores reais (substituir por `<no Secret Manager: supabase-service-role>`)

---

# FASE C — Pipeline + build (Dia 2)

---

## #2 — `cloudbuild.yaml` + trigger  `[BLOQUEADOR]`

**Estado:** nenhum pipeline existe. Deploy hoje é manual via `scripts/deploy.sh` (Docker Swarm, descontinuado).

**Ação:**

**1. Criar `cloudbuild.yaml` na raiz:**

```yaml
# cloudbuild.yaml
steps:
  # 1. Build da imagem Docker com build args do Secret Manager
  - name: 'gcr.io/cloud-builders/docker'
    id: 'build'
    args:
      - 'build'
      - '--build-arg=VITE_SUPABASE_URL=$$VITE_SUPABASE_URL'
      - '--build-arg=VITE_SUPABASE_PUBLISHABLE_KEY=$$VITE_SUPABASE_ANON_KEY'
      - '--tag=southamerica-east1-docker.pkg.dev/$PROJECT_ID/desk/app:$SHORT_SHA'
      - '--tag=southamerica-east1-docker.pkg.dev/$PROJECT_ID/desk/app:latest'
      - '--target=production'
      - '.'
    secretEnv: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

  # 2. Push pro Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    id: 'push'
    args: ['push', '--all-tags', 'southamerica-east1-docker.pkg.dev/$PROJECT_ID/desk/app']

  # 3. Deploy Cloud Run COM --no-traffic (canary manual)
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'deploy'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'desk'
      - '--image=southamerica-east1-docker.pkg.dev/$PROJECT_ID/desk/app:$SHORT_SHA'
      - '--region=southamerica-east1'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--no-traffic'  # deploy cria revisão mas não corta tráfego
      - '--port=8080'
      - '--memory=256Mi'
      - '--cpu=1'
      - '--min-instances=1'  # evitar cold start em horário comercial
      - '--max-instances=10'
      - '--set-env-vars=ENVIRONMENT=production'

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/supabase-url/versions/latest
      env: 'VITE_SUPABASE_URL'
    - versionName: projects/$PROJECT_ID/secrets/supabase-anon-key/versions/latest
      env: 'VITE_SUPABASE_ANON_KEY'

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'

timeout: '900s'
```

**2. Criar trigger:**

```bash
# Trigger no push para main
gcloud builds triggers create github \
  --name=desk-main-deploy \
  --repo-name=antropia-desk \
  --repo-owner=<seu-org> \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --region=southamerica-east1

# Trigger separado para staging (branch staging)
gcloud builds triggers create github \
  --name=desk-staging-deploy \
  --repo-name=antropia-desk \
  --repo-owner=<seu-org> \
  --branch-pattern="^staging$" \
  --build-config=cloudbuild-staging.yaml \
  --region=southamerica-east1
```

**3. Criar `cloudbuild-staging.yaml`** — mesma estrutura, mas service `desk-staging` e `--no-traffic` removido (tráfego direto, ambiente isolado).

**4. Promover canary manualmente após validação:**

```bash
# Listar revisões
gcloud run revisions list --service=desk --region=southamerica-east1

# Canary 10%
gcloud run services update-traffic desk \
  --to-revisions=desk-00012-abc=10,desk-00011-xyz=90 \
  --region=southamerica-east1

# Validar 10-30 min. Se ok:
gcloud run services update-traffic desk \
  --to-revisions=desk-00012-abc=100 \
  --region=southamerica-east1

# Rollback se quebrar:
gcloud run services update-traffic desk \
  --to-revisions=desk-00011-xyz=100 \
  --region=southamerica-east1
```

**5. Validar domínio no Search Console** (pré-requisito para domain mapping):
- `https://search.google.com/search-console` → adicionar `antrop-ia.com`
- Adicionar TXT record `google-site-verification=...` no DNS

**6. Domain mapping:**

```bash
gcloud beta run domain-mappings create \
  --service=desk \
  --domain=desk.antrop-ia.com \
  --region=southamerica-east1

# Pegar os CNAME records retornados e adicionar no DNS
# Aguardar ~15 min para cert managed ser emitido
```

**Critério de pronto:**
- Push em `main` dispara build automaticamente no Cloud Build
- Build verde produz imagem em Artifact Registry
- Nova revisão Cloud Run criada com `--no-traffic`
- Promoção manual a 100% via `update-traffic` funciona
- `https://desk.antrop-ia.com` responde HTTP 200 com cert válido

---

# FASE D — Observabilidade (Dia 3)

---

## #4 — Sentry no front  `[BLOQUEADOR]`

**Estado:** `@sentry/react` não instalado. `SENTRY_DSN` no `.env.example` mas placeholder. Erros em prod são invisíveis.

**Ação:**

**1. Instalar:**

```bash
npm install --save @sentry/react
```

**2. Criar conta Sentry SaaS** (`https://sentry.io`, free 5k events/mês) → criar projeto `antropia-desk-frontend` → copiar DSN.

**3. Salvar DSN no Secret Manager:**

```bash
echo -n "<sentry-dsn>" | gcloud secrets create sentry-dsn --data-file=-
```

**4. Adicionar build arg no `cloudbuild.yaml`:**

```yaml
# Em cloudbuild.yaml, step 'build', adicionar:
- '--build-arg=VITE_SENTRY_DSN=$$VITE_SENTRY_DSN'

# E em availableSecrets:
- versionName: projects/$PROJECT_ID/secrets/sentry-dsn/versions/latest
  env: 'VITE_SENTRY_DSN'
```

**5. Criar `src/lib/sentry.ts`:**

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN não configurado — erros não serão capturados');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION ?? 'unknown',
    tracesSampleRate: 0.1, // 10% das transações
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0, // captura replay quando há erro
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend(event) {
      // Filtrar erros conhecidos não-acionáveis
      if (event.message?.includes('ResizeObserver loop')) return null;
      return event;
    },
  });
}

export { Sentry };
```

**6. Inicializar em `src/main.tsx`** ANTES do render:

```typescript
// src/main.tsx
import { initSentry } from './lib/sentry';
initSentry();

// ... resto do código
```

**7. Wrap ErrorBoundary com Sentry:**

```typescript
// src/components/ErrorBoundary.tsx
import { Sentry } from '@/lib/sentry';

// No componentDidCatch:
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error(error, errorInfo);
  Sentry.captureException(error, { contexts: { react: errorInfo } });
}
```

**8. Handler global de unhandledrejection:**

```typescript
// src/main.tsx, antes do render
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});
```

**Critério de pronto:**
- Build local com `VITE_SENTRY_DSN=...` injetado funciona
- Dispara erro de teste: `throw new Error('Sentry test')` → aparece no dashboard Sentry em <1 min
- Tags `environment=production` e `release` aparecem corretas

---

## #5 — Uptime check + alert policy  `[BLOQUEADOR]`

**Estado:** zero monitor de uptime ativo. `/health` existe no nginx mas ninguém olha.

**Ação:**

```bash
# 1. Criar canal de notificação (email)
gcloud alpha monitoring channels create \
  --display-name="Desk alerts email" \
  --type=email \
  --channel-labels=email_address=alerts@antrop-ia.com

# Pegar o channel name retornado, ex:
# projects/antropia-desk/notificationChannels/1234567890

# 2. Uptime check (via UI é mais simples — Console → Monitoring → Uptime checks)
#    Configurar:
#    - URL: https://desk.antrop-ia.com/health
#    - Frequência: 1 min
#    - Regiões: USA + Brasil + Europa
#    - Timeout: 10s
#    - Validação: HTTP 200 + body contém "healthy"

# 3. Alert policy: 2 falhas consecutivas → email + Slack
#    Console → Monitoring → Alerting → Create policy
#    Condition: Uptime check on desk-health failing
#    Trigger: 1 location for 2 minutes
#    Notification channel: alerts@antrop-ia.com
```

**Segundo monitor externo (UptimeRobot — opcional mas recomendado):**
- `https://uptimerobot.com` → criar HTTP(s) monitor → `https://desk.antrop-ia.com/health`
- Frequência 5 min, alertas email
- Por que? Se GCP cair, Cloud Monitoring cai junto. UptimeRobot é o "second opinion" externo.

**Critério de pronto:**
- Console GCP → Monitoring → Uptime checks mostra check com status verde
- Simular falha (parar Cloud Run temporariamente): email chega em <3 min
- Status page interna `/admin/status` reflete corretamente

---

# FASE E — Defesa em profundidade (Dia 4)

---

## #6 — Cloud Armor / rate limit em `/auth/*`  `[ALTO]`

**Estado:** zero rate limit no front. Supabase tem nativo no `/auth/v1/token` mas não cobre tráfego do nosso domínio.

**Decisão arquitetural:**

| Opção | Custo/mês | Complexidade | Quando usar |
|---|---|---|---|
| Cloudflare na frente Cloud Run | Free | Baixa | **Default** — DDoS + cache grátis |
| HTTPS LB + Cloud Armor | ~US$ 18 | Média | Quando precisar de WAF rules específicas |
| Cloud Run sem proteção | 0 | — | NÃO. Sem proteção pra senha brute force |

**Recomendação default: Cloudflare proxy mode.**

**Ação — Cloudflare:**
1. Mover DNS de `antrop-ia.com` para Cloudflare (se não estiver)
2. Criar registro CNAME `desk` → `ghs.googlehosted.com` com proxy ON (laranja)
3. Cloudflare Dashboard → Security → WAF → Rate limiting:
   - Path matches `/auth/*` OU `*token*`
   - Threshold: 10 requests / 1 min por IP
   - Action: Block 5 min
4. Cloudflare → Security → Bots → modo "Fight mode"

**Alternativa — Cloud Armor (só se descartar Cloudflare):**

```bash
# Criar política
gcloud compute security-policies create desk-armor \
  --description="Rate limit auth endpoints"

# Regra: rate limit em /auth/*
gcloud compute security-policies rules create 1000 \
  --security-policy=desk-armor \
  --expression="request.path.matches('/auth/.*')" \
  --action=rate-based-ban \
  --rate-limit-threshold-count=10 \
  --rate-limit-threshold-interval-sec=60 \
  --ban-duration-sec=300 \
  --conform-action=allow \
  --exceed-action=deny-429 \
  --enforce-on-key=IP

# Exige criar HTTPS LB → Cloud Run NEG. ~1h adicional de setup.
```

**Critério de pronto:**
- Tentar 15 logins em <1 min do mesmo IP → bloqueio 429 ativa
- Login legítimo continua funcionando
- Dashboard Cloudflare mostra requests bloqueadas

---

## #10 — Teste pgtap de RLS  `[ALTO]`

**Estado:** ~60 policies RLS escritas à mão, zero teste automatizado. Migrations recentes corrigiram falhas reais (`critical_rls_security_fixes`, `fix_kb_articles_user_visibility`). Sem teste = risco recorrente.

**Ação:** suite mínima pgtap cobrindo isolamento entre orgs.

**1. Instalar pgtap no projeto Supabase staging** (SQL Editor):

```sql
CREATE EXTENSION IF NOT EXISTS pgtap;
```

**2. Criar `supabase/tests/rls/tickets_isolation.sql`:**

```sql
BEGIN;
SELECT plan(8);

-- Setup: criar 2 orgs e 2 users
INSERT INTO organizations (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Org A'),
  ('22222222-2222-2222-2222-222222222222', 'Org B');

-- Simular auth.users (em test, criar profiles diretamente)
INSERT INTO profiles (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-a@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user-b@test.com');

INSERT INTO memberships (user_id, organization_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'ADMIN'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'ADMIN');

-- Criar 1 ticket em cada org
INSERT INTO tickets (id, organization_id, requester_id, title, status, priority)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Ticket Org A', 'OPEN', 'MEDIUM'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Ticket Org B', 'OPEN', 'MEDIUM');

-- TESTE 1: User A logado SÓ vê ticket da Org A
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET LOCAL role = 'authenticated';

SELECT results_eq(
  $$ SELECT count(*)::int FROM tickets $$,
  $$ VALUES (1) $$,
  'User A vê apenas 1 ticket (o da própria org)'
);

SELECT results_eq(
  $$ SELECT organization_id FROM tickets $$,
  $$ VALUES ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'Ticket visível para User A é da Org A'
);

-- TESTE 2: User B logado SÓ vê ticket da Org B
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT results_eq(
  $$ SELECT count(*)::int FROM tickets $$,
  $$ VALUES (1) $$,
  'User B vê apenas 1 ticket'
);

SELECT results_eq(
  $$ SELECT organization_id FROM tickets $$,
  $$ VALUES ('22222222-2222-2222-2222-222222222222'::uuid) $$,
  'Ticket visível para User B é da Org B'
);

-- TESTE 3: User A NÃO pode UPDATE em ticket da Org B
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT throws_ok(
  $$ UPDATE tickets SET title = 'hacked'
     WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$,
  NULL,
  'RLS bloqueia UPDATE cross-org'
);

-- TESTE 4: User A NÃO pode DELETE em ticket da Org B
SELECT throws_ok(
  $$ DELETE FROM tickets WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$,
  NULL,
  'RLS bloqueia DELETE cross-org'
);

-- TESTE 5: User role USER vê apenas próprios tickets
-- (criar user_c com role USER na Org A, validar que não vê ticket de outro user da mesma org)
-- ... expandir conforme regras de negócio

SELECT * FROM finish();
ROLLBACK;
```

**3. Replicar para `kb_articles`, `notifications`, `attachments` —** o padrão é o mesmo, mudar tabela e regras.

**4. Rodar em CI (futuro) ou manualmente em staging:**

```bash
# Via psql contra staging
psql "$STAGING_DB_URL" -f supabase/tests/rls/tickets_isolation.sql
```

**Critério de pronto:**
- 8 testes passam em `tickets_isolation.sql`
- Pelo menos 3 tabelas críticas têm suite (`tickets`, `kb_articles`, `notifications`)
- README em `supabase/tests/rls/` documenta como rodar

---

## #12 — Backup pg_dump → GCS + teste de restore  `[ALTO]`

**Estado:** `scripts/backup-supabase.sh` existe mas não roda agendado. Sem PITR no Free.

**Ação:**

**1. Criar bucket GCS:**

```bash
gsutil mb -l southamerica-east1 -c STANDARD gs://antropia-desk-backups
gsutil versioning set on gs://antropia-desk-backups

# Lifecycle: Standard 30d → Nearline 90d → delete 365d
cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {"action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
       "condition": {"age": 30}},
      {"action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
       "condition": {"age": 90}},
      {"action": {"type": "Delete"},
       "condition": {"age": 365}}
    ]
  }
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://antropia-desk-backups
```

**2. Salvar connection string do Supabase no Secret Manager:**

```bash
# DB URL com password — pegar em Supabase Dashboard → Project Settings → Database
echo -n "postgresql://postgres.wevgxuxaplcmrnsktoud:<pwd>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" | \
  gcloud secrets create supabase-db-url --data-file=-
```

**3. Adaptar `scripts/backup-supabase.sh` para upload no GCS:**

```bash
#!/usr/bin/env bash
set -euo pipefail

DATE=$(date -u +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/desk-backup-${DATE}.dump"
DB_URL="${SUPABASE_DB_URL}"
GCS_BUCKET="gs://antropia-desk-backups"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup..."

# Dump em formato custom (permite restore seletivo)
pg_dump "$DB_URL" -Fc -f "$BACKUP_FILE" --no-owner --no-acl

# Upload com retry
gcloud storage cp "$BACKUP_FILE" "${GCS_BUCKET}/daily/desk-${DATE}.dump"

# Cleanup local
rm "$BACKUP_FILE"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup uploaded: desk-${DATE}.dump"
```

**4. Criar Cloud Run Job:**

```bash
# Build imagem com pg_dump + gcloud
cat > Dockerfile.backup <<EOF
FROM google/cloud-sdk:slim
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*
COPY scripts/backup-supabase.sh /backup.sh
RUN chmod +x /backup.sh
ENTRYPOINT ["/backup.sh"]
EOF

gcloud builds submit --tag southamerica-east1-docker.pkg.dev/antropia-desk/desk/backup:latest -f Dockerfile.backup .

# Criar Cloud Run Job
gcloud run jobs create desk-backup \
  --image=southamerica-east1-docker.pkg.dev/antropia-desk/desk/backup:latest \
  --region=southamerica-east1 \
  --set-secrets=SUPABASE_DB_URL=supabase-db-url:latest \
  --max-retries=2 \
  --task-timeout=15m
```

**5. Agendar via Cloud Scheduler (diário 02:00 BRT = 05:00 UTC):**

```bash
gcloud scheduler jobs create http desk-backup-daily \
  --location=southamerica-east1 \
  --schedule="0 5 * * *" \
  --time-zone="UTC" \
  --uri="https://southamerica-east1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/antropia-desk/jobs/desk-backup:run" \
  --http-method=POST \
  --oauth-service-account-email="cloudbuild-deploy@antropia-desk.iam.gserviceaccount.com"
```

**6. TESTE DE RESTORE (não-negociável):**

```bash
# Baixar backup mais recente
gcloud storage cp gs://antropia-desk-backups/daily/$(gcloud storage ls gs://antropia-desk-backups/daily/ | tail -1) /tmp/test-restore.dump

# Restore em projeto Supabase STAGING (NUNCA produção)
pg_restore -d "$STAGING_DB_URL" --clean --if-exists --no-owner --no-acl /tmp/test-restore.dump

# Validar:
psql "$STAGING_DB_URL" -c "SELECT count(*) FROM tickets;"
psql "$STAGING_DB_URL" -c "SELECT count(*) FROM organizations;"
```

**Critério de pronto:**
- Backup roda às 02:00 BRT e arquivo aparece em `gs://antropia-desk-backups/daily/`
- Cloud Scheduler mostra "Successful" no log
- **Teste de restore validado em staging** (sem isso, backup não existe)
- Documentar comando de restore em `OPERATIONS.md`

---

# FASE F — Validação + canary (Dia 5)

---

## #9 — Smoke E2E Playwright  `[BLOQUEADOR]`

**Estado:** zero teste automatizado. Smoke depende de revisão manual.

**Ação:**

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

**Criar `e2e/smoke.spec.ts`:**

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://staging-desk.antrop-ia.com';
const TEST_USER = process.env.E2E_USER ?? 'smoke@antrop-ia.com';
const TEST_PASS = process.env.E2E_PASS ?? '';

test('smoke: login → criar ticket → mensagem', async ({ page }) => {
  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', TEST_USER);
  await page.fill('input[name="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/tickets|\/dashboard/, { timeout: 10000 });

  // Criar ticket
  await page.goto(`${BASE_URL}/tickets/new`);
  await page.fill('input[name="title"]', `Smoke test ${Date.now()}`);
  await page.fill('textarea[name="description"]', 'Smoke E2E from Playwright');
  await page.click('button:has-text("Criar")');
  await expect(page.locator('text=Smoke test')).toBeVisible({ timeout: 10000 });

  // Adicionar mensagem
  await page.fill('textarea[name="message"]', 'Mensagem de teste');
  await page.click('button:has-text("Enviar")');
  await expect(page.locator('text=Mensagem de teste')).toBeVisible();
});
```

**Adicionar ao CI:**

```yaml
# .github/workflows/ci.yml — novo job
  e2e:
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'push' && github.ref == 'refs/heads/staging'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          E2E_BASE_URL: https://staging-desk.antrop-ia.com
          E2E_USER: ${{ secrets.E2E_USER }}
          E2E_PASS: ${{ secrets.E2E_PASS }}
```

**Critério de pronto:**
- `npx playwright test` passa em staging
- Job E2E rodando no CI em push para `staging`
- Falha do teste bloqueia promoção para `main`

---

## Promoção final para produção

Depois de **todos os itens acima verdes em staging**:

```bash
# 1. Merge staging → main (dispara cloudbuild.yaml de prod)
git checkout main
git merge staging
git push origin main

# 2. Build cria revisão Cloud Run com --no-traffic
# 3. Smoke manual no Cloud Run URL diretamente:
curl https://desk-xxxxx-rj.a.run.app/health

# 4. Canary 10%
gcloud run services update-traffic desk \
  --to-revisions=desk-NEW=10,desk-OLD=90 \
  --region=southamerica-east1

# 5. Monitorar Sentry + Uptime check por 30 min
# Se 0 erros novos e latência p95 estável:

# 6. Canary 50%
gcloud run services update-traffic desk \
  --to-revisions=desk-NEW=50,desk-OLD=50 \
  --region=southamerica-east1

# Mais 30 min de monitoramento

# 7. 100%
gcloud run services update-traffic desk \
  --to-revisions=desk-NEW=100 \
  --region=southamerica-east1
```

**Rollback (a qualquer momento):**

```bash
gcloud run services update-traffic desk \
  --to-revisions=desk-OLD=100 \
  --region=southamerica-east1
# < 30 segundos para reverter
```

---

# Resumo executivo da ordem

| # | Item | Fase | Dia | Bloqueia | Esforço |
|---|---|---|---|---|---|
| #1 | Trocar senha admin | A | 1 | — | 5 min |
| #13 | Decidir Supabase Pro | A | 1 | — | Decisão |
| #14 | Padronizar erros edge fns | A | 1 | — | 2h |
| #7 | CORS nginx | A | 1 | — | 15 min |
| #11 | Code splitting | A | 1 | #2 (build) | 3h |
| #8 | CI mínimo | A | 1 | — | 1h |
| #0a | SMTP Resend | A | 1 | — | 45 min |
| #0b | Cron jobs pg_cron | A | 1 | — | 15 min |
| #0c | due_date trigger | A | 1 | — | 1h |
| GCP setup | Projeto + APIs + SA | B | 1 | #3 | 2h |
| #3 | Secret Manager | B | 1 | #2, #4, #12 | 1h |
| #2 | cloudbuild.yaml + trigger | C | 2 | #4, #5, #9 | 3h |
| Deploy staging | — | C | 2 | #4, #5, #9 | 1h |
| #4 | Sentry | D | 3 | — | 1h |
| #5 | Uptime + alert | D | 3 | — | 30 min |
| #6 | Cloud Armor / Cloudflare | E | 4 | — | 1h |
| #10 | pgtap RLS | E | 4-5 | — | 1-2 dias |
| #12 | Backup GCS + restore | E | 4 | — | 3h |
| #9 | Playwright E2E | F | 5 | Promoção 100% | 2h |
| Canary deploy | — | F | 5 | — | 1h |

**Total realista: 5 dias úteis com 1 dev focado.**

---

## Anti-distração

Se durante a execução aparecer:
- "Vamos migrar pra TanStack Query" → **não nesse sprint** (esforço 2-3 sprints, fora do escopo)
- "Vamos refatorar Contexts para Zustand real" → **não nesse sprint** (premature optimization)
- "Vamos auto-hospedar Grafana/Loki" → **não** (Cloud Monitoring nativo cobre)
- "Vamos abrir API pública versionada" → **não** (1 cliente hoje, versionamento prematuro)
- "Vamos cobertura de testes unitários em todos services" → **pós-go-live incremental**

Foco no objetivo: `desk.antrop-ia.com` no Cloud Run, observável, com backup testado, CI verde, sem credencial pública, com SLA + notificações funcionando.
