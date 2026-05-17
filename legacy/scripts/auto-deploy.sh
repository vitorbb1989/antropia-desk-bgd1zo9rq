#!/bin/bash
# ================================
# Auto Deploy Script - Antropia Desk
# Deploy completamente automatizado com validações
# ================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
STACK_NAME=${STACK_NAME:-antropia}
APP_DOMAIN=${APP_DOMAIN:-desk.antrop-ia.com}
STATUS_DOMAIN=${STATUS_DOMAIN:-desk-status.antrop-ia.com}
EMAIL=${EMAIL:-admin@antrop-ia.com}

echo -e "${GREEN}🚀 Antropia Desk - Auto Deploy${NC}"
echo "================================"

# Função para log
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}❌ ERRO: $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# 1. Verificações pré-deploy
log "Verificando pré-requisitos..."

# Verificar Docker
if ! command -v docker &> /dev/null; then
    error "Docker não encontrado. Instale o Docker primeiro."
fi

# Verificar Docker Swarm
if ! docker info | grep -q "Swarm: active"; then
    log "Inicializando Docker Swarm..."
    docker swarm init
    success "Docker Swarm inicializado"
fi

# Verificar arquivos necessários
for file in "Dockerfile" "docker-compose.prod.yml" ".env.example"; do
    if [ ! -f "$file" ]; then
        error "Arquivo $file não encontrado"
    fi
done

# 2. Configuração interativa
if [ ! -f ".env" ]; then
    log "Configurando variáveis de ambiente..."

    read -p "Domínio principal (ex: desk.antrop-ia.com): " APP_DOMAIN
    read -p "Domínio status page (ex: desk-status.antrop-ia.com): " STATUS_DOMAIN
    read -p "Email para SSL (ex: admin@antrop-ia.com): " EMAIL

    cp .env.example .env
    sed -i "s|APP_DOMAIN=.*|APP_DOMAIN=${APP_DOMAIN}|" .env
    sed -i "s|STATUS_PAGE_DOMAIN=.*|STATUS_PAGE_DOMAIN=${STATUS_DOMAIN}|" .env
    sed -i "s|LETSENCRYPT_EMAIL=.*|LETSENCRYPT_EMAIL=${EMAIL}|" .env

    success "Arquivo .env configurado"
fi

# 3. Verificar DNS
log "Verificando DNS..."
for domain in "$APP_DOMAIN" "$STATUS_DOMAIN"; do
    if nslookup "$domain" &>/dev/null; then
        success "DNS OK: $domain"
    else
        warning "DNS não configurado para $domain"
        echo "Configure os registros A para apontar para este servidor"
    fi
done

# 4. Verificar portas
log "Verificando portas necessárias..."
for port in 80 443; do
    if ss -ln | grep -q ":$port "; then
        warning "Porta $port está em uso - pode causar conflitos"
    else
        success "Porta $port disponível"
    fi
done

# 5. Criar rede se não existir
if ! docker network ls | grep -q "traefik-public"; then
    log "Criando rede traefik-public..."
    docker network create --driver=overlay traefik-public
    success "Rede criada"
fi

# 6. Configurar secrets
log "Configurando secrets..."
if ./scripts/secrets.sh init; then
    success "Secrets configurados"
else
    error "Falha ao configurar secrets"
fi

# 7. Build da aplicação
log "Fazendo build da aplicação..."
if docker build --target production -t antropia-desk:latest .; then
    success "Build concluído"
else
    error "Falha no build"
fi

# 8. Deploy
log "Executando deploy..."
if docker stack deploy -c docker-compose.prod.yml "$STACK_NAME"; then
    success "Deploy executado"
else
    error "Falha no deploy"
fi

# 9. Aguardar inicialização
log "Aguardando inicialização dos serviços..."
sleep 30

# 10. Verificações pós-deploy
log "Verificando serviços..."

# Verificar se o serviço está rodando
if docker stack ps "$STACK_NAME" | grep -q "Running"; then
    success "Serviços rodando"
else
    warning "Serviços ainda inicializando ou com problemas"
    echo "Verifique com: docker stack ps $STACK_NAME"
fi

# 11. Teste de conectividade
log "Testando conectividade..."

# Teste local
if curl -s -o /dev/null -w "%{http_code}" "http://localhost/" | grep -q "200\|404\|301\|302"; then
    success "Aplicação respondendo localmente"
else
    warning "Aplicação pode não estar respondendo localmente"
fi

# Teste com domínio (se DNS configurado)
if curl -s -o /dev/null -w "%{http_code}" -H "Host: $APP_DOMAIN" "http://localhost/" | grep -q "200\|404\|301\|302"; then
    success "Roteamento Traefik funcionando"
else
    warning "Roteamento Traefik pode ter problemas"
fi

echo
echo "================================"
echo -e "${GREEN}🎯 DEPLOY CONCLUÍDO!${NC}"
echo
echo "📋 Próximos passos:"
echo "1. Configure DNS para apontar domínios para este servidor"
echo "2. Aguarde propagação DNS (até 24h)"
echo "3. Acesse: https://$APP_DOMAIN"
echo "4. Status: https://$STATUS_DOMAIN"
echo
echo "📊 Monitoramento:"
echo "- Status: docker stack ps $STACK_NAME"
echo "- Logs: docker service logs ${STACK_NAME}_antropia-desk"
echo "- Health: curl -H 'Host: $APP_DOMAIN' http://localhost/"
echo
echo -e "${YELLOW}💡 Dica: Use 'make status' para verificar o status dos serviços${NC}"