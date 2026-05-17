#!/bin/bash
# ================================
# Health Check - Antropia Desk
# Verificações de saúde dos serviços
# ================================

set -euo pipefail

# Configurações
STACK_NAME="${STACK_NAME:-antropia}"
CHECK_TIMEOUT=${CHECK_TIMEOUT:-10}
RETRY_COUNT=${RETRY_COUNT:-3}
RETRY_DELAY=${RETRY_DELAY:-5}

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Função de logging
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

# Carregar variáveis de ambiente se disponível
load_env() {
    if [ -f ".env" ]; then
        set -a
        source .env
        set +a
    fi
}

# Verificar se URL responde
check_url() {
    local url="$1"
    local expected_code="${2:-200}"
    local timeout="${3:-$CHECK_TIMEOUT}"

    for i in $(seq 1 $RETRY_COUNT); do
        if response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" --max-time "$timeout" "$url" 2>/dev/null); then
            if [ "$response" = "$expected_code" ]; then
                return 0
            fi
        fi

        if [ $i -lt $RETRY_COUNT ]; then
            sleep $RETRY_DELAY
        fi
    done

    return 1
}

# Verificar endpoint JSON
check_json_endpoint() {
    local url="$1"
    local expected_key="${2:-status}"
    local expected_value="${3:-ok}"

    for i in $(seq 1 $RETRY_COUNT); do
        if response=$(curl -s --connect-timeout "$CHECK_TIMEOUT" --max-time "$CHECK_TIMEOUT" "$url" 2>/dev/null); then
            if echo "$response" | jq -e ".$expected_key" >/dev/null 2>&1; then
                local actual_value=$(echo "$response" | jq -r ".$expected_key")
                if [ "$actual_value" = "$expected_value" ]; then
                    return 0
                fi
            fi
        fi

        if [ $i -lt $RETRY_COUNT ]; then
            sleep $RETRY_DELAY
        fi
    done

    return 1
}

# Verificar serviços do Docker Swarm
check_swarm_services() {
    log "Verificando serviços do Docker Swarm..."

    if ! docker node ls >/dev/null 2>&1; then
        error "Docker Swarm não está ativo"
        return 1
    fi

    # Verificar se a stack existe
    if ! docker stack ls --format "{{.Name}}" | grep -q "^${STACK_NAME}$"; then
        error "Stack '$STACK_NAME' não encontrada"
        return 1
    fi

    success "Docker Swarm está ativo"

    local failed_services=()
    local total_services=0
    local healthy_services=0

    # Verificar cada serviço
    for service in $(docker stack services "$STACK_NAME" --format "{{.Name}}"); do
        total_services=$((total_services + 1))

        local replicas=$(docker service inspect "$service" --format "{{.Spec.Mode.Replicated.Replicas}}" 2>/dev/null || echo "1")
        local running=$(docker service ps "$service" --format "{{.CurrentState}}" | grep -c "Running" || echo "0")

        if [ "$running" -eq "$replicas" ]; then
            success "Serviço $service: $running/$replicas réplicas rodando"
            healthy_services=$((healthy_services + 1))
        else
            error "Serviço $service: $running/$replicas réplicas rodando"
            failed_services+=("$service")
        fi
    done

    log "Resumo: $healthy_services/$total_services serviços saudáveis"

    if [ ${#failed_services[@]} -eq 0 ]; then
        success "Todos os serviços estão saudáveis"
        return 0
    else
        error "Serviços com problemas: ${failed_services[*]}"
        return 1
    fi
}

# Verificar aplicação principal
check_application() {
    log "Verificando aplicação principal..."

    load_env

    local app_domain="${APP_DOMAIN:-localhost}"
    local base_url="https://$app_domain"

    # Se estiver rodando localmente, tentar HTTP primeiro
    if [ "$app_domain" = "localhost" ]; then
        base_url="http://localhost:80"

        # Verificar se há serviços rodando na porta 80
        if ! netstat -tuln 2>/dev/null | grep -q ":80 " && ! ss -tuln 2>/dev/null | grep -q ":80 "; then
            # Tentar porta 8080 para desenvolvimento
            base_url="http://localhost:8080"
        fi
    fi

    # Verificar página principal
    if check_url "$base_url"; then
        success "Aplicação principal responde: $base_url"
    else
        error "Aplicação principal não responde: $base_url"
        return 1
    fi

    # Verificar endpoint de health
    if check_url "$base_url/health"; then
        success "Endpoint de health responde: $base_url/health"
    else
        warning "Endpoint de health não responde: $base_url/health"
    fi

    # Verificar endpoint de status
    if check_json_endpoint "$base_url/status" "status" "ok"; then
        success "Endpoint de status responde: $base_url/status"
    else
        warning "Endpoint de status não responde corretamente: $base_url/status"
    fi

    return 0
}

# Verificar Traefik
check_traefik() {
    log "Verificando Traefik..."

    load_env

    local traefik_domain="traefik.${APP_DOMAIN:-localhost}"

    # Verificar se Traefik está rodando como serviço
    if docker stack services "$STACK_NAME" --format "{{.Name}}" | grep -q "traefik"; then
        success "Serviço Traefik encontrado"

        # Verificar dashboard do Traefik (se configurado)
        if [ "$traefik_domain" != "traefik.localhost" ]; then
            if check_url "https://$traefik_domain"; then
                success "Dashboard Traefik responde: https://$traefik_domain"
            else
                warning "Dashboard Traefik não responde: https://$traefik_domain"
            fi
        fi
    else
        warning "Serviço Traefik não encontrado na stack"
    fi
}

# Verificar Supabase
check_supabase() {
    log "Verificando conectividade com Supabase..."

    load_env

    if [ -n "${VITE_SUPABASE_URL:-}" ]; then
        if check_url "$VITE_SUPABASE_URL/health"; then
            success "Supabase responde: $VITE_SUPABASE_URL"
        else
            # Tentar apenas verificar se o domínio responde
            local domain=$(echo "$VITE_SUPABASE_URL" | sed 's|https\?://||' | cut -d'/' -f1)
            if ping -c 1 -W 5 "$domain" >/dev/null 2>&1; then
                success "Domínio Supabase responde: $domain"
            else
                error "Não foi possível conectar ao Supabase: $VITE_SUPABASE_URL"
                return 1
            fi
        fi
    else
        warning "VITE_SUPABASE_URL não configurado"
        return 1
    fi

    return 0
}

# Verificar recursos do sistema
check_system_resources() {
    log "Verificando recursos do sistema..."

    # Verificar memória
    local total_mem=$(free -m | awk 'NR==2{print $2}')
    local used_mem=$(free -m | awk 'NR==2{print $3}')
    local mem_usage=$((used_mem * 100 / total_mem))

    if [ $mem_usage -lt 80 ]; then
        success "Uso de memória OK: ${mem_usage}% (${used_mem}MB/${total_mem}MB)"
    elif [ $mem_usage -lt 90 ]; then
        warning "Uso de memória alto: ${mem_usage}% (${used_mem}MB/${total_mem}MB)"
    else
        error "Uso de memória crítico: ${mem_usage}% (${used_mem}MB/${total_mem}MB)"
        return 1
    fi

    # Verificar disco
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $disk_usage -lt 80 ]; then
        success "Uso de disco OK: ${disk_usage}%"
    elif [ $disk_usage -lt 90 ]; then
        warning "Uso de disco alto: ${disk_usage}%"
    else
        error "Uso de disco crítico: ${disk_usage}%"
        return 1
    fi

    # Verificar CPU load
    local cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_count=$(nproc)
    local load_per_cpu=$(echo "scale=2; $cpu_load / $cpu_count" | bc -l 2>/dev/null || echo "0")

    if (( $(echo "$load_per_cpu < 0.8" | bc -l 2>/dev/null || echo 0) )); then
        success "Load de CPU OK: $cpu_load ($load_per_cpu por core)"
    elif (( $(echo "$load_per_cpu < 1.5" | bc -l 2>/dev/null || echo 0) )); then
        warning "Load de CPU alto: $cpu_load ($load_per_cpu por core)"
    else
        error "Load de CPU crítico: $cpu_load ($load_per_cpu por core)"
        return 1
    fi

    return 0
}

# Verificar conectividade de rede
check_network() {
    log "Verificando conectividade de rede..."

    # Verificar DNS
    if nslookup google.com >/dev/null 2>&1; then
        success "DNS funcionando"
    else
        error "Problema com DNS"
        return 1
    fi

    # Verificar conectividade externa
    if check_url "https://google.com" 200 5; then
        success "Conectividade externa OK"
    else
        warning "Problema com conectividade externa"
    fi

    return 0
}

# Gerar relatório de saúde
generate_health_report() {
    local report_file="./health-report-$(date +%Y%m%d-%H%M%S).json"
    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    log "Gerando relatório de saúde..."

    # Executar checks e coletar resultados
    local swarm_status="ok"
    local app_status="ok"
    local traefik_status="ok"
    local supabase_status="ok"
    local system_status="ok"
    local network_status="ok"

    check_swarm_services >/dev/null 2>&1 || swarm_status="error"
    check_application >/dev/null 2>&1 || app_status="error"
    check_traefik >/dev/null 2>&1 || traefik_status="warning"
    check_supabase >/dev/null 2>&1 || supabase_status="error"
    check_system_resources >/dev/null 2>&1 || system_status="warning"
    check_network >/dev/null 2>&1 || network_status="error"

    # Determinar status geral
    local overall_status="ok"
    if [[ "$swarm_status" == "error" || "$app_status" == "error" || "$supabase_status" == "error" || "$network_status" == "error" ]]; then
        overall_status="error"
    elif [[ "$traefik_status" == "warning" || "$system_status" == "warning" ]]; then
        overall_status="warning"
    fi

    # Gerar JSON
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "overall_status": "$overall_status",
  "checks": {
    "swarm_services": "$swarm_status",
    "application": "$app_status",
    "traefik": "$traefik_status",
    "supabase": "$supabase_status",
    "system_resources": "$system_status",
    "network": "$network_status"
  },
  "system_info": {
    "hostname": "$(hostname)",
    "uptime": "$(uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')",
    "docker_version": "$(docker --version | cut -d' ' -f3 | sed 's/,//')",
    "kernel": "$(uname -r)"
  }
}
EOF

    success "Relatório de saúde gerado: $report_file"
    return 0
}

# Monitoramento contínuo
monitor() {
    local interval="${1:-60}"
    log "Iniciando monitoramento contínuo (intervalo: ${interval}s)"
    log "Pressione Ctrl+C para parar"

    while true; do
        echo ""
        echo "========================================"
        log "Executando verificações de saúde..."

        local failed_checks=0

        check_swarm_services || ((failed_checks++))
        echo ""
        check_application || ((failed_checks++))
        echo ""
        check_supabase || ((failed_checks++))
        echo ""
        check_system_resources || ((failed_checks++))

        if [ $failed_checks -eq 0 ]; then
            success "✨ Todas as verificações passaram!"
        else
            error "❗ $failed_checks verificação(ões) falharam"
        fi

        log "Próxima verificação em ${interval}s..."
        sleep "$interval"
    done
}

# Função de ajuda
show_help() {
    cat << EOF
🩺 Health Check - Antropia Desk

USO: $0 [COMANDO] [OPÇÕES]

COMANDOS:
    check (padrão)     Executar todas as verificações
    app               Verificar apenas aplicação
    swarm             Verificar apenas Docker Swarm
    traefik           Verificar apenas Traefik
    supabase          Verificar apenas Supabase
    system            Verificar apenas recursos do sistema
    network           Verificar apenas conectividade
    report            Gerar relatório JSON
    monitor [interval] Monitoramento contínuo

OPÇÕES:
    --timeout N       Timeout para requests (padrão: 10s)
    --retry N         Número de tentativas (padrão: 3)
    --delay N         Delay entre tentativas (padrão: 5s)

VARIÁVEIS:
    STACK_NAME        Nome da stack Docker (padrão: antropia)
    APP_DOMAIN        Domínio da aplicação
    CHECK_TIMEOUT     Timeout para checks
    RETRY_COUNT       Número de tentativas
    RETRY_DELAY       Delay entre tentativas

EXEMPLOS:
    $0                # Verificação completa
    $0 app            # Apenas aplicação
    $0 monitor 30     # Monitor a cada 30s
    $0 report         # Gerar relatório

EOF
}

# Função principal
main() {
    local command="${1:-check}"

    # Parse de opções
    while [[ $# -gt 0 ]]; do
        case $1 in
            --timeout)
                CHECK_TIMEOUT="$2"
                shift 2
                ;;
            --retry)
                RETRY_COUNT="$2"
                shift 2
                ;;
            --delay)
                RETRY_DELAY="$2"
                shift 2
                ;;
            --*)
                error "Opção desconhecida: $1"
                exit 1
                ;;
            *)
                command="$1"
                shift
                ;;
        esac
    done

    case $command in
        "check"|"")
            log "Iniciando verificações de saúde completas..."
            local failed=0

            check_swarm_services || ((failed++))
            echo ""
            check_application || ((failed++))
            echo ""
            check_traefik
            echo ""
            check_supabase || ((failed++))
            echo ""
            check_system_resources || ((failed++))
            echo ""
            check_network || ((failed++))

            echo ""
            if [ $failed -eq 0 ]; then
                success "✨ Todas as verificações críticas passaram!"
                exit 0
            else
                error "❗ $failed verificação(ões) críticas falharam"
                exit 1
            fi
            ;;
        "app")
            check_application
            ;;
        "swarm")
            check_swarm_services
            ;;
        "traefik")
            check_traefik
            ;;
        "supabase")
            check_supabase
            ;;
        "system")
            check_system_resources
            ;;
        "network")
            check_network
            ;;
        "report")
            generate_health_report
            ;;
        "monitor")
            monitor "${2:-60}"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Comando desconhecido: $command"
            show_help
            exit 1
            ;;
    esac
}

# Executar função principal
main "$@"