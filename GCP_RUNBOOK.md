# GCP RUNBOOK — Go-Live

> **Pré-requisito:** `SUPABASE_RUNBOOK.md` 100% concluído (migrations aplicadas, SMTP, cron jobs, secrets, DB URL capturada).
> **Tempo total:** ~3h sequenciais, divisíveis em 2 sessões.
> **Custo estimado mensal:** US$ 5–15 (Cloud Run min-instances=1 + LB se ativar + Cloud Scheduler grátis + Artifact Registry grátis até 0.5 GB).

Cada passo tem **COMANDO** + **OUTPUT ESPERADO** + **VALIDAÇÃO**. Não pule validações.

---

## Convenções

```bash
# Variáveis usadas em todos os comandos abaixo. Ajustar se necessário.
export PROJECT_ID="antropia-desk"
export REGION="southamerica-east1"
export REPO="desk"
export SERVICE="desk"
export DOMAIN="desk.antrop-ia.com"
export ALERT_EMAIL="accounts@antrop-ia.com"
```

Vai usar esses `$PROJECT_ID`, `$REGION` etc. nos comandos. Cole as 7 linhas acima no terminal e mantenha o terminal aberto até o final.

---

## PASSO 0 — Autenticação local + projeto + billing (10 min) `[BLOQUEADOR]`

### 0.1 — Instalar gcloud (se ainda não tem)

```bash
# macOS
brew install --cask google-cloud-sdk

# Linux/WSL
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### 0.2 — Login

```bash
gcloud auth login
gcloud auth application-default login
```

Abre browser → escolhe conta com permissão de Owner/Editor.

### 0.3 — Criar / selecionar projeto

```bash
# Se for criar agora:
gcloud projects create $PROJECT_ID --name="Antrop-IA Desk"

# OU se já existe:
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION
gcloud config set artifacts/location $REGION
```

### 0.4 — Vincular billing account (necessário para Cloud Run/Build)

```bash
# Listar billing accounts disponíveis
gcloud billing accounts list

# Vincular (substituir XXXX pelo ID listado acima)
gcloud billing projects link $PROJECT_ID --billing-account=XXXXXX-XXXXXX-XXXXXX
```

### Validação 0

```bash
gcloud config list
# Deve mostrar:
#   project = antropia-desk
#   run/region = southamerica-east1

gcloud billing projects describe $PROJECT_ID --format='value(billingEnabled)'
# Deve retornar: True
```

---

## PASSO 1 — Habilitar APIs (5 min) `[BLOQUEADOR]`

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  cloudscheduler.googleapis.com \
  compute.googleapis.com \
  logging.googleapis.com \
  iam.googleapis.com
```

Demora 30–60s.

### Validação 1

```bash
gcloud services list --enabled --filter='name:(run.googleapis.com OR cloudbuild.googleapis.com OR artifactregistry.googleapis.com OR secretmanager.googleapis.com)' --format='value(NAME)'
# Deve listar as 4
```

---

## PASSO 2 — Artifact Registry (3 min)

Onde as imagens Docker vão viver.

```bash
gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="Antropia Desk container images"
```

### Validação 2

```bash
gcloud artifacts repositories list --location=$REGION
# Deve mostrar repositório `desk` com formato DOCKER
```

---

## PASSO 3 — Secret Manager (15 min) `[BLOQUEADOR]`

Cadastrar os 5 secrets que o Cloud Build vai consumir. **Pegar os valores do cofre conforme você salvou no Supabase Runbook.**

### 3.1 — Criar secrets

```bash
# Supabase
echo -n "https://wevgxuxaplcmrnsktoud.supabase.co" \
  | gcloud secrets create supabase-url --data-file=-

echo -n "<VITE_SUPABASE_PUBLISHABLE_KEY do Supabase Dashboard → Settings → API>" \
  | gcloud secrets create supabase-anon-key --data-file=-

echo -n "<service_role_key rotacionada no passo A.2 do Supabase Runbook>" \
  | gcloud secrets create supabase-service-role --data-file=-

# DB URL para o Cloud Run Job de backup (passo do Supabase Runbook I)
echo -n "postgresql://postgres.wevgxuxaplcmrnsktoud:<pwd>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" \
  | gcloud secrets create supabase-db-url --data-file=-

# Resend (já configurado no Supabase Auth, mas precisamos aqui se algum
# script futuro for chamar a API do Resend direto)
echo -n "<re_xxxxxxx do Resend>" \
  | gcloud secrets create resend-api-key --data-file=-

# Sentry — criar conta primeiro em https://sentry.io
# Project = antropia-desk-frontend → copiar DSN
echo -n "<sentry-dsn>" \
  | gcloud secrets create sentry-dsn --data-file=-
```

### 3.2 — Para staging (se for usar)

Você pode reusar os mesmos secrets em staging OU criar projeto Supabase
dedicado e secrets separados. Para começar mais simples, reuse:

```bash
# Opcional — só se quiser dual-project (staging com Supabase isolado)
# Caso contrário, ajustar cloudbuild-staging.yaml para usar os 'supabase-url' etc.
```

### Validação 3

```bash
gcloud secrets list --format='value(name)'
# Deve listar pelo menos: supabase-url, supabase-anon-key, supabase-service-role,
# supabase-db-url, resend-api-key, sentry-dsn

# Conferir um valor (não imprime no histórico se você redirecionar):
gcloud secrets versions access latest --secret=supabase-url
# Deve retornar a URL do Supabase
```

---

## PASSO 4 — Service Account + IAM (10 min) `[BLOQUEADOR]`

Cloud Build vai precisar permissões. Em vez de usar o default
`<num>@cloudbuild.gserviceaccount.com` com poderes amplos, criamos uma SA
dedicada com **roles mínimos**.

### 4.1 — Criar SA

```bash
gcloud iam service-accounts create cloudbuild-deploy \
  --display-name="Cloud Build deploy SA"

export DEPLOY_SA="cloudbuild-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
```

### 4.2 — Roles mínimos

```bash
# Deploy no Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOY_SA" \
  --role="roles/run.admin"

# Permissão para "atuar como" a SA do Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOY_SA" \
  --role="roles/iam.serviceAccountUser"

# Acessar secrets em build time
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOY_SA" \
  --role="roles/secretmanager.secretAccessor"

# Push para Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOY_SA" \
  --role="roles/artifactregistry.writer"

# Logs do Cloud Build
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOY_SA" \
  --role="roles/logging.logWriter"

# Disparar Cloud Run Jobs (backup será chamado pelo Scheduler com essa SA)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOY_SA" \
  --role="roles/run.invoker"
```

### Validação 4

```bash
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:$DEPLOY_SA" \
  --format='value(bindings.role)'
# Deve listar os 6 roles acima
```

---

## PASSO 5 — Conectar repo GitHub ao Cloud Build (15 min) `[BLOQUEADOR]`

Cloud Build precisa autorização para puxar do GitHub. Isso é **clique no console**, não tem comando equivalente.

### 5.1 — Console

1. Abrir https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID
2. **Manage repositories → Connect repository**
3. Source: **GitHub (Cloud Build GitHub App)**
4. Autenticar → autorizar a Cloud Build GitHub App no repositório `vitorbb1989/antropia-desk-bgd1zo9rq`
5. Voltar para a lista de triggers — repo deve aparecer como conectado

### 5.2 — Criar trigger de produção

```bash
gcloud builds triggers create github \
  --name=desk-main-deploy \
  --repo-name=antropia-desk-bgd1zo9rq \
  --repo-owner=vitorbb1989 \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --region=$REGION \
  --service-account=projects/$PROJECT_ID/serviceAccounts/$DEPLOY_SA
```

### 5.3 — Trigger de staging (opcional, recomendado)

```bash
gcloud builds triggers create github \
  --name=desk-staging-deploy \
  --repo-name=antropia-desk-bgd1zo9rq \
  --repo-owner=vitorbb1989 \
  --branch-pattern="^staging$" \
  --build-config=cloudbuild-staging.yaml \
  --region=$REGION \
  --service-account=projects/$PROJECT_ID/serviceAccounts/$DEPLOY_SA
```

### Validação 5

```bash
gcloud builds triggers list --region=$REGION --format='value(name)'
# Deve listar: desk-main-deploy (e desk-staging-deploy se criou)
```

---

## PASSO 6 — Primeiro build manual (10 min) `[BLOQUEADOR]`

Antes de plugar tráfego, validar que o pipeline inteiro funciona.

### 6.1 — Disparar build manualmente

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --region=$REGION \
  --substitutions=SHORT_SHA=manual-$(date +%s)
```

Demora ~5–8 min (build do Vite + push + deploy `--no-traffic`).

### 6.2 — Acompanhar logs

```bash
# Lista builds recentes
gcloud builds list --region=$REGION --limit=5

# Ver logs do mais recente
gcloud builds log $(gcloud builds list --region=$REGION --limit=1 --format='value(id)') --region=$REGION
```

### Validação 6

```bash
# Imagem foi pushed
gcloud artifacts docker images list \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/app \
  --include-tags --limit=3
# Deve mostrar pelo menos 1 tag

# Revisão criada no Cloud Run (sem tráfego)
gcloud run services describe $SERVICE --region=$REGION \
  --format='value(status.traffic)'
# Deve mostrar as revisões e a alocação (a primeira fica em 100% por ser a única)

# URL temporária do Cloud Run
gcloud run services describe $SERVICE --region=$REGION \
  --format='value(status.url)'
# Algo tipo https://desk-<hash>-rj.a.run.app
```

### 6.3 — Smoke direto no Cloud Run

```bash
SERVICE_URL=$(gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)')
curl -i $SERVICE_URL/health
# HTTP/2 200 + body "healthy"

curl -i $SERVICE_URL/
# HTTP/2 200 + HTML do index.html
```

Abrir `$SERVICE_URL` no browser. Login deve funcionar (puxa do Supabase real).

---

## PASSO 7 — Domain mapping (15 min)

Apontar `desk.antrop-ia.com` para o Cloud Run.

### 7.1 — Provar posse do domínio (Search Console)

1. https://search.google.com/search-console
2. **Add property → Domain → `antrop-ia.com`**
3. Copiar o TXT record `google-site-verification=...`
4. Adicionar no DNS do `antrop-ia.com` (Cloudflare / Registro.br / etc.)
5. Aguardar propagação (1–10 min) → clicar **Verify**

### 7.2 — Criar domain mapping

```bash
gcloud beta run domain-mappings create \
  --service=$SERVICE \
  --domain=$DOMAIN \
  --region=$REGION
```

Output: lista de records (CNAME ou A/AAAA dependendo de subdomínio).

### 7.3 — Adicionar records no DNS

Copiar os records que o comando acima retornou. Para subdomínio (`desk.`):
- **CNAME** `desk` → `ghs.googlehosted.com.`

(Se for o domínio apex `antrop-ia.com`, são vários A/AAAA — não recomendado, usar `www.` ou subdomínio.)

### 7.4 — Aguardar cert managed (5–30 min)

```bash
gcloud beta run domain-mappings describe \
  --domain=$DOMAIN \
  --region=$REGION \
  --format='value(status.conditions[0].type,status.conditions[0].status)'
# Esperado eventualmente: Ready True
```

### Validação 7

```bash
curl -I https://$DOMAIN/health
# HTTP/2 200, certificado válido (sem warning)
```

---

## PASSO 8 — Cloudflare na frente (15 min) — **RECOMENDADO**

Defense in depth: DDoS protection + cache + rate limit + WAF — gratuito no plano Free.

### Quando pular este passo

Se o DNS do `antrop-ia.com` já está no Cloudflare, esse passo é só ativar o proxy. Se está em outro provider (Registro.br, etc.), precisa migrar DNS para Cloudflare primeiro (ou pular este passo e ficar só com Cloud Run direto).

### 8.1 — Mover DNS para Cloudflare (se ainda não está)

1. https://dash.cloudflare.com → **Add Site** → `antrop-ia.com`
2. Cloudflare escaneia DNS atual → importar todos os records
3. Trocar nameservers no registrar para os do Cloudflare (1–24h de propagação)

### 8.2 — Ativar proxy no record do desk

1. Cloudflare → DNS → record `desk` → toggle **Proxy status: Proxied (laranja)**
2. SSL/TLS → **Mode: Full (strict)** (o cert do Cloud Run é válido para esse modo)

### 8.3 — Rate limit em `/auth/*`

1. Security → WAF → **Rate limiting rules** → **Create rule**
2. Name: `auth-bruteforce`
3. Field: `URI Path` → Operator: `starts with` → Value: `/auth/`
4. Threshold: `10 requests` per `1 minute` por IP
5. Action: `Block` por `5 minutes`
6. Save

### 8.4 — Bot Fight Mode

Security → Bots → toggle **Bot Fight Mode** ON.

### Validação 8

```bash
# Headers de Cloudflare aparecem na resposta
curl -I https://$DOMAIN/health | grep -i 'cf-\|server'
# Deve mostrar: server: cloudflare e cf-ray: ...

# Tentar 15 logins em <1 min do mesmo IP — esperado HTTP 429 no 11º+
for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://$DOMAIN/auth/v1/token; done
```

---

## PASSO 9 — Cloud Storage para backups (5 min)

```bash
# Criar bucket
gsutil mb -p $PROJECT_ID -l $REGION -c STANDARD gs://antropia-desk-backups

# Versionamento ON (defesa contra delete acidental)
gsutil versioning set on gs://antropia-desk-backups

# Lifecycle: Standard 30d → Nearline 90d → Coldline → delete 365d
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

# Permitir que a SA de deploy escreva no bucket
gsutil iam ch serviceAccount:$DEPLOY_SA:objectAdmin gs://antropia-desk-backups
```

### Validação 9

```bash
gsutil ls -L -b gs://antropia-desk-backups | grep -E 'Versioning|Lifecycle'
# Deve mostrar Versioning: Enabled e Lifecycle ativo
```

---

## PASSO 10 — Cloud Run Job de backup + Cloud Scheduler (20 min) `[BLOQUEADOR no Free]`

No plano Supabase Free, este backup é o único mecanismo de recuperação.

### 10.1 — Build da imagem de backup

```bash
gcloud builds submit \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backup:latest \
  --file Dockerfile.backup \
  --region=$REGION \
  .
```

### 10.2 — Criar Cloud Run Job

```bash
gcloud run jobs create desk-backup \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backup:latest \
  --region=$REGION \
  --set-secrets=SUPABASE_DB_URL=supabase-db-url:latest \
  --set-env-vars=GCS_BUCKET=gs://antropia-desk-backups,PREFIX=daily \
  --service-account=$DEPLOY_SA \
  --max-retries=2 \
  --task-timeout=15m
```

### 10.3 — Testar manualmente (não esperar Scheduler)

```bash
gcloud run jobs execute desk-backup --region=$REGION --wait
```

Demora 1–3 min. Validar que terminou com `Succeeded`.

### 10.4 — Confirmar arquivo no bucket

```bash
gsutil ls -l gs://antropia-desk-backups/daily/ | tail -5
# Deve mostrar arquivo desk-YYYYMMDD-HHMMSS.dump + .sha256
```

### 10.5 — Agendar via Cloud Scheduler (2x/dia no Free)

```bash
gcloud scheduler jobs create http desk-backup-daily \
  --location=$REGION \
  --schedule="0 5,17 * * *" \
  --time-zone="UTC" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/desk-backup:run" \
  --http-method=POST \
  --oauth-service-account-email=$DEPLOY_SA \
  --description="Backup Supabase 2x/dia (02h e 14h BRT) — Free plan sem PITR"
```

### Validação 10

```bash
# Scheduler ativo
gcloud scheduler jobs describe desk-backup-daily --location=$REGION \
  --format='value(state,schedule)'
# state=ENABLED, schedule=0 5,17 * * *

# Forçar execução agora pelo Scheduler (não esperar)
gcloud scheduler jobs run desk-backup-daily --location=$REGION

# 2 min depois: confirmar novo arquivo
gsutil ls -l gs://antropia-desk-backups/daily/ | tail -3
```

---

## PASSO 11 — Cloud Monitoring uptime check + alerta (10 min) `[BLOQUEADOR]`

### 11.1 — Canal de notificação por email

```bash
gcloud beta monitoring channels create \
  --display-name="Desk Alerts Email" \
  --type=email \
  --channel-labels=email_address=$ALERT_EMAIL
```

Anotar o nome retornado (algo como `projects/$PROJECT_ID/notificationChannels/<id>`).

```bash
export ALERT_CHANNEL=$(gcloud beta monitoring channels list \
  --filter="displayName='Desk Alerts Email'" \
  --format='value(name)')
echo $ALERT_CHANNEL
```

### 11.2 — Uptime check no `/health` do app

**Via console** (CLI é verboso):
1. https://console.cloud.google.com/monitoring/uptime?project=$PROJECT_ID
2. **Create uptime check**
3. Target:
   - Protocol: HTTPS
   - Hostname: `desk.antrop-ia.com`
   - Path: `/health`
4. Frequency: 1 min
5. Regions: USA + Europe + South America (3 regiões)
6. **Response Validation:** Response body contains content → `healthy`
7. Title: `desk-health`
8. **Create alerting policy**: enabled, notification channel = `Desk Alerts Email`
9. Threshold: any region failing for 2 min

### 11.3 — Uptime check no Supabase REST (keep-alive)

Mesmo procedimento, mas:
- Hostname: `wevgxuxaplcmrnsktoud.supabase.co`
- Path: `/rest/v1/`
- Custom headers: `apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>`
- Frequency: 5 min (mais que isso = abuso do Free)
- Title: `supabase-rest-keepalive`

Esse aqui serve 2 propósitos: detecta queda do BaaS + evita pausa por inatividade do Free.

### Validação 11

```bash
# Listar uptime checks
gcloud monitoring uptime list --format='value(displayName,httpCheck.path)'
# Deve listar desk-health e supabase-rest-keepalive

# Simular falha: parar Cloud Run temporariamente
gcloud run services update-traffic $SERVICE --to-revisions=NONEXISTENT --region=$REGION 2>/dev/null
# (Não fazer isso de verdade — só testar visualmente no console que o alerta dispara)
```

---

## PASSO 12 — Sentry (5 min)

Já instalado no front (`@sentry/react`), só falta o DSN real.

### 12.1 — Conta + projeto

1. https://sentry.io → Sign up (free tier 5k events/mês)
2. **Create Project**:
   - Platform: React
   - Project name: `antropia-desk-frontend`
3. Copiar o DSN: `https://<key>@<org>.ingest.sentry.io/<project>`

### 12.2 — Salvar no Secret Manager

```bash
echo -n "<sentry-dsn>" | gcloud secrets create sentry-dsn --data-file=- 2>/dev/null \
  || echo -n "<sentry-dsn>" | gcloud secrets versions add sentry-dsn --data-file=-
```

(O `cloudbuild.yaml` já lê esse secret e passa como `VITE_SENTRY_DSN` build-arg.)

### 12.3 — Disparar build novo para incluir o DSN

```bash
git commit --allow-empty -m "ci: rebuild com Sentry DSN"
git push origin main
```

Cloud Build dispara, gera nova revisão. Promover quando estiver verde.

### Validação 12

1. Abrir https://desk.antrop-ia.com no browser
2. Console do DevTools → digitar `throw new Error('Sentry test')`
3. Em <1 min, evento aparece em https://sentry.io → seu projeto

---

## PASSO 13 — Promoção canary para produção (20 min) `[BLOQUEADOR]`

A revisão atual ainda está em `--no-traffic`. Hora de servir tráfego de verdade.

### 13.1 — Listar revisões

```bash
gcloud run revisions list --service=$SERVICE --region=$REGION \
  --format='table(name,status.conditions[0].lastTransitionTime,traffic.percent)'
```

Identificar a `desk-NEW` (mais recente, com tag `sha-XXXX`) e a `desk-OLD` (se houver, com tráfego atual).

### 13.2 — Canary 10%

```bash
gcloud run services update-traffic $SERVICE \
  --to-revisions=desk-00002-abc=10,desk-00001-xyz=90 \
  --region=$REGION
# Substituir os nomes acima pelos reais do passo 13.1
```

### 13.3 — Monitorar 15–30 min

- **Sentry:** sem novos erros que não existiam antes
- **Cloud Monitoring → Cloud Run → desk:** latência p95 estável, error rate < 1%
- **Uptime check `desk-health`:** verde

### 13.4 — Canary 50% (se 10% ok)

```bash
gcloud run services update-traffic $SERVICE \
  --to-revisions=desk-NEW=50,desk-OLD=50 \
  --region=$REGION
```

Mais 15–30 min de monitoramento.

### 13.5 — 100%

```bash
gcloud run services update-traffic $SERVICE \
  --to-revisions=desk-NEW=100 \
  --region=$REGION
```

### Rollback (se quebrar em qualquer momento)

```bash
gcloud run services update-traffic $SERVICE \
  --to-revisions=desk-OLD=100 \
  --region=$REGION
# < 30 segundos para reverter
```

### Validação 13

```bash
# Tráfego 100% na nova
gcloud run services describe $SERVICE --region=$REGION \
  --format='value(status.traffic)'

# App responde via DNS público
curl -I https://$DOMAIN/health
# HTTP/2 200, cert válido

# Sem 5xx nos últimos 5 min
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="desk" AND httpRequest.status>=500' \
  --limit=10 --freshness=5m
# Esperado: zero entradas
```

---

## PASSO 14 — Validação E2E final (10 min)

Antes de chamar de "go-live":

```bash
# 1. Health endpoints
curl -s https://desk.antrop-ia.com/health
# healthy

curl -s https://desk.antrop-ia.com/status | jq
# {"status":"ok","service":"antropia-desk","version":"0.0.60"}

# 2. Smoke E2E (Playwright contra produção — uma vez, depois passa para staging)
export E2E_BASE_URL=https://desk.antrop-ia.com
export E2E_USER=<usuário teste em prod>
export E2E_PASS=<senha>
npm run e2e

# 3. Forçar um backup agora para garantir baseline
gcloud scheduler jobs run desk-backup-daily --location=$REGION
sleep 60
gsutil ls -l gs://antropia-desk-backups/daily/ | tail -1
```

UI:
1. Login → criar ticket de teste → notificação chega no email em <2 min
2. Marcar como `URGENT` → `due_date` é +2h
3. `/admin/status` mostra tudo verde

---

## Custos esperados (Free tier + uso baixo)

| Recurso | Custo/mês |
|---|---|
| Cloud Run (min-instances=1, ~720h) | ~US$ 5 (memória 256Mi, CPU 1) |
| Artifact Registry | US$ 0 (< 0.5 GB grátis) |
| Cloud Build | US$ 0 (120 min/dia grátis) |
| Secret Manager | US$ 0 (6 secrets grátis) |
| Cloud Storage (backups) | < US$ 1 (poucos GB Standard + Nearline) |
| Cloud Scheduler | US$ 0 (3 jobs grátis) |
| Cloud Monitoring | US$ 0 (50 GB logs grátis) |
| Cloud Logging | US$ 0 (idem) |
| Cloudflare | US$ 0 (Free tier) |
| Sentry SaaS | US$ 0 (5k events/mês) |
| Resend | US$ 0 (3k emails/mês) |
| **Total** | **~US$ 5–10/mês** |

Custos sobem ao adicionar:
- HTTPS Load Balancer + Cloud Armor (~US$ 18/mês) — se quiser WAF nativo em vez de Cloudflare
- Cloud Run min-instances > 1 (~US$ 5/mês por instância)
- Egress > 1 GB/mês (~US$ 0.12/GB)

---

## Pós-go-live

| Quando | O que |
|---|---|
| Dia 1 | Monitorar Sentry + uptime 24h. Acompanhar primeiro ciclo de cron jobs no Supabase |
| Semana 1 | Rodar checklist semanal de `OPERATIONS.md`. Convidar primeiros clientes piloto |
| Mês 1 | Primeiro restore drill mensal. Avaliar upgrade Supabase Pro se MAU/DB crescer |
| Trimestre 1 | Revisar custos GCP. Considerar HTTPS LB + Cloud Armor se Cloudflare ficar limitante |

---

## Checkpoint: GCP pronto

Saída esperada quando A→14 estiverem todos verdes:

| Artefato | Estado |
|---|---|
| `https://desk.antrop-ia.com` | HTTP 200, cert managed, 100% tráfego na revisão nova |
| `gcloud run revisions list` | Pelo menos 2 revisões (atual + rollback) |
| `gcloud builds list` | Builds verdes nos últimos pushes para main |
| `gsutil ls gs://antropia-desk-backups/daily/` | Pelo menos 1 backup recente |
| Cloud Monitoring | Uptime check `desk-health` verde, alerta configurado |
| Sentry | Recebendo erros em tempo real |
| Cloudflare | Tráfego do `desk.` passando pelo proxy (laranja) |

Pronto para abrir para clientes.
