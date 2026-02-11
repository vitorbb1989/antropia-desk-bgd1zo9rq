# 🛠️ Guia de Operações - Antropia Desk

## 📋 Índice

1. [Comandos Essenciais](#comandos-essenciais)
2. [Monitoramento](#monitoramento)
3. [Backup e Recovery](#backup-e-recovery)
4. [Scaling e Performance](#scaling-e-performance)
5. [Segurança](#segurança)
6. [Troubleshooting](#troubleshooting)

---

## ⚡ Comandos Essenciais

### Comandos Make (Recomendado)

```bash
# Status e saúde
make status          # Status dos serviços
make health          # Verificação de saúde
make info            # Informações do sistema

# Deploy e operações
make deploy          # Deploy completo
make deploy-build    # Deploy com build
make rollback        # Rollback
make cleanup         # Limpeza completa

# Desenvolvimento
make dev             # Ambiente de desenvolvimento
make dev-stop        # Parar desenvolvimento
make build           # Build local
make test-health     # Testar endpoints

# Secrets e segurança
make secrets         # Configurar secrets
make security-check  # Verificação de segurança
make backup          # Backup completo
```

### Scripts Especializados

```bash
# Health checks
./scripts/health-check.sh              # Verificação completa
./scripts/health-check.sh monitor      # Monitoramento contínuo
./scripts/health-check.sh app          # Apenas aplicação
./scripts/health-check.sh system       # Apenas sistema

# Secrets management
./scripts/secrets.sh init              # Criar todos os secrets
./scripts/secrets.sh list              # Listar secrets
./scripts/secrets.sh backup            # Backup de secrets
./scripts/secrets.sh rotate            # Rotacionar secrets

# Deploy automatizado
./scripts/deploy.sh deploy             # Deploy completo
./scripts/deploy.sh rollback           # Rollback
./scripts/deploy.sh status             # Status detalhado
./scripts/deploy.sh cleanup            # Limpeza forçada

# Segurança
./scripts/security-check.sh            # Verificação completa
./scripts/security-check.sh report     # Relatório detalhado

# Guardrails
./scripts/guardrails.sh apply          # Aplicar guardrails
./scripts/guardrails.sh test           # Testar guardrails
./scripts/guardrails.sh monitor        # Monitorar guardrails
```

### Docker Commands (Diretos)

```bash
# Stack management
docker stack deploy -c docker-compose.prod.yml antropia
docker stack rm antropia
docker stack services antropia
docker stack ps antropia

# Service management
docker service ls
docker service logs antropia_antropia-desk --follow
docker service update --force antropia_antropia-desk
docker service scale antropia_antropia-desk=3

# Secret management
docker secret ls
docker secret create nome_secret -
docker secret rm nome_secret

# Network management
docker network ls
docker network create --driver=overlay --attachable traefik-public

# System maintenance
docker system df
docker system prune -f
docker volume prune -f
```

---

## 📊 Monitoramento

### Métricas-Chave

#### Application Health

```bash
# Verificar se aplicação responde
curl -f https://desk.antrop-ia.com/health

# Verificar endpoint de status
curl -s https://desk.antrop-ia.com/status | jq .

# Testar tempo de resposta
curl -w "@curl-format.txt" -o /dev/null -s https://desk.antrop-ia.com
```

#### System Resources

```bash
# CPU e memória
top
htop
docker stats --no-stream

# Disco
df -h
du -sh /var/lib/docker/

# Rede
nethogs
iftop

# Processos Docker
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

#### Service Health

```bash
# Status dos serviços
docker service ps antropia_antropia-desk --no-trunc

# Logs de erro
docker service logs antropia_antropia-desk --since 1h | grep -i error

# Health check status
docker service inspect antropia_antropia-desk --format "{{.UpdateStatus}}"
```

### Dashboards e Alertas

#### Prometheus Metrics

```bash
# Acessar métricas
curl -s http://localhost:9090/metrics

# Queries úteis:
# Rate de requests: rate(http_requests_total[5m])
# Tempo de resposta: histogram_quantile(0.95, http_request_duration_seconds_bucket)
# Taxa de erro: rate(http_requests_total{status=~"5.."}[5m])
```

#### Grafana Dashboards

```bash
# Acesso: https://grafana.desk.antrop-ia.com
# Login: admin / (senha do secret)

# Dashboards principais:
# - Application Overview
# - System Resources
# - Docker Swarm
# - Traefik Metrics
```

#### Log Aggregation (Loki)

```bash
# Query de logs
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={job="antropia"} |= "error"' | jq .
```

### Alerting

#### Configuração de Alertas Slack

```bash
# Webhook URL no .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Script de alerta simples
#!/bin/bash
send_alert() {
    local message="$1"
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"🚨 Antropia Desk: $message\"}" \
      "$SLACK_WEBHOOK_URL"
}

# Usar em scripts de monitoramento
if ! curl -sf https://desk.antrop-ia.com/health >/dev/null; then
    send_alert "Aplicação não está respondendo!"
fi
```

#### Monitoramento Automatizado

```bash
# Cron job para monitoramento (crontab -e)
*/5 * * * * /path/to/antropia-desk/scripts/health-check.sh >/dev/null 2>&1
0 */6 * * * /path/to/antropia-desk/scripts/alert-check.sh

# Script alert-check.sh
#!/bin/bash
cd /path/to/antropia-desk

# Verificar aplicação
if ! make test-health >/dev/null 2>&1; then
    echo "🚨 Health check failed" | logger -t antropia-desk
    # Enviar alerta
fi

# Verificar recursos
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "⚠️ Disk usage high: $DISK_USAGE%" | logger -t antropia-desk
fi
```

---

## 💾 Backup e Recovery

### Backup Automático

#### Configuração de Backup Diário

```bash
# Criar script de backup
cat > /usr/local/bin/antropia-backup.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/backups/antropia"
DATE=$(date +%Y%m%d-%H%M%S)
PROJECT_PATH="/path/to/antropia-desk"

cd "$PROJECT_PATH"

# Criar diretório de backup
mkdir -p "$BACKUP_DIR/$DATE"

# Backup da configuração
cp .env "$BACKUP_DIR/$DATE/"
cp docker-compose.prod.yml "$BACKUP_DIR/$DATE/"

# Backup dos secrets (lista apenas)
docker secret ls > "$BACKUP_DIR/$DATE/secrets.txt"

# Backup da configuração da stack
docker stack config antropia > "$BACKUP_DIR/$DATE/stack-config.yml" 2>/dev/null || true

# Backup dos logs
docker service logs antropia_antropia-desk --since 24h > "$BACKUP_DIR/$DATE/app.log" 2>/dev/null || true

# Backup de métricas (se Prometheus estiver rodando)
curl -s http://localhost:9090/api/v1/query?query=up > "$BACKUP_DIR/$DATE/metrics.json" 2>/dev/null || true

# Limpeza de backups antigos (manter 30 dias)
find "$BACKUP_DIR" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

echo "Backup concluído: $BACKUP_DIR/$DATE"
EOF

chmod +x /usr/local/bin/antropia-backup.sh

# Configurar cron
echo "0 2 * * * /usr/local/bin/antropia-backup.sh" | crontab -
```

#### Backup Manual

```bash
# Backup completo via Make
make backup

# Backup individual de componentes
./scripts/secrets.sh backup
docker stack config antropia > backup-stack-$(date +%Y%m%d).yml

# Backup de volumes (se houver)
docker run --rm -v antropia_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/data-$(date +%Y%m%d).tar.gz /data
```

### Recovery Procedures

#### Recovery Completo

```bash
# 1. Parar aplicação atual
docker stack rm antropia
sleep 30

# 2. Restaurar configuração
cp backup/.env .env
cp backup/docker-compose.prod.yml .

# 3. Recriar secrets
./scripts/secrets.sh init

# 4. Recriar rede (se necessário)
make create-network

# 5. Deploy da aplicação
make deploy

# 6. Verificar funcionamento
make health
```

#### Recovery de Secrets

```bash
# Se secrets forem comprometidos
docker secret ls | grep antropia | awk '{print $2}' | xargs -r docker secret rm

# Recriar secrets
./scripts/secrets.sh init

# Forçar atualização de serviços
docker service update --force antropia_antropia-desk
```

#### Recovery de Disaster

```bash
#!/bin/bash
# disaster-recovery.sh

set -e

echo "🚨 Iniciando recovery de disaster..."

# 1. Verificar se servidor está respondendo
ping -c 1 google.com

# 2. Instalar Docker se necessário
if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker $(whoami)
fi

# 3. Inicializar Swarm
docker swarm init --advertise-addr $(hostname -I | awk '{print $1}') || true

# 4. Restaurar aplicação
cd /path/to/antropia-desk
git pull origin main

# 5. Configurar ambiente
cp .env.backup .env

# 6. Setup completo
make setup
make deploy

echo "✅ Recovery concluído!"
```

---

## 📈 Scaling e Performance

### Horizontal Scaling

#### Escalar Aplicação

```bash
# Verificar carga atual
docker stats --no-stream

# Escalar gradualmente
docker service scale antropia_antropia-desk=3
sleep 60

# Verificar distribuição
docker service ps antropia_antropia-desk

# Escalar mais se necessário
docker service scale antropia_antropia-desk=5

# Verificar health
./scripts/health-check.sh
```

#### Auto-scaling (Simples)

```bash
# Script de auto-scaling básico
#!/bin/bash
# auto-scale.sh

CURRENT_REPLICAS=$(docker service inspect antropia_antropia-desk --format "{{.Spec.Mode.Replicated.Replicas}}")
CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" | grep antropia | head -1 | sed 's/%//')

if [ "${CPU_USAGE%.*}" -gt 70 ] && [ "$CURRENT_REPLICAS" -lt 10 ]; then
    NEW_REPLICAS=$((CURRENT_REPLICAS + 1))
    docker service scale antropia_antropia-desk=$NEW_REPLICAS
    echo "Scaled up to $NEW_REPLICAS replicas (CPU: $CPU_USAGE%)"
elif [ "${CPU_USAGE%.*}" -lt 30 ] && [ "$CURRENT_REPLICAS" -gt 2 ]; then
    NEW_REPLICAS=$((CURRENT_REPLICAS - 1))
    docker service scale antropia_antropia-desk=$NEW_REPLICAS
    echo "Scaled down to $NEW_REPLICAS replicas (CPU: $CPU_USAGE%)"
fi
```

### Vertical Scaling

#### Aumentar Recursos

```bash
# Atualizar limites de CPU/memória
docker service update \
  --limit-cpu=2 \
  --limit-memory=1G \
  --reserve-cpu=0.5 \
  --reserve-memory=512M \
  antropia_antropia-desk
```

#### Performance Tuning

```bash
# Nginx tuning (editar docker/nginx.conf)
worker_processes auto;
worker_connections 2048;
keepalive_timeout 65;
client_max_body_size 10M;

# Docker tuning
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
systemctl restart docker
```

### Load Testing

```bash
# Instalar ferramentas de teste
sudo apt install -y apache2-utils

# Teste básico
ab -n 1000 -c 10 https://desk.antrop-ia.com/

# Teste de stress
for i in {1..100}; do
  curl -s https://desk.antrop-ia.com/ >/dev/null &
done
wait
```

---

## 🔒 Segurança

### Security Hardening

#### Sistema Operacional

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Configurar firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Configurar fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

#### Docker Security

```bash
# Executar Docker rootless (avançado)
dockerd-rootless-setuptool.sh install

# Verificar configurações de segurança
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/docker-bench-security

# Scan de vulnerabilidades
docker run --rm -v /var/lib/docker:/var/lib/docker \
  aquasec/trivy image antropia-desk:latest
```

#### Application Security

```bash
# Verificar headers de segurança
curl -I https://desk.antrop-ia.com/

# Teste de SSL
testssl.sh https://desk.antrop-ia.com/

# Verificar configurações
./scripts/security-check.sh
```

### Audit e Compliance

#### Log de Auditoria

```bash
# Configurar auditd
sudo apt install -y auditd
echo "-w /var/lib/docker -p wa -k docker" >> /etc/audit/rules.d/docker.rules
sudo systemctl restart auditd

# Verificar logs de auditoria
sudo ausearch -k docker
```

#### Compliance Check

```bash
# Script de compliance
#!/bin/bash
# compliance-check.sh

echo "🔍 Verificação de compliance..."

# 1. Verificar se secrets não estão em arquivos
if grep -r "password\|secret\|key" . --exclude-dir=.git --exclude="*.md" | grep -v "example"; then
    echo "⚠️ Possíveis secrets em arquivos encontrados"
fi

# 2. Verificar permissões
find . -name "*.sh" -not -perm /u+x -exec echo "⚠️ Script sem permissão de execução: {}" \;

# 3. Verificar SSL
if curl -s -I https://desk.antrop-ia.com | grep -q "HTTP/2 200"; then
    echo "✅ SSL funcionando"
else
    echo "❌ Problema com SSL"
fi

# 4. Verificar backup
if [ -d "./backups" ] && [ "$(find ./backups -name "*$(date +%Y%m%d)*" | wc -l)" -gt 0 ]; then
    echo "✅ Backup recente encontrado"
else
    echo "⚠️ Backup recente não encontrado"
fi
```

---

## 🔧 Troubleshooting

### Guia Rápido de Problemas

#### Aplicação não Responde

```bash
# 1. Verificar status
make status

# 2. Verificar logs
docker service logs antropia_antropia-desk --tail 100

# 3. Verificar health
./scripts/health-check.sh app

# 4. Restart se necessário
docker service update --force antropia_antropia-desk

# 5. Rollback se ainda não funcionar
make rollback
```

#### SSL não Funciona

```bash
# 1. Verificar DNS
nslookup desk.antrop-ia.com

# 2. Verificar logs do Traefik
docker service logs antropia_traefik | grep -i certificate

# 3. Verificar configuração
grep -E "(APP_DOMAIN|LETSENCRYPT_EMAIL)" .env

# 4. Forçar renovação de certificado
docker service update --force antropia_traefik
```

#### Performance Ruim

```bash
# 1. Verificar recursos
./scripts/health-check.sh system

# 2. Verificar réplicas
docker service ls

# 3. Escalar se necessário
docker service scale antropia_antropia-desk=3

# 4. Verificar logs de erro
docker service logs antropia_antropia-desk | grep -i "slow\|timeout\|error"
```

### Logs e Debugging

#### Estrutura de Logs

```bash
# Logs por severidade
docker service logs antropia_antropia-desk | grep ERROR
docker service logs antropia_antropia-desk | grep WARN
docker service logs antropia_antropia-desk | grep INFO

# Logs por período
docker service logs antropia_antropia-desk --since 1h
docker service logs antropia_antropia-desk --since 2023-01-01T00:00:00Z

# Export de logs
docker service logs antropia_antropia-desk > debug-$(date +%Y%m%d).log
```

#### Debug Avançado

```bash
# Entrar no container em execução
docker exec -it $(docker ps -q -f "name=antropia_antropia-desk") sh

# Verificar processos
docker exec $(docker ps -q -f "name=antropia_antropia-desk") ps aux

# Verificar conectividade
docker exec $(docker ps -q -f "name=antropia_antropia-desk") wget -qO- http://localhost/health

# Verificar variáveis de ambiente
docker exec $(docker ps -q -f "name=antropia_antropia-desk") env | grep VITE_SUPABASE
```

### Recovery Automático

```bash
# Script de auto-recovery
#!/bin/bash
# auto-recovery.sh

MAX_FAILURES=3
FAILURE_COUNT=0

while true; do
    if ! curl -sf https://desk.antrop-ia.com/health >/dev/null 2>&1; then
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        echo "$(date): Health check failed ($FAILURE_COUNT/$MAX_FAILURES)"

        if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
            echo "$(date): Initiating auto-recovery..."

            # Restart serviços
            docker service update --force antropia_antropia-desk

            # Aguardar recovery
            sleep 60

            # Reset counter se recovery foi bem-sucedido
            if curl -sf https://desk.antrop-ia.com/health >/dev/null 2>&1; then
                echo "$(date): Auto-recovery successful"
                FAILURE_COUNT=0
            else
                echo "$(date): Auto-recovery failed, manual intervention needed"
                # Enviar alerta crítico
            fi
        fi
    else
        FAILURE_COUNT=0
    fi

    sleep 30
done
```

---

## 📞 Suporte e Escalação

### Procedimentos de Escalação

#### Severidade 1 - Sistema Indisponível

```bash
# Ações imediatas (primeiros 5 minutos)
make health
make status
docker service logs antropia_antropia-desk --tail 50

# Se não resolver, rollback imediato
make rollback

# Notificar stakeholders
# Documentar no claude.md
```

#### Severidade 2 - Performance Degradada

```bash
# Análise inicial (primeiros 15 minutos)
./scripts/health-check.sh system
docker stats --no-stream

# Tentativas de otimização
docker service scale antropia_antropia-desk=5
./scripts/guardrails.sh apply

# Monitorar por 30 minutos
./scripts/health-check.sh monitor 60
```

### Documentação de Incidents

```bash
# Template de incident report
cat > incident-$(date +%Y%m%d-%H%M).md << EOF
# Incident Report - $(date)

## Summary
- **Start Time**: $(date -u)
- **Severity**: [1-4]
- **Impact**: [description]
- **Status**: [INVESTIGATING/MITIGATED/RESOLVED]

## Timeline
- $(date -u): Initial detection
- $(date -u): [action taken]

## Root Cause Analysis
[To be completed]

## Resolution
[Actions taken]

## Prevention
[Improvements to implement]

## References
- Logs: [path/to/logs]
- Metrics: [dashboard links]
EOF
```

---

**📋 Este guia de operações deve ser consultado regularmente e atualizado conforme novos procedimentos são desenvolvidos.**

Para troubleshooting detalhado, sempre consulte [claude.md](./claude.md).