#!/bin/bash
# ================================
# Create Tenant Script - Antropia Desk SaaS
# Criação automatizada de novos tenants
# ================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Função de ajuda
show_help() {
    cat << EOF
🏢 Antropia Desk - Create Tenant

Uso: $0 [OPÇÕES]

Opções:
  --subdomain=VALUE       Subdomínio do tenant (obrigatório)
  --domain=VALUE          Domínio customizado (opcional)
  --admin-email=VALUE     Email do administrador (obrigatório)
  --admin-name=VALUE      Nome do administrador
  --company=VALUE         Nome da empresa/organização
  --plan=VALUE            Plano (free|pro|enterprise)
  --region=VALUE          Região (us-east|eu-west|br-south)
  --dry-run              Apenas simular, não executar
  --help                 Mostrar esta ajuda

Exemplos:
  $0 --subdomain=empresa-xyz --admin-email=admin@empresa.com --plan=pro
  $0 --domain=suporte.empresa.com --admin-email=admin@empresa.com --plan=enterprise

EOF
}

# Valores padrão
SUBDOMAIN=""
CUSTOM_DOMAIN=""
ADMIN_EMAIL=""
ADMIN_NAME=""
COMPANY_NAME=""
PLAN="free"
REGION="us-east"
DRY_RUN=false

# Parse dos argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --subdomain=*)
            SUBDOMAIN="${1#*=}"
            shift
            ;;
        --domain=*)
            CUSTOM_DOMAIN="${1#*=}"
            shift
            ;;
        --admin-email=*)
            ADMIN_EMAIL="${1#*=}"
            shift
            ;;
        --admin-name=*)
            ADMIN_NAME="${1#*=}"
            shift
            ;;
        --company=*)
            COMPANY_NAME="${1#*=}"
            shift
            ;;
        --plan=*)
            PLAN="${1#*=}"
            shift
            ;;
        --region=*)
            REGION="${1#*=}"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Opção desconhecida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validações
if [[ -z "$SUBDOMAIN" && -z "$CUSTOM_DOMAIN" ]]; then
    echo -e "${RED}❌ Erro: --subdomain ou --domain é obrigatório${NC}"
    exit 1
fi

if [[ -z "$ADMIN_EMAIL" ]]; then
    echo -e "${RED}❌ Erro: --admin-email é obrigatório${NC}"
    exit 1
fi

if [[ ! "$PLAN" =~ ^(free|pro|enterprise)$ ]]; then
    echo -e "${RED}❌ Erro: Plano deve ser free, pro ou enterprise${NC}"
    exit 1
fi

# Gerar ID único do tenant
TENANT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Determinar domínio final
if [[ -n "$CUSTOM_DOMAIN" ]]; then
    FINAL_DOMAIN="$CUSTOM_DOMAIN"
else
    FINAL_DOMAIN="${SUBDOMAIN}.antropia-desk.com"
fi

echo -e "${GREEN}🏢 Criando novo tenant Antropia Desk${NC}"
echo "=================================================="
echo "📋 Configuração:"
echo "  • Tenant ID: $TENANT_ID"
echo "  • Domínio: $FINAL_DOMAIN"
echo "  • Admin: $ADMIN_EMAIL"
echo "  • Empresa: ${COMPANY_NAME:-'Não informado'}"
echo "  • Plano: $PLAN"
echo "  • Região: $REGION"
echo "=================================================="

if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}🔍 Modo DRY RUN - apenas simulação${NC}"
    exit 0
fi

read -p "Confirmar criação do tenant? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operação cancelada"
    exit 0
fi

# Função para executar comandos
execute() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
    if ! eval "$2"; then
        echo -e "${RED}❌ Falha: $1${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Concluído: $1${NC}"
}

# 1. Criar entrada no banco de dados
execute "Criando tenant no banco de dados" \
"psql \$DATABASE_URL -c \"
INSERT INTO tenants (id, subdomain, custom_domain, plan, region, settings, created_at)
VALUES (
  '$TENANT_ID',
  '$SUBDOMAIN',
  $([ -n "$CUSTOM_DOMAIN" ] && echo "'$CUSTOM_DOMAIN'" || echo "NULL"),
  '$PLAN',
  '$REGION',
  '{\"company_name\": \"$COMPANY_NAME\"}',
  NOW()
);\""

# 2. Criar usuário administrador
ADMIN_USER_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
execute "Criando usuário administrador" \
"psql \$DATABASE_URL -c \"
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '$ADMIN_USER_ID',
  '$ADMIN_EMAIL',
  crypt('temp-password-123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO tenant_users (tenant_id, user_id, role, created_at)
VALUES ('$TENANT_ID', '$ADMIN_USER_ID', 'admin', NOW());\""

# 3. Configurar DNS (se subdomínio)
if [[ -n "$SUBDOMAIN" && -z "$CUSTOM_DOMAIN" ]]; then
    execute "Configurando DNS para subdomínio" \
    "curl -X POST \"https://api.cloudflare.com/client/v4/zones/\$CLOUDFLARE_ZONE/dns_records\" \
     -H \"Authorization: Bearer \$CLOUDFLARE_TOKEN\" \
     -H \"Content-Type: application/json\" \
     --data '{
       \"type\": \"CNAME\",
       \"name\": \"$SUBDOMAIN\",
       \"content\": \"main.antropia-desk.com\"
     }'"
fi

# 4. Gerar configuração do container
TENANT_CONFIG=$(cat << EOF
version: '3.8'
services:
  tenant-$TENANT_ID:
    image: antropia-desk:latest
    environment:
      - TENANT_ID=$TENANT_ID
      - TENANT_DOMAIN=$FINAL_DOMAIN
      - NODE_ENV=production
    networks:
      - traefik-public
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.tenant-$TENANT_ID.rule=Host(\`$FINAL_DOMAIN\`)"
        - "traefik.http.routers.tenant-$TENANT_ID.entrypoints=websecure"
        - "traefik.http.routers.tenant-$TENANT_ID.tls.certresolver=letsencrypt"
        - "traefik.http.services.tenant-$TENANT_ID.loadbalancer.server.port=8080"
networks:
  traefik-public:
    external: true
EOF
)

execute "Criando configuração do container" \
"echo '$TENANT_CONFIG' > /tmp/tenant-$TENANT_ID.yml"

# 5. Deploy do container
execute "Fazendo deploy do tenant" \
"docker stack deploy -c /tmp/tenant-$TENANT_ID.yml tenant-$TENANT_ID"

# 6. Configurar backup
execute "Configurando backup do tenant" \
"echo '$TENANT_ID' >> /etc/cron.d/tenant-backups"

# 7. Enviar email de boas-vindas
execute "Enviando email de boas-vindas" \
"curl -X POST \"https://api.mailgun.net/v3/\$MAILGUN_DOMAIN/messages\" \
     -u \"api:\$MAILGUN_API_KEY\" \
     -F from=\"Antropia Desk <noreply@antropia-desk.com>\" \
     -F to=\"$ADMIN_EMAIL\" \
     -F subject=\"Bem-vindo ao Antropia Desk!\" \
     -F text=\"
Olá!

Sua conta no Antropia Desk foi criada com sucesso!

🌐 URL: https://$FINAL_DOMAIN
👤 Login: $ADMIN_EMAIL
🔑 Senha temporária: temp-password-123

Por favor, faça login e altere sua senha imediatamente.

Equipe Antropia Desk
     \""

echo
echo "=================================================="
echo -e "${GREEN}🎉 TENANT CRIADO COM SUCESSO! 🎉${NC}"
echo "=================================================="
echo
echo "📋 Informações do Tenant:"
echo "  • ID: $TENANT_ID"
echo "  • URL: https://$FINAL_DOMAIN"
echo "  • Admin: $ADMIN_EMAIL"
echo "  • Senha temporária: temp-password-123"
echo
echo -e "${YELLOW}📧 Um email de boas-vindas foi enviado para $ADMIN_EMAIL${NC}"
echo
echo "🔧 Comandos de gestão:"
echo "  • Status: docker stack ps tenant-$TENANT_ID"
echo "  • Logs: docker service logs tenant-${TENANT_ID}_tenant-$TENANT_ID"
echo "  • Remover: docker stack rm tenant-$TENANT_ID"
echo
echo -e "${BLUE}💡 O tenant estará disponível em alguns minutos após a propagação DNS${NC}"