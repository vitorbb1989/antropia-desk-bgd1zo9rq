#!/bin/bash
# ================================
# Antropia Desk - One Click Setup
# Setup completo em um comando
# ================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}"
cat << "EOF"
   █████╗ ███╗   ██╗████████╗██████╗  ██████╗ ██████╗ ██╗ █████╗
  ██╔══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗██╔══██╗██║██╔══██╗
  ███████║██╔██╗ ██║   ██║   ██████╔╝██║   ██║██████╔╝██║███████║
  ██╔══██║██║╚██╗██║   ██║   ██╔══██╗██║   ██║██╔═══╝ ██║██╔══██║
  ██║  ██║██║ ╚████║   ██║   ██║  ██║╚██████╔╝██║     ██║██║  ██║
  ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝

              🚀 HELP DESK SYSTEM - ONE CLICK SETUP 🚀
EOF
echo -e "${NC}"

echo "=================================================================="
echo -e "${BLUE}Configuração automática do Antropia Desk${NC}"
echo -e "${YELLOW}Este script irá instalar e configurar tudo automaticamente${NC}"
echo "=================================================================="

# Perguntar informações básicas
read -p "🌐 Seu domínio principal (ex: suporte.suaempresa.com): " MAIN_DOMAIN
read -p "📊 Domínio da página de status (ex: status.suaempresa.com): " STATUS_DOMAIN
read -p "📧 Seu email (para certificados SSL): " SSL_EMAIL

echo -e "${GREEN}📋 Configuração:${NC}"
echo "   • Domínio principal: $MAIN_DOMAIN"
echo "   • Página de status: $STATUS_DOMAIN"
echo "   • Email SSL: $SSL_EMAIL"
echo

read -p "Continuar com a instalação? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo -e "${BLUE}🚀 Iniciando instalação...${NC}"

# 1. Atualizar sistema
echo -e "${YELLOW}📦 Atualizando sistema...${NC}"
sudo apt-get update -qq
sudo apt-get install -y curl wget git make

# 2. Instalar Docker
echo -e "${YELLOW}🐳 Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Docker instalado${NC}"
else
    echo -e "${GREEN}✅ Docker já instalado${NC}"
fi

# 3. Inicializar Docker Swarm
echo -e "${YELLOW}🔗 Configurando Docker Swarm...${NC}"
if ! docker info | grep -q "Swarm: active"; then
    docker swarm init
    echo -e "${GREEN}✅ Docker Swarm inicializado${NC}"
else
    echo -e "${GREEN}✅ Docker Swarm já ativo${NC}"
fi

# 4. Clonar repositório (assumindo que já estamos no diretório)
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}❌ Arquivos do projeto não encontrados${NC}"
    echo "Execute este script no diretório do projeto Antropia Desk"
    exit 1
fi

# 5. Configurar .env
echo -e "${YELLOW}⚙️ Configurando variáveis de ambiente...${NC}"
cp .env.example .env

# Substituir configurações
sed -i "s|APP_DOMAIN=.*|APP_DOMAIN=${MAIN_DOMAIN}|" .env
sed -i "s|STATUS_PAGE_DOMAIN=.*|STATUS_PAGE_DOMAIN=${STATUS_DOMAIN}|" .env
sed -i "s|LETSENCRYPT_EMAIL=.*|LETSENCRYPT_EMAIL=${SSL_EMAIL}|" .env
sed -i "s|APP_URL=.*|APP_URL=https://${MAIN_DOMAIN}|" .env
sed -i "s|STATUS_PAGE_URL=.*|STATUS_PAGE_URL=https://${STATUS_DOMAIN}|" .env
sed -i "s|VITE_APP_URL=.*|VITE_APP_URL=https://${MAIN_DOMAIN}|" .env

echo -e "${GREEN}✅ Configuração salva em .env${NC}"

# 6. Executar auto-deploy
echo -e "${YELLOW}🚀 Executando deploy automático...${NC}"
chmod +x scripts/auto-deploy.sh
./scripts/auto-deploy.sh

echo
echo "=================================================================="
echo -e "${GREEN}🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO! 🎉${NC}"
echo "=================================================================="
echo
echo -e "${YELLOW}📋 Próximos passos OBRIGATÓRIOS:${NC}"
echo
echo "1️⃣ ${BLUE}Configure DNS no seu provedor:${NC}"
echo "   • $MAIN_DOMAIN → $(curl -s ipinfo.io/ip)"
echo "   • $STATUS_DOMAIN → $(curl -s ipinfo.io/ip)"
echo
echo "2️⃣ ${BLUE}Aguarde propagação DNS (5-30 minutos)${NC}"
echo
echo "3️⃣ ${BLUE}Acesse sua aplicação:${NC}"
echo "   • Aplicação: https://$MAIN_DOMAIN"
echo "   • Status: https://$STATUS_DOMAIN"
echo
echo -e "${YELLOW}🔧 Comandos úteis:${NC}"
echo "   • Ver status: docker stack ps antropia"
echo "   • Ver logs: docker service logs antropia_antropia-desk"
echo "   • Reiniciar: docker service update --force antropia_antropia-desk"
echo
echo -e "${GREEN}✨ Sua plataforma de Help Desk está pronta! ✨${NC}"
echo
echo -e "${BLUE}💡 Dica: Marque este servidor no seu DNS e aguarde alguns minutos${NC}"
echo "    para que os certificados SSL sejam gerados automaticamente."