# Claude.md - Antropia Desk Troubleshooting Guide

## 🎯 Overview

Este documento serve como base de conhecimento para troubleshooting do **Antropia Desk** - Sistema de Help Desk e Ticketing. Todo problema encontrado, solução aplicada, e documentação de operação deve ser registrada aqui para consulta futura.

**Versão**: v2.0
**Última atualização**: 2026-05-05
**Stack**: React 19 + TypeScript + Vite + Supabase + Docker Swarm
**Ambiente**: Produção em https://desk.antrop-ia.com

> Para snapshot rápido do estado atual, ver [PANORAMA.md](PANORAMA.md). Para auditoria funcional pré-clientes, ver [RELATORIO_VALIDACAO_INTERNA.md](RELATORIO_VALIDACAO_INTERNA.md).

---

## 📋 Estado Atual & Auditoria de Portais (2026-05-05)

Após auditoria completa do portal cliente (USER) e portal agência (ADMIN/AGENT), o sistema tem o seguinte status:

### Portal Cliente (USER) — 12 áreas auditadas
| # | Feature | Status | Observação |
|---|---|---|---|
| 1 | Login/Onboarding | PARCIAL | Falta validar service plan no login |
| 2 | Dashboard | OK | KPIs e tickets recentes |
| 3 | Criar ticket | OK | Categorias filtradas por service plan |
| 4 | Listar meus tickets | OK | RLS isolando por requester_id |
| 5 | Detalhe + responder | OK | Notas internas escondidas do USER |
| 6 | Notificações | PARCIAL | Backend cria, **falta UI/badge no header** |
| 7 | Profile/senha | OK | |
| 8 | Preferências de notificação | OK | Quiet hours, per-event toggles |
| 9 | CSAT survey | OK | Aparece no fechamento do ticket |
| 10 | Knowledge Base | **CORRIGIDO** | RLS de KB ajustada em 20260505120000 |
| 11 | Empty states | OK | Todos cobertos |
| 12 | Mobile responsive | OK | Tailwind sm/md/lg breakpoints |

### Portal Agência (ADMIN/AGENT) — 15 áreas auditadas
| # | Feature | Status | Observação |
|---|---|---|---|
| 1 | Dashboard analytics | OK | 5 charts + customizer |
| 2 | Gestão de tickets | OK | Falta bulk assign |
| 3 | Detalhe + assign + status | OK | Falta editar prioridade |
| 4 | Gestão de usuários | OK | Falta UI de mudar role pós-criação |
| 5 | Settings (categorias, branding, templates, integrações) | OK | |
| 6 | Workflows | PARCIAL | Editor existe mas conditions/actions limitados |
| 7 | Integrações (Planka, Bookstack, Krayin, Chatwoot, Typebot) | OK | Sem botão "Test Connection" |
| 8 | Status Page | OK | Sem audio alerts implementados |
| 9 | Reports | PARCIAL | UI ok, **cron backend não agendado** |
| 10 | Knowledge Base mgmt | OK | |
| 11 | Service plans + categorias | OK | 5 plans + 18 cats criados via seed 20260505110000 |
| 12 | Notification templates | OK | Falta botão "Test Send" |
| 13 | Multi-tenant isolation | OK | RLS comprehensive, sem leaks detectados |
| 14 | Audit logs | **MISSING** | Não há tabela audit_logs nem triggers |
| 15 | Reports cron | **MISSING** | pg_cron disponível mas não configurado |

---

## 🚨 Bugs Conhecidos & Status

### Resolvidos em 2026-05-05

| Bug | Migration / Fix | Status |
|---|---|---|
| `due_date` não calculado para SLA | `20260505100000_add_ticket_due_date_and_public_id.sql` | RESOLVIDO |
| `public_id` ausente em tickets | mesma migration acima (formato `AD-2026-00001`) | RESOLVIDO |
| USER vê drafts na KB | `20260505120000_fix_kb_articles_user_visibility.sql` | RESOLVIDO |
| Mock data em templateUtils, useSettingsStore | Limpeza no commit `8774556` | RESOLVIDO |
| Seed de organizações antigas no banco | DELETE via REST | RESOLVIDO |
| Disco do servidor 96% cheio | `docker system prune` (liberou 90 GB) | RESOLVIDO |
| Deploy quebrado (port 80 vs 8080) | `docker-compose.traefik.yml` ajustado | RESOLVIDO |
| Healthcheck IPv6 falhando | trocado para `127.0.0.1` | RESOLVIDO |

### Pendentes (priorizados)

#### CRÍTICO (bloqueia operação completa)
- [ ] **Cron jobs não agendados**: edge functions `process-notifications`, `check-sla`, `generate-reports` existem mas ninguém as chama. Resultado: notificações ficam empilhadas como `PENDING` para sempre.
  - **Fix**: configurar pg_cron + pg_net (ambos disponíveis). Ver seção "Configurar pg_cron" abaixo.
- [ ] **SMTP/canais não configurados**: nenhum canal de notificação ativo. Mesmo com cron, nada sai.
  - **Fix**: admin deve cadastrar credenciais em `/admin/settings → Canais` e testar.

#### ALTO (UX visível para clientes)
- [ ] **Notificações sem UI**: notificações são criadas no banco mas USER/AGENT não vê badge/lista no header.
  - **Fix**: criar componente em `src/components/layout/AppHeader.tsx` com `react-query` + `useNotificationStore`.
- [ ] **Onboarding USER sem service plan**: usuário sem plano consegue logar mas vê "Nenhum servico vinculado" sem orientação clara.
  - **Fix**: tela onboarding no `Index.tsx` quando `userCategories.length === 0`.

#### MÉDIO (compliance / produtividade)
- [ ] **Audit logs ausentes**: nenhum rastreio de quem mudou o que, quando.
  - **Fix**: criar tabela `audit_logs` + triggers em tabelas sensíveis (memberships, tickets DELETE, integrations_config).
- [ ] **Bulk assign**: agente não consegue atribuir múltiplos tickets a alguém de uma vez.
- [ ] **Editar prioridade do ticket**: read-only no UI atual.
- [ ] **Mudar role de usuário pós-criação**: hoje só na invite; precisa remover + reinvitar.
- [ ] **Test send em templates**: admin não consegue testar template antes de salvar.
- [ ] **Test connection nas integrações**: cada modal precisa de botão.

#### BAIXO (cosmético / nice-to-have)
- [ ] **Audio alerts no Status Page**: não implementado.
- [ ] **Real-time via websockets**: hoje requer refresh.
- [ ] **Send time configurável em reports**: hoje sempre meia-noite.
- [ ] **Help/tooltip de variáveis de template**: usuário tem que adivinhar `{{ticket.public_id}}` etc.

---

## ⚙️ Configurar pg_cron (CRÍTICO antes de cliente real)

Pré-requisitos: pg_cron e pg_net já habilitados (verificado em 2026-05-05).

### 1. Setar CRON_SECRET nas Edge Functions
```bash
# Gerar secret seguro
CRON_SECRET=$(openssl rand -hex 32)
echo "Salve este secret: $CRON_SECRET"

# Setar nos secrets das edge functions
supabase secrets set CRON_SECRET="$CRON_SECRET" --project-ref wevgxuxaplcmrnsktoud
```

### 2. Criar migration que agenda os jobs

```sql
-- supabase/migrations/<TIMESTAMP>_setup_cron_jobs.sql
-- Salva o CRON_SECRET em vault.secrets para o pg_net usar
-- (substitua <CRON_SECRET_AQUI> pelo valor gerado)
SELECT vault.create_secret('<CRON_SECRET_AQUI>', 'cron_secret', 'Secret used by pg_cron to call edge functions');

-- process-notifications: a cada 1 minuto
SELECT cron.schedule(
  'process-notifications-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wevgxuxaplcmrnsktoud.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $$
);

-- check-sla: a cada 30 minutos
SELECT cron.schedule(
  'check-sla-job',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wevgxuxaplcmrnsktoud.supabase.co/functions/v1/check-sla',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $$
);

-- generate-reports: a cada hora (a edge function decide se algum template deve disparar)
SELECT cron.schedule(
  'generate-reports-job',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wevgxuxaplcmrnsktoud.supabase.co/functions/v1/generate-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    )
  );
  $$
);
```

### 3. Verificar que estão agendados

```sql
SELECT jobname, schedule, active FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

---

## 🚀 Quick Start - Comandos Essenciais

```bash
# Verificação rápida de saúde
make health
./scripts/health-check.sh

# Deploy completo
make deploy
./scripts/deploy.sh

# Status dos serviços
make status
docker stack services antropia

# Logs de troubleshooting
docker service logs antropia_antropia-desk
docker stack ps antropia --no-trunc
```

---

## 🔧 Problemas Conhecidos e Soluções

### 🐳 Docker & Container Issues

#### **PROBLEMA**: Stack não inicia / Serviços ficam em "Preparing"
**Sintomas**: `docker stack services antropia` mostra serviços em estado "Preparing" por muito tempo

**Diagnóstico**:
```bash
# Verificar tasks com falha
docker stack ps antropia --no-trunc

# Verificar logs específicos do serviço
docker service logs antropia_antropia-desk --follow
```

**Soluções Aplicadas**:
1. **Secrets ausentes ou incorretos**:
   ```bash
   ./scripts/secrets.sh validate
   ./scripts/secrets.sh init  # Se necessário recriar
   ```

2. **Network não criada**:
   ```bash
   docker network create --driver=overlay --attachable traefik-public
   ```

3. **Arquivo .env mal configurado**:
   ```bash
   # Verificar variáveis obrigatórias
   grep -E "(VITE_SUPABASE_URL|APP_DOMAIN|LETSENCRYPT_EMAIL)" .env
   ```

4. **Imagem não encontrada**:
   ```bash
   # Forçar build da imagem
   make build-docker
   ./scripts/deploy.sh --build
   ```

**Status**: ✅ **RESOLVIDO** - Scripts de validação criados

---

#### **PROBLEMA**: Health checks falhando constantemente
**Sintomas**: Containers reiniciando devido a health check failures

**Diagnóstico**:
```bash
# Verificar logs de health check
docker service ps antropia_antropia-desk --format "table {{.Name}}\t{{.CurrentState}}\t{{.Error}}"

# Testar health check manualmente
curl -f http://localhost:80/health
```

**Soluções Aplicadas**:
1. **Timeout de health check muito baixo** - Aumentado para 30s
2. **Path de health check incorreto** - Configurado `/health` e `/status`
3. **Aplicação demora para iniciar** - Adicionado `start_period: 30s`

**Configuração Final**:
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

**Status**: ✅ **RESOLVIDO**

---

### 🔐 Secrets & Security Issues

#### **PROBLEMA**: Secrets não sendo carregados corretamente
**Sintomas**: Aplicação não consegue conectar ao Supabase, erro 401

**Diagnóstico**:
```bash
# Listar secrets
docker secret ls | grep antropia

# Verificar se serviço tem acesso ao secret
docker service inspect antropia_antropia-desk --format "{{.Spec.TaskTemplate.ContainerSpec.Secrets}}"

# Verificar variáveis dentro do container
docker exec $(docker ps -q -f "name=antropia") env | grep VITE_SUPABASE
```

**Soluções Aplicadas**:
1. **Secrets com nomes incorretos**:
   - Usar formato `antropia_supabase_url_v1`
   - Verificar referências no docker-compose.prod.yml

2. **Secrets não mapeados**:
   ```yaml
   secrets:
     - supabase_url
     - supabase_key
   ```

3. **Arquivo de secrets ausente**:
   ```bash
   ./scripts/secrets.sh init
   ```

**Status**: ✅ **RESOLVIDO** - Script de secrets automatiza criação

---

#### **PROBLEMA**: SSL/TLS certificados não sendo gerados
**Sintomas**: Site não acessível via HTTPS, Traefik mostra erro de certificado

**Diagnóstico**:
```bash
# Verificar logs do Traefik
docker service logs antropia_traefik --follow

# Verificar configuração de domínio
docker service inspect antropia_antropia-desk --format "{{.Spec.Labels}}"

# Testar acesso HTTP primeiro
curl -I http://seu-dominio.com
```

**Soluções Aplicadas**:
1. **APP_DOMAIN mal configurado** - Verificar .env
2. **Email Let's Encrypt inválido** - Verificar LETSENCRYPT_EMAIL
3. **Domínio não aponta para servidor** - Verificar DNS
4. **Firewall bloqueando portas 80/443**:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   ```

**Status**: ✅ **RESOLVIDO**

---

### 📡 Network & Connectivity Issues

#### **PROBLEMA**: Traefik não consegue rotear para aplicação
**Sintomas**: Erro 404 ou 502 Bad Gateway

**Diagnóstico**:
```bash
# Verificar se serviço está na rede correta
docker service inspect antropia_antropia-desk --format "{{.Spec.Networks}}"

# Verificar labels do Traefik
docker service inspect antropia_antropia-desk --format "{{.Spec.Labels}}"

# Testar conectividade interna
docker exec -it $(docker ps -q -f "name=traefik") wget -qO- http://antropia_antropia-desk:80/health
```

**Soluções Aplicadas**:
1. **Serviço não está na rede traefik-public**:
   ```yaml
   networks:
     - traefik-public
   ```

2. **Labels do Traefik incorretos** - Verificar sintaxe no docker-compose.prod.yml

3. **Porta incorreta nos labels**:
   ```yaml
   labels:
     - "traefik.http.services.antropia.loadbalancer.server.port=80"
   ```

**Status**: ✅ **RESOLVIDO**

---

### ⚡ Performance Issues

#### **PROBLEMA**: Aplicação carregando lentamente
**Sintomas**: Tempo de resposta > 3s, usuários reclamando de lentidão

**Diagnóstico**:
```bash
# Verificar recursos dos containers
docker stats --no-stream

# Verificar métricas de performance
curl -s http://localhost:80/metrics | grep response_time

# Verificar logs de performance
docker service logs antropia_antropia-desk | grep "slow"
```

**Soluções Aplicadas**:
1. **Recursos insuficientes** - Aumentar limites de CPU/memoria:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 512M
   ```

2. **Nginx sem compressão** - Habilitado gzip no nginx.conf

3. **Cache headers incorretos** - Configurado cache para assets estáticos

**Status**: ✅ **RESOLVIDO**

---

#### **PROBLEMA**: Alto uso de CPU/memória
**Sintomas**: Sistema lento, containers sendo mortos pelo OOM killer

**Diagnóstico**:
```bash
# Monitorar uso de recursos
./scripts/health-check.sh system

# Verificar processos dentro do container
docker exec $(docker ps -q -f "name=antropia") top

# Verificar métricas do sistema
free -h
df -h
iostat 1 5
```

**Soluções Aplicadas**:
1. **Memory leaks** - Atualizar para Node.js 18 Alpine
2. **Muitas réplicas** - Ajustar número de réplicas baseado em recursos
3. **Logs excessivos** - Configurar log rotation
4. **Imagens muito grandes** - Usar multi-stage builds

**Status**: ✅ **RESOLVIDO**

---

### 💾 Database & Supabase Issues

#### **PROBLEMA**: Conexão com Supabase falhando
**Sintomas**: Aplicação não carrega dados, erro de conexão

**Diagnóstico**:
```bash
# Testar conectividade com Supabase
curl -s "$VITE_SUPABASE_URL/health"

# Verificar se API key está correta
curl -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" "$VITE_SUPABASE_URL/rest/v1/"

# Verificar variáveis no container
docker exec $(docker ps -q -f "name=antropia") env | grep SUPABASE
```

**Soluções Aplicadas**:
1. **URL ou API key incorretos** - Verificar secrets
2. **Rate limiting** - Implementar retry logic
3. **CORS issues** - Verificar configuração no Supabase dashboard
4. **Network policy** - Verificar se cluster pode acessar external URLs

**Status**: ✅ **RESOLVIDO**

---

#### **PROBLEMA**: Supabase Edge Functions não executando
**Sintomas**: Workflows não disparam, notificações não são enviadas

**Diagnóstico**:
```bash
# Verificar logs das Edge Functions
# No dashboard do Supabase > Functions > Logs

# Testar function manualmente
curl -X POST "$VITE_SUPABASE_URL/functions/v1/execute-workflow" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Soluções Aplicadas**:
1. **Service Role Key incorreta** - Usar anon key para client-side
2. **Timeout das functions** - Aumentar timeout para 60s
3. **Environment variables** - Configurar no Supabase dashboard

**Status**: ✅ **RESOLVIDO**

---

### 🔄 CI/CD & Deployment Issues

#### **PROBLEMA**: Deploy falha com rollback automático
**Sintomas**: Deploy script executa rollback automaticamente

**Diagnóstico**:
```bash
# Verificar logs do deploy
cat backups/deploy-*.log

# Verificar o que causou o rollback
./scripts/deploy.sh status

# Executar verificações individuais
./scripts/security-check.sh
./scripts/health-check.sh
```

**Soluções Aplicadas**:
1. **Health checks falhando** - Ajustar timeouts
2. **Secrets não configurados** - Executar `make secrets`
3. **Network não criada** - Executar `make setup`
4. **Build falhando** - Verificar variáveis de build

**Status**: ✅ **RESOLVIDO**

---

#### **PROBLEMA**: Imagem Docker não atualiza
**Sintomas**: Deploy completa mas mudanças não aparecem

**Diagnóstico**:
```bash
# Verificar tag da imagem em uso
docker service inspect antropia_antropia-desk --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"

# Forçar pull de nova imagem
docker service update --image antropia-desk:latest --force antropia_antropia-desk
```

**Soluções Aplicadas**:
1. **Cache de imagem** - Usar `--resolve-image=always` no deploy
2. **Tag não atualizada** - Usar hash ou timestamp como tag
3. **Registry cache** - Forçar rebuild com `--build`

**Status**: ✅ **RESOLVIDO**

---

## 🛡️ Security Checkpoints

### Configurações de Segurança Obrigatórias

1. **Secrets Management**:
   ```bash
   # NUNCA commitar secrets no git
   git status | grep -E "\.env$"  # Deve estar em .gitignore

   # Usar sempre Docker Secrets em produção
   docker secret ls | grep antropia  # Deve mostrar secrets
   ```

2. **Network Security**:
   ```bash
   # Verificar se apenas portas necessárias estão expostas
   netstat -tuln | grep -E ":(80|443|22)\s"

   # Verificar firewall
   sudo ufw status
   ```

3. **Container Security**:
   ```bash
   # Verificar se containers rodam como non-root
   docker exec $(docker ps -q -f "name=antropia") whoami  # Deve ser nginx-app
   ```

**Status**: ✅ **IMPLEMENTADO**

---

## 📊 Monitoring & Alerting

### Métricas Importantes

1. **Application Health**:
   - Response time < 2s (95th percentile)
   - Error rate < 1%
   - Availability > 99.5%

2. **System Resources**:
   - CPU usage < 70%
   - Memory usage < 80%
   - Disk usage < 80%

3. **Database Performance**:
   - Query response time < 500ms
   - Connection pool utilization < 80%

### Comandos de Monitoramento

```bash
# Health check automático
./scripts/health-check.sh monitor 60

# Métricas de sistema
./scripts/health-check.sh system

# Status dos serviços
make status

# Logs em tempo real
docker service logs antropia_antropia-desk --follow
```

**Status**: ✅ **IMPLEMENTADO**

---

## 🔄 Backup & Recovery

### Backup Automático

```bash
# Backup completo
make backup

# Backup apenas de secrets
./scripts/secrets.sh backup

# Backup da configuração
docker stack config antropia > backup-stack.yml
```

### Recovery Procedures

1. **Restaurar Stack**:
   ```bash
   docker stack rm antropia
   # Aguardar limpeza
   ./scripts/deploy.sh
   ```

2. **Restaurar Secrets**:
   ```bash
   # Remover secrets atuais (se necessário)
   docker secret rm $(docker secret ls -q | grep antropia)

   # Recriar
   ./scripts/secrets.sh init
   ```

**Status**: ✅ **IMPLEMENTADO**

---

## 🚨 Incident Response Playbook

### Severidade 1 - Sistema Indisponível

1. **Diagnóstico Imediato**:
   ```bash
   ./scripts/health-check.sh
   make status
   ```

2. **Ações de Emergência**:
   ```bash
   # Rollback rápido
   make rollback

   # Restart de serviços
   docker service update --force antropia_antropia-desk
   ```

3. **Comunicação**:
   - Notificar stakeholders
   - Atualizar status page
   - Documentar incidente

### Severidade 2 - Degradação de Performance

1. **Diagnóstico**:
   ```bash
   ./scripts/health-check.sh system
   docker stats --no-stream
   ```

2. **Otimizações**:
   ```bash
   # Aumentar réplicas temporariamente
   docker service scale antropia_antropia-desk=5

   # Verificar recursos
   make health
   ```

### Pós-Incidente

1. **Root Cause Analysis**
2. **Atualizar este documento**
3. **Melhorar monitoramento**
4. **Revisar procedures**

**Status**: ✅ **IMPLEMENTADO**

---

## 🔧 Maintenance Procedures

### Atualizações de Sistema

1. **Preparação**:
   ```bash
   # Backup completo
   make backup

   # Verificar saúde antes da atualização
   ./scripts/health-check.sh
   ```

2. **Execução**:
   ```bash
   # Atualizar com build
   make deploy-build

   # Monitorar durante deploy
   ./scripts/health-check.sh monitor
   ```

3. **Validação**:
   ```bash
   # Verificar funcionalidade
   ./scripts/health-check.sh

   # Teste de carga básico
   curl -s https://seu-dominio.com/health
   ```

### Rotação de Secrets

```bash
# Backup atual
./scripts/secrets.sh backup

# Rotacionar secrets
./scripts/secrets.sh rotate

# Atualizar docker-compose.prod.yml com novas versões
# Fazer redeploy
make deploy
```

### Limpeza de Recursos

```bash
# Limpeza básica
make clean

# Remover volumes órfãos
docker volume prune -f

# Remover redes órfãs
docker network prune -f
```

**Status**: ✅ **IMPLEMENTADO**

---

## 📝 Change Log

### v1.0 - 2026-02-02
- ✅ Setup inicial Docker Swarm
- ✅ Implementação de secrets management
- ✅ Scripts de deploy automatizado
- ✅ Health checks e monitoramento
- ✅ Documentação de troubleshooting

### Próximas Melhorias
- [ ] Alerting automatizado via Slack/Discord
- [ ] Backup automatizado agendado
- [ ] Load balancing inteligente
- [ ] A/B testing framework
- [ ] Disaster recovery automation

---

## 🆘 Contatos de Emergência

### Responsáveis Técnicos
- **DevOps Lead**: Responsável por infraestrutura
- **Backend Lead**: Responsável por Supabase/APIs
- **Frontend Lead**: Responsável por aplicação React

### Recursos Externos
- **Supabase Support**: Para issues de database/backend
- **Traefik Community**: Para problemas de proxy/SSL
- **Docker Support**: Para problemas de containerização

---

## 🎯 Performance Baselines

### Response Times (95th percentile)
- **Homepage**: < 2s
- **Login**: < 1.5s
- **Dashboard**: < 3s
- **Ticket Creation**: < 2s
- **API Endpoints**: < 500ms

### Resource Utilization (Normal Operation)
- **CPU**: < 40%
- **Memory**: < 60%
- **Disk**: < 50%
- **Network I/O**: < 10MB/s

### Availability Targets
- **Uptime**: > 99.5%
- **Error Rate**: < 1%
- **MTTR**: < 30 minutes
- **MTBF**: > 720 hours (30 days)

**Última atualização**: 2026-05-05
**Próxima revisão**: 2026-06-05

---

## 📝 Change Log

### v2.0 — 2026-05-05
- ✅ Auditoria completa portal cliente (12 areas) e portal agencia (15 areas)
- ✅ Migration 20260505100000: trigger automatico de due_date + public_id sequencial
- ✅ Migration 20260505110000: seed inicial com 5 service plans + 18 categorias
- ✅ Migration 20260505120000: fix RLS de KB articles (USER nao ve drafts)
- ✅ Limpeza de mocks/seeds antigos (frontend + migrations)
- ✅ Branding Antropia (logo + favicon novos)
- ✅ Producao em desk.antrop-ia.com com SSL valido
- ✅ Banco Supabase limpo, apenas org `Antrop-IA` + admin
- ✅ Triggers de SLA validados funcionalmente
- ⚠️ Identificado: cron jobs nao agendados (instrucoes adicionadas)
- ⚠️ Identificado: audit logs ausentes (recomendacao adicionada)

### v1.0 — 2026-02-02
- ✅ Setup inicial Docker Swarm
- ✅ Implementação de secrets management
- ✅ Scripts de deploy automatizado
- ✅ Health checks e monitoramento
- ✅ Documentação de troubleshooting

---

*Este documento deve ser atualizado sempre que novos problemas forem encontrados e resolvidos.*