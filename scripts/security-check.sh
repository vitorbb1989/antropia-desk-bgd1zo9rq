#!/bin/bash
# ================================
# Verificação de Segurança - Antropia Desk
# Valida configurações de segurança do Docker Swarm
# ================================

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️${NC}  $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# Verificar se Docker Swarm está ativo
check_swarm_status() {
    log "Verificando status do Docker Swarm..."

    if ! docker system info | grep -q "Swarm: active"; then
        error "Docker Swarm não está ativo!"
        error "Execute: docker swarm init"
        return 1
    fi

    success "Docker Swarm está ativo"
    return 0
}

# Verificar se secrets existem
check_secrets() {
    log "Verificando secrets necessários..."

    local required_secrets=(
        "antropia_supabase_url_v1"
        "antropia_supabase_key_v1"
        "antropia_redis_password_v1"
    )

    local missing=0
    for secret in "${required_secrets[@]}"; do
        if docker secret ls --format "{{.Name}}" | grep -q "^${secret}$"; then
            success "Secret $secret encontrado"
        else
            error "Secret $secret não encontrado"
            missing=1
        fi
    done

    if [ $missing -eq 0 ]; then
        success "Todos os secrets obrigatórios estão presentes"
    else
        error "Execute: ./scripts/secrets.sh init"
    fi

    return $missing
}

# Verificar se networks existem
check_networks() {
    log "Verificando redes necessárias..."

    # Verificar se traefik-public existe
    if docker network ls --format "{{.Name}}" | grep -q "^traefik-public$"; then
        success "Network traefik-public encontrada"
    else
        warning "Network traefik-public não encontrada"
        warning "Criando network traefik-public..."
        docker network create --driver=overlay --attachable traefik-public
        success "Network traefik-public criada"
    fi
}

# Verificar variáveis de ambiente
check_environment() {
    log "Verificando variáveis de ambiente..."

    if [ ! -f ".env" ]; then
        error "Arquivo .env não encontrado!"
        error "Copie .env.example para .env e configure as variáveis"
        return 1
    fi

    source .env 2>/dev/null || true

    # Verificar variáveis obrigatórias
    local required_vars=(
        "VITE_SUPABASE_URL"
        "VITE_SUPABASE_PUBLISHABLE_KEY"
        "APP_DOMAIN"
        "LETSENCRYPT_EMAIL"
    )

    local missing=0
    for var in "${required_vars[@]}"; do
        if [ -n "${!var:-}" ]; then
            success "Variável $var configurada"
        else
            error "Variável $var não configurada em .env"
            missing=1
        fi
    done

    return $missing
}

# Verificar configuração TLS
check_tls_config() {
    log "Verificando configuração TLS..."

    source .env 2>/dev/null || true

    if [ -n "${LETSENCRYPT_EMAIL:-}" ]; then
        if [[ "${LETSENCRYPT_EMAIL}" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            success "Email Let's Encrypt válido: $LETSENCRYPT_EMAIL"
        else
            error "Email Let's Encrypt inválido: $LETSENCRYPT_EMAIL"
            return 1
        fi
    else
        error "LETSENCRYPT_EMAIL não configurado"
        return 1
    fi

    if [ -n "${APP_DOMAIN:-}" ]; then
        if [[ "${APP_DOMAIN}" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            success "Domínio da aplicação válido: $APP_DOMAIN"
        else
            warning "Domínio pode ser inválido: $APP_DOMAIN"
        fi
    fi

    return 0
}

# Verificar portas em uso
check_ports() {
    log "Verificando portas necessárias..."

    local ports=("80" "443")
    local port_issues=0

    for port in "${ports[@]}"; do
        if netstat -tuln 2>/dev/null | grep -q ":${port} " || ss -tuln 2>/dev/null | grep -q ":${port} "; then
            if docker service ls --format "{{.Name}}" | xargs -I {} docker service inspect {} 2>/dev/null | grep -q "PublishedPort.*${port}"; then
                success "Porta $port está sendo usada pelo Docker Swarm"
            else
                warning "Porta $port está em uso por outro processo"
                port_issues=1
            fi
        else
            success "Porta $port está disponível"
        fi
    done

    return $port_issues
}

# Verificar recursos do sistema
check_system_resources() {
    log "Verificando recursos do sistema..."

    # Verificar memória
    local total_mem=$(free -g | awk 'NR==2{print $2}')
    if [ "$total_mem" -ge 2 ]; then
        success "Memória suficiente: ${total_mem}GB"
    else
        warning "Pouca memória disponível: ${total_mem}GB (recomendado: 2GB+)"
    fi

    # Verificar espaço em disco
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        success "Espaço em disco OK: ${disk_usage}% usado"
    else
        warning "Pouco espaço em disco: ${disk_usage}% usado"
    fi

    # Verificar número de CPUs
    local cpu_count=$(nproc)
    if [ "$cpu_count" -ge 2 ]; then
        success "CPUs suficientes: $cpu_count cores"
    else
        warning "Poucos cores de CPU: $cpu_count (recomendado: 2+)"
    fi
}

# Verificar configuração de firewall
check_firewall() {
    log "Verificando configuração de firewall..."

    # Verificar se ufw está instalado e ativo
    if command -v ufw >/dev/null 2>&1; then
        if ufw status | grep -q "Status: active"; then
            warning "UFW está ativo - verifique se as portas 80 e 443 estão abertas"
            if ufw status | grep -q "80/tcp"; then
                success "Porta 80 está aberta no UFW"
            else
                warning "Porta 80 pode precisar ser aberta: sudo ufw allow 80"
            fi
            if ufw status | grep -q "443/tcp"; then
                success "Porta 443 está aberta no UFW"
            else
                warning "Porta 443 pode precisar ser aberta: sudo ufw allow 443"
            fi
        else
            success "UFW não está ativo"
        fi
    else
        success "UFW não está instalado"
    fi
}

# Verificar se Supabase está acessível
check_supabase_connectivity() {
    log "Verificando conectividade com Supabase..."

    source .env 2>/dev/null || true

    if [ -n "${VITE_SUPABASE_URL:-}" ]; then
        if curl -s --connect-timeout 10 "$VITE_SUPABASE_URL/health" >/dev/null; then
            success "Supabase está acessível"
            return 0
        else
            # Tentar apenas verificar se o domínio responde
            local domain=$(echo "$VITE_SUPABASE_URL" | sed 's|https\?://||' | cut -d'/' -f1)
            if ping -c 1 -W 5 "$domain" >/dev/null 2>&1; then
                success "Domínio Supabase responde"
            else
                error "Não foi possível conectar ao Supabase: $VITE_SUPABASE_URL"
                return 1
            fi
        fi
    else
        error "VITE_SUPABASE_URL não configurada"
        return 1
    fi
}

# Verificar se há versões antigas dos containers
check_old_containers() {
    log "Verificando containers antigos..."

    local old_containers=$(docker ps -a --format "{{.Names}}" | grep -E "(antropia|helpdesk)" | grep -v "_" || true)

    if [ -n "$old_containers" ]; then
        warning "Containers antigos encontrados:"
        echo "$old_containers"
        warning "Considere remover com: docker rm -f <container_name>"
    else
        success "Nenhum container antigo encontrado"
    fi
}

# Executar todas as verificações
run_all_checks() {
    log "Iniciando verificação de segurança para Antropia Desk..."
    echo ""

    local total_errors=0

    check_swarm_status || ((total_errors++))
    echo ""

    check_environment || ((total_errors++))
    echo ""

    check_secrets || ((total_errors++))
    echo ""

    check_networks || ((total_errors++))
    echo ""

    check_tls_config || ((total_errors++))
    echo ""

    check_ports || ((total_errors++))
    echo ""

    check_system_resources
    echo ""

    check_firewall
    echo ""

    check_supabase_connectivity || ((total_errors++))
    echo ""

    check_old_containers
    echo ""

    # Resumo final
    if [ $total_errors -eq 0 ]; then
        success "✨ Todas as verificações passaram! Sistema pronto para deploy."
    else
        error "❗ $total_errors erro(s) encontrado(s). Corrija antes do deploy."
        exit 1
    fi
}

# Gerar relatório de segurança
generate_security_report() {
    local report_file="./security-report-$(date +%Y%m%d-%H%M%S).txt"

    log "Gerando relatório de segurança..."

    {
        echo "# Relatório de Segurança - Antropia Desk"
        echo "Data: $(date)"
        echo "Hostname: $(hostname)"
        echo "User: $(whoami)"
        echo ""
        echo "## Docker Swarm Status"
        docker system info | grep -A 5 "Swarm:"
        echo ""
        echo "## Secrets"
        docker secret ls
        echo ""
        echo "## Networks"
        docker network ls
        echo ""
        echo "## System Resources"
        echo "Memory: $(free -h | grep Mem)"
        echo "Disk: $(df -h / | tail -1)"
        echo "CPU: $(nproc) cores"
        echo ""
        echo "## Environment Variables"
        if [ -f ".env" ]; then
            echo "✅ .env file exists"
            grep -v "KEY\|PASSWORD\|SECRET" .env 2>/dev/null || echo "No env vars to show safely"
        else
            echo "❌ .env file missing"
        fi
    } > "$report_file"

    success "Relatório gerado: $report_file"
}

# Função principal
main() {
    case "${1:-check}" in
        "check"|"")
            run_all_checks
            ;;
        "report")
            generate_security_report
            ;;
        "help"|"-h"|"--help")
            cat << EOF
🔒 Security Check - Antropia Desk

USO: $0 [COMANDO]

COMANDOS:
    check (padrão)    Executar todas as verificações de segurança
    report           Gerar relatório de segurança detalhado
    help             Mostrar esta ajuda

EXEMPLOS:
    $0              # Executar verificações
    $0 check        # Executar verificações
    $0 report       # Gerar relatório

EOF
            ;;
        *)
            error "Comando desconhecido: $1"
            exit 1
            ;;
    esac
}

main "$@"