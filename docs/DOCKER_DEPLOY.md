# 🚀 Guia Completo de Deploy Docker - Antropia Desk

## 📋 Visão Geral

Este guia documenta o processo completo de deploy da aplicação Antropia Desk usando Docker Swarm em produção.

## 🎯 Arquitetura

```
Internet
    ↓
[Traefik Proxy] ← SSL Let's Encrypt
    ↓
[Antropia Desk Container] ← React + Nginx
    ↓
[Supabase] ← PostgreSQL + Auth + Real-time
```

## 🛠️ Pré-requisitos

### Sistema Operacional
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Mínimo: 2 CPU, 4GB RAM, 20GB disco
- Recomendado: 4 CPU, 8GB RAM, 50GB SSD

### Software
```bash
# Docker Engine 20.10+
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Inicializar Docker Swarm
docker swarm init

# Utilitários
sudo apt-get install -y curl wget jq make bc
```

## 🔧 Configuração Inicial

### 1. Clonar e Configurar
```bash
git clone <repositorio>
cd antropia-desk
cp .env.example .env
```

### 2. Editar Variáveis de Ambiente
```bash
nano .env
```

**Configurações Obrigatórias:**
```bash
# URLs Oficiais
APP_DOMAIN=desk.antrop-ia.com
STATUS_PAGE_DOMAIN=desk-status.antrop-ia.com

# Email para SSL
LETSENCRYPT_EMAIL=admin@antrop-ia.com

# Supabase (já configurado)
VITE_SUPABASE_URL=https://wevgxuxaplcmrnsktoud.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave-configurada>
```

## 🚀 Processo de Deploy

### 1. Criar Rede Traefik (se não existir)
```bash
docker network create --driver=overlay traefik-public
```

### 2. Configurar Secrets
```bash
./scripts/secrets.sh init
```

### 3. Build da Aplicação
```bash
docker build --target production -t antropia-desk:latest .
```

### 4. Deploy
```bash
# Opção 1: Deploy completo (com Traefik)
make deploy

# Opção 2: Deploy apenas da aplicação (Traefik existente)
docker stack deploy -c docker-compose.app.yml antropia-desk
```

### 5. Verificar Status
```bash
# Status dos serviços
docker stack ps antropia-desk

# Logs da aplicação
docker service logs antropia-desk_antropia-desk

# Health check
curl -H "Host: desk.antrop-ia.com" http://localhost/
```

## 📊 Monitoramento

### Comandos Úteis
```bash
# Status dos serviços
make status

# Ver logs em tempo real
docker service logs -f antropia-desk_antropia-desk

# Escalabilidade
docker service scale antropia-desk_antropia-desk=3

# Update zero-downtime
docker service update --image antropia-desk:v2 antropia-desk_antropia-desk
```

### Health Checks
- **Application:** http://localhost:8080/health
- **Traefik Dashboard:** http://traefik.desk.antrop-ia.com

## 🔒 Configuração DNS

### Registros Necessários
```
# Registros A
desk.antrop-ia.com        A    <IP_DO_SERVIDOR>
desk-status.antrop-ia.com A    <IP_DO_SERVIDOR>
traefik.desk.antrop-ia.com A    <IP_DO_SERVIDOR>
```

### Verificação
```bash
nslookup desk.antrop-ia.com
curl -I https://desk.antrop-ia.com
```

## 🔄 Operações

### Backup
```bash
# Scripts de backup incluídos
./scripts/backup.sh

# Backup manual do Supabase
# (via dashboard Supabase ou API)
```

### Rollback
```bash
# Rollback para versão anterior
make rollback

# Rollback manual
docker service update --rollback antropia-desk_antropia-desk
```

### Updates
```bash
# Pull do código atualizado
git pull

# Rebuild e deploy
make build
make deploy
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **Porta 80/443 em uso**
```bash
# Verificar o que está usando
ss -tlnp | grep -E ':80|:443'

# Parar serviços conflitantes
sudo systemctl stop apache2 nginx
```

2. **Secrets não encontrados**
```bash
# Recriar secrets
./scripts/secrets.sh init
```

3. **DNS não resolve**
```bash
# Verificar registros
dig desk.antrop-ia.com
nslookup desk.antrop-ia.com 8.8.8.8
```

4. **SSL não funciona**
```bash
# Verificar Traefik
docker service logs traefik_traefik

# Verificar certificados
docker exec <traefik-container> ls -la /letsencrypt/
```

### Logs Importantes
```bash
# Aplicação
docker service logs antropia-desk_antropia-desk

# Traefik
docker service logs traefik_traefik

# Sistema
journalctl -u docker.service
```

## 📈 Performance

### Otimizações Recomendadas
- **CPU:** 2+ cores para produção
- **RAM:** 4GB+ para múltiplas réplicas
- **Disco:** SSD para melhor performance
- **Rede:** Conexão estável para Supabase

### Escalabilidade
```bash
# Aumentar réplicas
docker service scale antropia-desk_antropia-desk=5

# Load balancing automático via Traefik
# Configurado automaticamente
```

## 🔐 Segurança

### Configurações Implementadas
- ✅ HTTPS obrigatório (Let's Encrypt)
- ✅ Security headers configurados
- ✅ Rate limiting básico
- ✅ Usuário não-root no container
- ✅ Secrets management

### Melhorias Recomendadas
- [ ] Firewall configurado (UFW)
- [ ] Fail2ban para proteção SSH
- [ ] Backup criptografado
- [ ] Monitoramento de segurança

## 🎯 Comandos Rápidos

```bash
# Deploy inicial
make deploy

# Status
make status

# Logs
make logs

# Reiniciar
make restart

# Parar tudo
make down

# Cleanup completo
make cleanup
```