#!/bin/bash
# ================================
# Guardrails Management - Antropia Desk
# Gerenciamento de guardrails de comunicação
# ================================

set -euo pipefail

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
GUARDRAILS_DIR="${PROJECT_ROOT}/guardrails"
STACK_NAME="${STACK_NAME:-antropia}"

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

# Verificar se Docker Swarm está ativo
check_swarm() {
    if ! docker node ls >/dev/null 2>&1; then
        error "Docker Swarm não está ativo!"
        exit 1
    fi
    success "Docker Swarm está ativo"
}

# Verificar se stack existe
check_stack() {
    if ! docker stack ls --format "{{.Name}}" | grep -q "^${STACK_NAME}$"; then
        error "Stack '$STACK_NAME' não encontrada!"
        error "Execute primeiro: make deploy"
        exit 1
    fi
    success "Stack '$STACK_NAME' encontrada"
}

# Aplicar configurações de rate limiting
apply_rate_limiting() {
    log "Aplicando configurações de rate limiting..."

    if [ ! -f "${GUARDRAILS_DIR}/rate-limiting.yml" ]; then
        error "Arquivo de rate limiting não encontrado!"
        return 1
    fi

    # Verificar se Traefik está rodando
    if ! docker stack services "$STACK_NAME" --format "{{.Name}}" | grep -q "traefik"; then
        warning "Traefik não encontrado na stack, pulando rate limiting"
        return 0
    fi

    # Aplicar configuração via label update
    # Nota: Em produção real, isso seria feito via arquivo de configuração ou ConfigMap

    log "Atualizando labels de rate limiting no serviço da aplicação..."

    docker service update \
        --label-add "traefik.http.middlewares.antropia-rate.ratelimit.burst=20" \
        --label-add "traefik.http.middlewares.antropia-rate.ratelimit.average=10" \
        --label-add "traefik.http.routers.antropia.middlewares=antropia-security,antropia-rate" \
        "${STACK_NAME}_antropia-desk" >/dev/null

    success "Rate limiting aplicado"
}

# Aplicar circuit breakers
apply_circuit_breakers() {
    log "Aplicando configurações de circuit breaker..."

    if [ ! -f "${GUARDRAILS_DIR}/circuit-breaker.yml" ]; then
        error "Arquivo de circuit breaker não encontrado!"
        return 1
    fi

    # Aplicar configuração de circuit breaker
    docker service update \
        --label-add "traefik.http.middlewares.antropia-cb.circuitbreaker.checkperiod=3s" \
        --label-add "traefik.http.middlewares.antropia-cb.circuitbreaker.fallbackduration=10s" \
        --label-add "traefik.http.middlewares.antropia-cb.circuitbreaker.recoveryduration=5s" \
        --label-add "traefik.http.middlewares.antropia-cb.circuitbreaker.threshold=5" \
        "${STACK_NAME}_antropia-desk" >/dev/null

    success "Circuit breaker aplicado"
}

# Aplicar timeouts
apply_timeouts() {
    log "Aplicando configurações de timeout..."

    # Atualizar timeouts de health check
    docker service update \
        --health-timeout=10s \
        --health-interval=30s \
        --health-retries=3 \
        --health-start-period=30s \
        "${STACK_NAME}_antropia-desk" >/dev/null

    success "Timeouts aplicados"
}

# Validar configurações aplicadas
validate_guardrails() {
    log "Validando guardrails aplicados..."

    local failed=0

    # Verificar labels do serviço
    local labels=$(docker service inspect "${STACK_NAME}_antropia-desk" --format "{{range .Spec.Labels}}{{println .}}{{end}}")

    if echo "$labels" | grep -q "ratelimit"; then
        success "Rate limiting configurado"
    else
        error "Rate limiting não configurado"
        failed=1
    fi

    if echo "$labels" | grep -q "circuitbreaker"; then
        success "Circuit breaker configurado"
    else
        warning "Circuit breaker não configurado"
    fi

    # Verificar health check
    local health_config=$(docker service inspect "${STACK_NAME}_antropia-desk" --format "{{.Spec.TaskTemplate.ContainerSpec.Healthcheck}}")

    if [[ "$health_config" != "<no value>" ]] && [[ -n "$health_config" ]]; then
        success "Health check configurado"
    else
        error "Health check não configurado"
        failed=1
    fi

    return $failed
}

# Testar rate limiting
test_rate_limiting() {
    log "Testando rate limiting..."

    # Carregar domínio do .env se disponível
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        source "${PROJECT_ROOT}/.env"
    fi

    local app_url="https://${APP_DOMAIN:-localhost}"
    if [[ "$app_url" == "https://localhost" ]]; then
        app_url="http://localhost:80"
    fi

    log "Testando contra: $app_url"

    # Fazer múltiplas requests para testar rate limiting
    local success_count=0
    local rate_limited_count=0

    for i in {1..15}; do
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$app_url" 2>/dev/null || echo "000")

        case $response_code in
            200|301|302)
                success_count=$((success_count + 1))
                ;;
            429)
                rate_limited_count=$((rate_limited_count + 1))
                break  # Rate limit atingido, sair do loop
                ;;
            *)
                log "Response code inesperado: $response_code"
                ;;
        esac

        sleep 0.1
    done

    if [ $rate_limited_count -gt 0 ]; then
        success "Rate limiting está funcionando ($rate_limited_count requests bloqueadas)"
    elif [ $success_count -gt 0 ]; then
        warning "Rate limiting pode não estar funcionando (todas requests passaram)"
    else
        error "Não foi possível testar rate limiting (aplicação não responde)"
        return 1
    fi
}

# Testar circuit breaker
test_circuit_breaker() {
    log "Testando circuit breaker..."

    # Verificar se há logs de circuit breaker no Traefik
    if docker service logs "${STACK_NAME}_traefik" 2>/dev/null | grep -q "circuit"; then
        success "Circuit breaker está sendo utilizado"
    else
        warning "Nenhuma atividade de circuit breaker detectada"
    fi
}

# Monitorar guardrails
monitor_guardrails() {
    local interval="${1:-30}"
    log "Iniciando monitoramento de guardrails (intervalo: ${interval}s)"
    log "Pressione Ctrl+C para parar"

    while true; do
        echo ""
        echo "========================================"
        log "Verificando status dos guardrails..."

        # Verificar status dos serviços
        local unhealthy_services=0
        for service in $(docker stack services "$STACK_NAME" --format "{{.Name}}"); do
            local replicas=$(docker service ls --format "table {{.Name}} {{.Replicas}}" | grep "$service" | awk '{print $2}')

            if [[ "$replicas" =~ ^[0-9]+/[0-9]+$ ]]; then
                local current=$(echo "$replicas" | cut -d'/' -f1)
                local desired=$(echo "$replicas" | cut -d'/' -f2)

                if [ "$current" -eq "$desired" ]; then
                    success "Serviço $service: $replicas"
                else
                    warning "Serviço $service: $replicas (degradado)"
                    unhealthy_services=$((unhealthy_services + 1))
                fi
            fi
        done

        # Verificar rate limiting em logs recentes
        local rate_limit_hits=$(docker service logs "${STACK_NAME}_traefik" --since "${interval}s" 2>/dev/null | grep -c "429" || echo 0)
        if [ "$rate_limit_hits" -gt 0 ]; then
            log "Rate limiting ativo: $rate_limit_hits hits nos últimos ${interval}s"
        fi

        # Verificar circuit breaker
        local circuit_events=$(docker service logs "${STACK_NAME}_traefik" --since "${interval}s" 2>/dev/null | grep -c "circuit" || echo 0)
        if [ "$circuit_events" -gt 0 ]; then
            warning "Circuit breaker ativo: $circuit_events eventos nos últimos ${interval}s"
        fi

        if [ $unhealthy_services -eq 0 ]; then
            success "✨ Todos os serviços estão saudáveis"
        else
            error "⚠️ $unhealthy_services serviço(s) com problemas"
        fi

        log "Próxima verificação em ${interval}s..."
        sleep "$interval"
    done
}

# Gerar relatório de guardrails
generate_report() {
    local report_file="${PROJECT_ROOT}/guardrails-report-$(date +%Y%m%d-%H%M%S).json"

    log "Gerando relatório de guardrails..."

    # Coletar informações
    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    local service_info=$(docker service inspect "${STACK_NAME}_antropia-desk" --format json)

    # Verificar configurações aplicadas
    local rate_limiting_enabled="false"
    local circuit_breaker_enabled="false"
    local health_checks_enabled="false"

    if echo "$service_info" | jq -e '.Spec.Labels | has("traefik.http.middlewares.antropia-rate.ratelimit.average")' >/dev/null 2>&1; then
        rate_limiting_enabled="true"
    fi

    if echo "$service_info" | jq -e '.Spec.Labels | has("traefik.http.middlewares.antropia-cb.circuitbreaker.threshold")' >/dev/null 2>&1; then
        circuit_breaker_enabled="true"
    fi

    if echo "$service_info" | jq -e '.Spec.TaskTemplate.ContainerSpec.Healthcheck' >/dev/null 2>&1; then
        health_checks_enabled="true"
    fi

    # Gerar JSON
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "stack_name": "$STACK_NAME",
  "guardrails": {
    "rate_limiting": {
      "enabled": $rate_limiting_enabled,
      "configuration": {
        "average": "10/s",
        "burst": 20
      }
    },
    "circuit_breaker": {
      "enabled": $circuit_breaker_enabled,
      "configuration": {
        "threshold": 5,
        "check_period": "3s",
        "fallback_duration": "10s"
      }
    },
    "health_checks": {
      "enabled": $health_checks_enabled,
      "configuration": {
        "interval": "30s",
        "timeout": "10s",
        "retries": 3
      }
    }
  },
  "services": $(docker stack services "$STACK_NAME" --format json | jq -s .)
}
EOF

    success "Relatório gerado: $report_file"
}

# Limpar configurações de guardrails
remove_guardrails() {
    log "Removendo configurações de guardrails..."

    warning "Esta operação removerá todas as configurações de guardrails!"
    read -p "Continuar? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Operação cancelada"
        return 0
    fi

    # Remover labels de rate limiting e circuit breaker
    docker service update \
        --label-rm "traefik.http.middlewares.antropia-rate.ratelimit.burst" \
        --label-rm "traefik.http.middlewares.antropia-rate.ratelimit.average" \
        --label-rm "traefik.http.middlewares.antropia-cb.circuitbreaker.checkperiod" \
        --label-rm "traefik.http.middlewares.antropia-cb.circuitbreaker.fallbackduration" \
        --label-rm "traefik.http.middlewares.antropia-cb.circuitbreaker.recoveryduration" \
        --label-rm "traefik.http.middlewares.antropia-cb.circuitbreaker.threshold" \
        "${STACK_NAME}_antropia-desk" >/dev/null

    success "Guardrails removidos"
}

# Função de ajuda
show_help() {
    cat << EOF
🛡️ Guardrails Management - Antropia Desk

USO: $0 [COMANDO] [OPÇÕES]

COMANDOS:
    apply              Aplicar todos os guardrails
    validate           Validar guardrails aplicados
    test               Testar funcionamento dos guardrails
    monitor [interval] Monitorar guardrails continuamente
    report             Gerar relatório de configurações
    remove             Remover todas as configurações

    apply-rate         Aplicar apenas rate limiting
    apply-circuit      Aplicar apenas circuit breaker
    apply-timeouts     Aplicar apenas timeouts

    test-rate          Testar apenas rate limiting
    test-circuit       Testar apenas circuit breaker

OPÇÕES:
    --stack NAME       Nome da stack (padrão: antropia)

EXEMPLOS:
    $0 apply           # Aplicar todos os guardrails
    $0 test            # Testar funcionamento
    $0 monitor 60      # Monitorar a cada 60s
    $0 report          # Gerar relatório

OBSERVAÇÕES:
- Execute em um nó manager do Docker Swarm
- Tenha certeza de que a stack está rodando
- Alguns testes requerem que a aplicação esteja acessível

EOF
}

# Função principal
main() {
    local command="${1:-help}"

    # Parse de argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --stack)
                STACK_NAME="$2"
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
        "apply")
            check_swarm
            check_stack
            apply_rate_limiting
            apply_circuit_breakers
            apply_timeouts
            validate_guardrails
            success "✨ Todos os guardrails aplicados!"
            ;;
        "validate")
            check_swarm
            check_stack
            validate_guardrails
            ;;
        "test")
            check_swarm
            check_stack
            test_rate_limiting
            test_circuit_breaker
            ;;
        "monitor")
            check_swarm
            check_stack
            monitor_guardrails "${2:-30}"
            ;;
        "report")
            check_swarm
            check_stack
            generate_report
            ;;
        "remove")
            check_swarm
            check_stack
            remove_guardrails
            ;;
        "apply-rate")
            check_swarm
            check_stack
            apply_rate_limiting
            ;;
        "apply-circuit")
            check_swarm
            check_stack
            apply_circuit_breakers
            ;;
        "apply-timeouts")
            check_swarm
            check_stack
            apply_timeouts
            ;;
        "test-rate")
            check_swarm
            check_stack
            test_rate_limiting
            ;;
        "test-circuit")
            check_swarm
            check_stack
            test_circuit_breaker
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