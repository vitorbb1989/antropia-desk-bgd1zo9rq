# Legacy — Docker Swarm + Traefik + monitoring auto-hospedado

Conteúdo desta pasta é **referência histórica**. Não usar em produção.

## Por que está aqui

O projeto rodava em **Docker Swarm na VM** com **Traefik** para TLS/proxy
e **Prometheus + Grafana + Loki** auto-hospedados para monitoramento.

Em **maio/2026** migramos para:

- **Cloud Run** (front estático servido por nginx) — ver `cloudbuild.yaml` na raiz
- **Cloud Monitoring + Logging + Error Reporting** — substitui Prometheus/Grafana/Loki
- **Cloud Build** + Artifact Registry — substitui `scripts/deploy.sh`
- **Cloud Armor + Cloudflare** — substitui middlewares Traefik (`guardrails/`)

Tudo aqui pode ser deletado quando ficar claro que ninguém mais consulta.
Mantido por enquanto para:
- Auditar decisões passadas
- Reativar rapidamente se houver pivot para self-hosting
- Reaproveitar trechos de scripts (ex: lógica de health check, load test)

## Conteúdo

| Arquivo / pasta | Propósito original |
|---|---|
| `docker-compose.prod.yml` | Stack completa Docker Swarm com 3 réplicas, secrets, placement |
| `docker-compose.traefik.yml` | Stack simplificada com 1 réplica + Traefik + Let's Encrypt |
| `Makefile` | `make deploy`, `make rollback`, `make status` — todos batem em Swarm |
| `one-click-setup.sh` | Instala Docker, joga node em Swarm, sobe a stack |
| `run-with-traefik.sh` | Sobe a stack com Traefik |
| `apply_security_migrations.sh` | One-off para aplicar migrations de RLS críticas em fev/2026 |
| `monitoring/` | Configs Prometheus, Grafana, Loki para self-hosted |
| `guardrails/` | Middlewares Traefik (rate limit, circuit breaker, headers) |
| `scripts/auto-deploy.sh` | Pipeline deploy automatizado para Swarm |
| `scripts/deploy.sh` | Deploy manual para Swarm |
| `scripts/guardrails.sh` | Aplica/valida middlewares Traefik |
| `scripts/health-check.sh` | Health check via `docker service` |
| `scripts/post-deploy-tests.sh` | Smoke tests pós-deploy via `docker exec` |
| `scripts/secrets.sh` | Gerencia `docker secret` no Swarm |
| `scripts/backup-supabase.sh` | Backup pg_dump para diretório local (substituído por `backup-supabase-gcs.sh`) |
| `docs/INSTALLATION.md` | Instruções de instalação na VM com Docker Swarm |
| `docs/APPLY_SECURITY_FIXES.md` | One-off de aplicar migrations de segurança |
| `docs/RELATORIO_CONSOLIDADO_SEGURANCA_PRODUCAO.md` | Relatório frozen-in-time (fev/2026) |
| `docs/RELATORIO_VALIDACAO_INTERNA.md` | Validação frozen-in-time (mai/2026) |
| `docs/TECHNICAL_REPORT.md` | Documento técnico inicial |

## O que substituir cada item por

| Você queria | Use agora |
|---|---|
| `make deploy` | `git push origin main` → Cloud Build dispara o pipeline |
| `make rollback` | `gcloud run services update-traffic desk --to-revisions=<old>=100` |
| `make status` | `gcloud run services describe desk --region=southamerica-east1` |
| Prometheus / Grafana | Cloud Monitoring dashboards |
| Loki | Cloud Logging |
| Traefik + Let's Encrypt | Cloud Run Domain Mapping (cert managed) |
| `scripts/backup-supabase.sh` | `scripts/backup-supabase-gcs.sh` + Cloud Scheduler + Cloud Run Job |
| `scripts/health-check.sh` | Cloud Monitoring Uptime Check em `/health` |
