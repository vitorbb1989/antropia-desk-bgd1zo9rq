# Antrop-IA Desk

Sistema de helpdesk e ticketing da Antrop-IA. Multi-tenant, com SLA automático,
KB, workflows, integrações (Planka, Bookstack, Krayin, Chatwoot, Typebot,
WhatsApp via Evolution API) e canais de notificação por email/WhatsApp.

Em produção: **https://desk.antrop-ia.com**

## Arquitetura

```
Browser  ──HTTPS──▶  Cloud Run (nginx + bundle Vite, southamerica-east1)
                                │
                                ▼
                        Supabase BaaS
                        (Postgres + Auth + Storage + Realtime + Edge Functions)
                                │
                                ▼
                        Resend (SMTP) / Evolution API (WhatsApp)
```

- **Front:** SPA React 19 + Vite, servida estática por nginx num container no Cloud Run
- **Back:** sem backend Node próprio. Toda lógica vive em
  - Postgres (RLS + triggers + RPC functions)
  - Edge Functions Deno no Supabase (`process-notifications`, `check-sla`,
    `generate-reports`, `execute-workflow`, `test-integration`,
    `evolution-webhook`, `whatsapp-webhook`)
- **Jobs:** `pg_cron` dispara as edge functions (`* * * * *`,
  `*/30 * * * *`, `0 * * * *`) + retention diária + alerta semanal de uso

Detalhes técnicos por área:
- Banco / migrations / RLS: `supabase/migrations/`, `supabase/tests/rls/`
- Edge functions: `supabase/functions/`
- Deploy / Cloud Build: `cloudbuild.yaml`, `cloudbuild-staging.yaml`

## Documentos vivos

| Arquivo | Quando consultar |
|---|---|
| [`OPERATIONS.md`](./OPERATIONS.md) | Operação dia-a-dia: comandos, monitoramento, checklists semanal/mensal, gatilhos para upgrade Supabase Pro |
| [`SUPABASE_RUNBOOK.md`](./SUPABASE_RUNBOOK.md) | Passo-a-passo Supabase para go-live (rotação de credenciais, SMTP, migrations, cron, validação) |
| [`GO_LIVE_CHECKLIST.md`](./GO_LIVE_CHECKLIST.md) | Checklist humano de coisas a fazer antes/durante o go-live |
| [`pllano de melhorias.md`](./pllano%20de%20melhorias.md) | Plano de execução completo da migração para GCP |
| [`PANORAMA.md`](./PANORAMA.md) | Visão geral do projeto e status atual |
| [`claude.md`](./claude.md) | Contexto técnico para o agente (Claude Code) |

Arquivos históricos / frozen-in-time em [`legacy/`](./legacy/) — Docker
Swarm, Traefik, monitoring auto-hospedado, relatórios antigos.

## Stack

- **TypeScript** + **React 19** + **Vite 5** (build via Rolldown)
- **shadcn/ui** (Radix primitives) + Tailwind CSS + lucide-react
- **Zustand-like Contexts** (14 stores em `src/stores/`)
- **react-router-dom v7**, **react-hook-form** + **Zod**, **Recharts**
- **@supabase/supabase-js** (PostgREST + RPC + RLS, sem ORM)
- **Sentry** (`@sentry/react`) para error tracking no front
- **Playwright** para smoke E2E

## Comandos

```bash
# Local
npm install
npm run dev              # http://localhost:8080

# Validação (igual ao CI)
npm run lint
npm run typecheck        # hoje non-blocking — ver task pendente em CI
npm run build

# Tests
npm run e2e:install      # uma vez
npm run e2e              # roda Playwright contra staging por padrão

# Build do container (mesma imagem que o Cloud Build produz)
docker build \
  --build-arg VITE_SUPABASE_URL=https://wevgxuxaplcmrnsktoud.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=<anon> \
  --target production \
  -t desk:local .
```

## Deploy

Automático via **Cloud Build trigger** no push para `main` (definido em
`cloudbuild.yaml`):

1. Build da imagem com `--build-arg` injetado do Secret Manager
2. Push para Artifact Registry (`southamerica-east1-docker.pkg.dev`)
3. `gcloud run deploy desk --no-traffic` — cria revisão sem cortar tráfego
4. **Promoção manual** via `gcloud run services update-traffic` (canary):

```bash
# Listar revisões
gcloud run revisions list --service=desk --region=southamerica-east1

# Canary 10%
gcloud run services update-traffic desk \
  --to-revisions=desk-NEW=10,desk-OLD=90 \
  --region=southamerica-east1

# Promover ou rollback
gcloud run services update-traffic desk --to-revisions=desk-NEW=100  --region=southamerica-east1
gcloud run services update-traffic desk --to-revisions=desk-OLD=100  --region=southamerica-east1
```

Staging em branch `staging` (`cloudbuild-staging.yaml`) — sobe direto em
`desk-staging` sem `--no-traffic`.

## Backup

`scripts/backup-supabase-gcs.sh` + `Dockerfile.backup` rodam em Cloud Run
Job agendado pelo Cloud Scheduler. Schedule **2x/dia** no Free
(`0 5,17 * * *` = 02h/14h BRT), **1x/dia** depois de upgrade Pro.

Restore drill **mensal obrigatório** em projeto Supabase staging dedicado —
ver `OPERATIONS.md` seção *Checklist mensal*.

## Plano (Supabase Free)

Hoje rodamos no plano Free. Limites e gatilhos para upgrade Pro estão
documentados em `OPERATIONS.md` seção *Operação no Supabase Free*. Os
artefatos defensivos contra esses limites:

- **Backup próprio** em GCS 2x/dia
- **Cron `retention-cleanup`** diário (archive + purge integration_logs)
- **Cron `db-size-alert`** semanal (email quando DB > 70%)
- **Uptime check** no `/rest/v1/` a cada 5 min (keep-alive + monitor)

## Estrutura

```
src/                    # front Vite
  App.tsx               # router com React.lazy
  components/           # shadcn/ui + dashboard, ticket, kb, settings...
  pages/                # rotas: auth, tickets, admin, knowledge, reports, settings, docs
  services/             # 13 services para Supabase (ticketService, kbService, ...)
  stores/               # 14 Contexts (não Zustand puro apesar do nome)
  lib/sentry.ts         # init centralizado
supabase/
  migrations/           # ~25 SQL versionadas
  functions/            # 7 edge functions Deno (+ _shared/)
  tests/rls/            # pgtap suite de isolamento cross-org
docker/                 # nginx.conf + entrypoint usados pela imagem
e2e/                    # Playwright smoke
.github/workflows/      # CI: lint + typecheck + build (+ e2e em staging)
cloudbuild.yaml         # pipeline produção
cloudbuild-staging.yaml # pipeline staging
Dockerfile              # multi-stage: builder Vite → nginx-unprivileged
Dockerfile.backup       # imagem do Cloud Run Job de backup
scripts/                # backup, create-tenant, load-test, security-check
legacy/                 # Docker Swarm / Traefik / monitoring antigo
```
