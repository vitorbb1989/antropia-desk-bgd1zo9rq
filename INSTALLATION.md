# 🚀 Guia de Instalação - Antropia Desk

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Instalação Rápida](#instalação-rápida)
3. [Configuração Detalhada](#configuração-detalhada)
4. [Deploy em Produção](#deploy-em-produção)
5. [Verificação e Troubleshooting](#verificação-e-troubleshooting)
6. [Manutenção](#manutenção)

---

## 🎯 Pré-requisitos

### Sistema Operacional

- **Ubuntu 20.04+ / Debian 11+ / CentOS 8+**
- **Mínimo**: 2 CPU cores, 4GB RAM, 20GB disco
- **Recomendado**: 4 CPU cores, 8GB RAM, 50GB disco SSD

### Software Necessário

```bash
# Docker Engine 20.10+
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose (incluído no Docker Desktop)
# Ou instalar separadamente:
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git
sudo apt-get update && sudo apt-get install -y git

# Node.js 18+ (para desenvolvimento local)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Utilitários adicionais
sudo apt-get install -y curl wget jq make bc
```

### Configuração de Rede

```bash
# Abrir portas no firewall
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS
sudo ufw allow 2376   # Docker Swarm (se necessário)
sudo ufw allow 2377   # Docker Swarm
sudo ufw allow 7946   # Docker Swarm
sudo ufw allow 4789   # Docker Swarm overlay networks

# Ativar firewall
sudo ufw --force enable
```

### Configuração DNS

Certifique-se de que seu domínio aponta para o servidor:

```bash
# Exemplo de configuração DNS
# A record: desk.antrop-ia.com -> IP_DO_SERVIDOR
# A record: traefik.desk.antrop-ia.com -> IP_DO_SERVIDOR

# Verificar DNS
nslookup desk.antrop-ia.com
```

---

## ⚡ Instalação Rápida

### 1. Clonar o Repositório

```bash
git clone https://github.com/empresa/antropia-desk.git
cd antropia-desk
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar configurações
nano .env
```

**Configurações obrigatórias no .env:**

```bash
# Supabase
VITE_SUPABASE_URL=https://wevgxuxaplcmrnsktoud.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=seu_supabase_key_aqui

# Domínio
APP_DOMAIN=desk.antrop-ia.com
LETSENCRYPT_EMAIL=admin@antrop-ia.com

# Ambiente
NODE_ENV=production
TZ=America/Sao_Paulo
```

### 3. Executar Setup Inicial

```bash
# Setup completo automático
make setup

# Ou manualmente:
# make init-swarm
# make create-network
# make secrets
```

### 4. Deploy da Aplicação

```bash
# Deploy completo
make deploy

# Ou com build da imagem:
make deploy-build
```

### 5. Verificar Instalação

```bash
# Verificar status
make status

# Verificar saúde dos serviços
make health

# Verificar aplicação
curl -I https://desk.antrop-ia.com
```

**🎉 Sua aplicação deve estar rodando em `https://desk.antrop-ia.com`**

---

## 🔧 Configuração Detalhada

### Docker Swarm

#### Inicialização do Cluster

```bash
# Em um nó manager (primeira máquina)
docker swarm init --advertise-addr IP_DA_MAQUINA

# Adicionar nós workers (outras máquinas)
docker swarm join --token SWMTKN-... IP_DO_MANAGER:2377

# Verificar status do cluster
docker node ls
```

#### Configuração de Labels (Opcional)

```bash
# Marcar nós para tipos específicos de workload
docker node update --label-add role=manager NODE_ID
docker node update --label-add zone=us-east-1a NODE_ID
docker node update --label-add monitoring=true NODE_ID
docker node update --label-add logging=true NODE_ID
```

### Secrets Management

#### Criação Manual de Secrets

```bash
# Supabase URL
echo "https://wevgxuxaplcmrnsktoud.supabase.co" | docker secret create antropia_supabase_url_v1 -

# Supabase Key
echo "seu_supabase_key" | docker secret create antropia_supabase_key_v1 -

# Redis Password
openssl rand -base64 32 | docker secret create antropia_redis_password_v1 -

# Grafana Password
openssl rand -base64 16 | docker secret create antropia_grafana_password_v1 -

# Verificar secrets criados
docker secret ls
```

#### Rotação de Secrets

```bash
# Backup antes da rotação
./scripts/secrets.sh backup

# Rotacionar todos os secrets
./scripts/secrets.sh rotate

# Aplicar nova configuração
make deploy
```

### Configuração de Monitoramento

#### Prometheus + Grafana

```bash
# Deploy com monitoramento
docker stack deploy -c docker-compose.prod.yml --compose-file monitoring/docker-compose.monitoring.yml antropia

# Acessar dashboards
# Prometheus: https://prometheus.desk.antrop-ia.com
# Grafana: https://grafana.desk.antrop-ia.com (admin/senha_do_secret)
```

#### Configuração de Alertas

```bash
# Editar regras de alerta
nano monitoring/alerts/antropia-rules.yml

# Aplicar configurações
docker config create prometheus-rules monitoring/alerts/antropia-rules.yml
docker service update --config-add source=prometheus-rules,target=/etc/prometheus/alerts/rules.yml antropia_prometheus
```

---

## 🏭 Deploy em Produção

### Ambiente de Produção

#### Checklist de Pré-Deploy

```bash
# 1. Verificar configurações de segurança
./scripts/security-check.sh

# 2. Validar arquivo .env
grep -E "(VITE_SUPABASE_URL|APP_DOMAIN|LETSENCRYPT_EMAIL)" .env

# 3. Testar conectividade com Supabase
curl -s "$VITE_SUPABASE_URL/health"

# 4. Verificar DNS
nslookup $APP_DOMAIN

# 5. Verificar recursos do sistema
./scripts/health-check.sh system
```

#### Deploy Automatizado

```bash
# Deploy completo com validações
./scripts/deploy.sh deploy

# Deploy forçado (pula falhas não críticas)
./scripts/deploy.sh deploy --force

# Deploy com build de imagem
./scripts/deploy.sh deploy --build
```

#### Blue-Green Deployment

```bash
# 1. Deploy da nova versão
export VERSION=v2.0.0
make deploy-build

# 2. Verificar nova versão
./scripts/health-check.sh

# 3. Trocar tráfego gradualmente (manual via Traefik)
# Ou usar script personalizado
```

### Configuração SSL/TLS

#### Let's Encrypt (Automático)

O Traefik está configurado para obter certificados automaticamente:

```yaml
# No docker-compose.prod.yml
- "--certificatesresolvers.letsencrypt.acme.email=admin@antrop-ia.com"
- "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
- "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
```

#### Certificados Customizados

```bash
# Adicionar certificados personalizados
mkdir -p ./certs
cp seu-certificado.crt ./certs/
cp sua-chave.key ./certs/

# Atualizar docker-compose.prod.yml para usar certificados locais
```

### Load Balancing

#### Configuração de Réplicas

```bash
# Escalar aplicação
docker service scale antropia_antropia-desk=5

# Escalar Traefik (apenas managers)
docker service scale antropia_traefik=2

# Verificar distribuição
docker service ps antropia_antropia-desk
```

#### Health Checks Avançados

```bash
# Configurar health checks personalizados
# Editar docker-compose.prod.yml:
healthcheck:
  test: ["CMD", "./scripts/custom-health-check.sh"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

---

## 🔍 Verificação e Troubleshooting

### Comandos de Diagnóstico

#### Status Geral

```bash
# Status da stack
make status
docker stack services antropia
docker stack ps antropia --no-trunc

# Logs dos serviços
docker service logs antropia_antropia-desk --follow
docker service logs antropia_traefik --follow
```

#### Health Checks

```bash
# Verificação automática completa
./scripts/health-check.sh

# Verificações específicas
./scripts/health-check.sh app
./scripts/health-check.sh swarm
./scripts/health-check.sh supabase
./scripts/health-check.sh system
```

#### Monitoramento Contínuo

```bash
# Monitor em tempo real
./scripts/health-check.sh monitor 30

# Monitor de recursos
watch -n 5 'docker stats --no-stream'
```

### Problemas Comuns

#### 1. Serviços não Iniciam

```bash
# Diagnóstico
docker stack ps antropia --no-trunc --format "table {{.Name}}\t{{.CurrentState}}\t{{.Error}}"

# Possíveis causas:
# - Secrets não criados
# - Network não existe
# - Imagem não encontrada
# - Recursos insuficientes

# Soluções
./scripts/secrets.sh validate
make create-network
docker system df  # Verificar espaço
```

#### 2. SSL/TLS Não Funciona

```bash
# Verificar logs do Traefik
docker service logs antropia_traefik | grep -i "certificate\|acme\|tls"

# Verificar configuração DNS
dig $APP_DOMAIN

# Testar HTTP primeiro
curl -I http://$APP_DOMAIN

# Possíveis soluções:
# - Verificar email Let's Encrypt
# - Aguardar propagação DNS
# - Verificar firewall (portas 80/443)
```

#### 3. Aplicação Lenta

```bash
# Verificar recursos
./scripts/health-check.sh system
docker stats --no-stream

# Verificar health checks
docker service inspect antropia_antropia-desk --format "{{.UpdateStatus}}"

# Possíveis soluções:
# - Aumentar recursos (CPU/RAM)
# - Escalar réplicas
# - Otimizar banco de dados
```

### Logs e Debugging

#### Estrutura de Logs

```bash
# Logs por serviço
docker service logs antropia_antropia-desk
docker service logs antropia_traefik
docker service logs antropia_redis

# Logs com timestamp
docker service logs antropia_antropia-desk --timestamps

# Seguir logs em tempo real
docker service logs antropia_antropia-desk --follow

# Filtrar logs
docker service logs antropia_antropia-desk | grep ERROR
```

#### Backup de Logs

```bash
# Criar backup de logs
mkdir -p ./backups/logs
docker service logs antropia_antropia-desk > ./backups/logs/app-$(date +%Y%m%d).log
docker service logs antropia_traefik > ./backups/logs/traefik-$(date +%Y%m%d).log
```

---

## 🔧 Manutenção

### Rotinas Diárias

```bash
#!/bin/bash
# daily-maintenance.sh

# Verificar saúde dos serviços
./scripts/health-check.sh

# Verificar espaço em disco
df -h

# Verificar logs de erro
docker service logs antropia_antropia-desk --since 24h | grep -i error

# Limpar recursos não utilizados
docker system prune -f --filter "until=24h"
```

### Rotinas Semanais

```bash
#!/bin/bash
# weekly-maintenance.sh

# Backup completo
make backup

# Atualizar imagens base
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep -E "(weeks|months) ago"

# Verificar certificados SSL
echo | openssl s_client -connect $APP_DOMAIN:443 2>/dev/null | openssl x509 -noout -dates

# Rotacionar logs se necessário
find ./backups/logs -name "*.log" -mtime +30 -delete
```

### Rotinas Mensais

```bash
#!/bin/bash
# monthly-maintenance.sh

# Rotacionar secrets
./scripts/secrets.sh backup
# ./scripts/secrets.sh rotate  # Quando necessário

# Atualizar sistema operacional
sudo apt update && sudo apt upgrade -y

# Verificar espaço de volumes
docker system df

# Análise de performance
./scripts/health-check.sh report
```

### Atualizações da Aplicação

#### Atualização Menor (Patches)

```bash
# Backup antes da atualização
make backup

# Pull da nova versão
git pull origin main

# Deploy automático
make deploy

# Verificar funcionamento
./scripts/health-check.sh
```

#### Atualização Maior

```bash
# 1. Backup completo
make backup
./scripts/secrets.sh backup

# 2. Testar em ambiente staging
# make deploy (em staging)

# 3. Janela de manutenção
# Notificar usuários

# 4. Deploy em produção
git pull origin main
make deploy-build

# 5. Verificar funcionamento
./scripts/health-check.sh

# 6. Rollback se necessário
# make rollback
```

### Backup e Restore

#### Backup Automático

```bash
# Configurar cron job
crontab -e

# Backup diário às 2h
0 2 * * * cd /path/to/antropia-desk && make backup

# Backup semanal dos secrets
0 2 * * 0 cd /path/to/antropia-desk && ./scripts/secrets.sh backup
```

#### Restore de Emergency

```bash
# 1. Parar aplicação
docker stack rm antropia

# 2. Restaurar secrets
./scripts/secrets.sh init

# 3. Restaurar configuração
# Usar backup mais recente de docker-compose

# 4. Deploy
make deploy

# 5. Verificar
./scripts/health-check.sh
```

---

## 📊 Monitoramento e Alertas

### Métricas Importantes

1. **Disponibilidade**: > 99.5%
2. **Tempo de resposta**: < 2s (95th percentile)
3. **Taxa de erro**: < 1%
4. **Uso de CPU**: < 70%
5. **Uso de memória**: < 80%
6. **Uso de disco**: < 80%

### Configuração de Alertas

#### Slack Integration

```bash
# Configurar webhook do Slack
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Testar alerta
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🚨 Teste de alerta - Antropia Desk"}' \
  $SLACK_WEBHOOK_URL
```

#### Script de Alertas

```bash
#!/bin/bash
# alert-check.sh

# Verificar se aplicação responde
if ! curl -s --fail $APP_DOMAIN/health >/dev/null; then
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"🚨 Antropia Desk não está respondendo!"}' \
      $SLACK_WEBHOOK_URL
fi

# Verificar uso de recursos
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"⚠️ Uso de disco alto: ${DISK_USAGE}%\"}" \
      $SLACK_WEBHOOK_URL
fi
```

---

## 🆘 Suporte

### Contatos

- **Documentação**: [claude.md](./claude.md)
- **Issues**: GitHub Issues
- **Logs**: `./backups/logs/`

### Comandos de Emergência

```bash
# Status rápido
make status

# Rollback de emergência
make rollback

# Restart forçado
docker service update --force antropia_antropia-desk

# Limpeza de emergência
docker system prune -f
make cleanup
```

---

**🎉 Instalação concluída! Sua aplicação Antropia Desk está pronta para uso.**

Para mais informações de troubleshooting, consulte [claude.md](./claude.md).