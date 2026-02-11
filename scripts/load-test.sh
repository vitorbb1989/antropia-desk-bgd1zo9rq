#!/bin/bash
# ================================
# Load Testing - Antropia Desk
# Testes de carga para validar performance
# ================================

set -euo pipefail

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Parâmetros de teste
CONCURRENT_USERS=${CONCURRENT_USERS:-10}
DURATION=${DURATION:-60}
RAMP_UP_TIME=${RAMP_UP_TIME:-10}
TARGET_URL=""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Métricas
TOTAL_REQUESTS=0
SUCCESSFUL_REQUESTS=0
FAILED_REQUESTS=0
TOTAL_RESPONSE_TIME=0

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

fail() {
    echo -e "${RED}❌${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️${NC}  $1"
}

# Carregar configurações
load_config() {
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        source "${PROJECT_ROOT}/.env"
    fi

    if [[ -n "${APP_DOMAIN:-}" ]]; then
        TARGET_URL="https://$APP_DOMAIN"
    else
        TARGET_URL="http://localhost:80"
    fi

    log "URL de teste: $TARGET_URL"
    log "Usuários concorrentes: $CONCURRENT_USERS"
    log "Duração: ${DURATION}s"
    log "Ramp up: ${RAMP_UP_TIME}s"
}

# Função para fazer uma request
make_request() {
    local url="$1"
    local user_id="$2"

    local start_time=$(date +%s.%N)
    local response_code=$(curl -s -w "%{http_code}" -o /dev/null --connect-timeout 10 --max-time 30 "$url" 2>/dev/null || echo "000")
    local end_time=$(date +%s.%N)

    local response_time=$(echo "$end_time - $start_time" | bc -l)
    local response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)

    TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))
    TOTAL_RESPONSE_TIME=$((TOTAL_RESPONSE_TIME + response_time_ms))

    if [[ "$response_code" == "200" ]]; then
        SUCCESSFUL_REQUESTS=$((SUCCESSFUL_REQUESTS + 1))
        echo "User $user_id: $response_code (${response_time_ms}ms)"
    else
        FAILED_REQUESTS=$((FAILED_REQUESTS + 1))
        echo "User $user_id: ERROR $response_code (${response_time_ms}ms)"
    fi
}

# Simular usuário
simulate_user() {
    local user_id="$1"
    local start_time="$2"
    local end_time="$3"

    log "Usuário $user_id iniciado"

    while [ $(date +%s) -lt "$end_time" ]; do
        # Request para página principal
        make_request "$TARGET_URL" "$user_id"

        # Request para health check
        make_request "$TARGET_URL/health" "$user_id"

        # Request para status
        make_request "$TARGET_URL/status" "$user_id"

        # Simular tempo de "think time"
        sleep $(echo "scale=2; 1 + $RANDOM % 3" | bc -l)
    done

    log "Usuário $user_id finalizado"
}

# Executar teste de carga básico
run_basic_load_test() {
    log "🚀 Iniciando teste de carga básico..."

    local start_time=$(date +%s)
    local end_time=$((start_time + DURATION))

    # Verificar se aplicação responde antes de iniciar
    if ! curl -s --connect-timeout 10 "$TARGET_URL" >/dev/null; then
        fail "Aplicação não responde em $TARGET_URL"
        return 1
    fi

    # Iniciar usuários gradualmente (ramp-up)
    for i in $(seq 1 "$CONCURRENT_USERS"); do
        simulate_user "$i" "$start_time" "$end_time" &

        # Esperar entre cada usuário para ramp-up
        if [ "$i" -lt "$CONCURRENT_USERS" ]; then
            sleep $(echo "scale=2; $RAMP_UP_TIME / $CONCURRENT_USERS" | bc -l)
        fi
    done

    log "Todos os usuários iniciados, aguardando conclusão..."
    wait

    success "Teste de carga concluído"
}

# Teste de stress (aumentar carga gradualmente)
run_stress_test() {
    log "💥 Iniciando teste de stress..."

    local max_users=50
    local step=5
    local step_duration=30

    for users in $(seq "$step" "$step" "$max_users"); do
        log "Testando com $users usuários concorrentes por ${step_duration}s..."

        local step_start=$(date +%s)
        local step_end=$((step_start + step_duration))

        # Resetar métricas para este step
        local step_requests=0
        local step_successful=0

        for i in $(seq 1 "$users"); do
            (
                while [ $(date +%s) -lt "$step_end" ]; do
                    local response_code=$(curl -s -w "%{http_code}" -o /dev/null --connect-timeout 5 --max-time 10 "$TARGET_URL" 2>/dev/null || echo "000")
                    step_requests=$((step_requests + 1))

                    if [[ "$response_code" == "200" ]]; then
                        step_successful=$((step_successful + 1))
                    fi

                    sleep 0.1
                done
            ) &
        done

        wait

        local success_rate=0
        if [[ $step_requests -gt 0 ]]; then
            success_rate=$(echo "scale=1; $step_successful * 100 / $step_requests" | bc)
        fi

        log "Resultado $users usuários: $step_successful/$step_requests requests (${success_rate}% sucesso)"

        # Parar se taxa de sucesso cair muito
        if [[ ${success_rate%.*} -lt 90 ]]; then
            warning "Taxa de sucesso baixa ($success_rate%), parando teste"
            break
        fi

        sleep 5  # Pausa entre steps
    done

    success "Teste de stress concluído"
}

# Teste de spike (picos de carga)
run_spike_test() {
    log "⚡ Iniciando teste de spike..."

    local normal_load=5
    local spike_load=25
    local spike_duration=10
    local normal_duration=20

    for round in {1..3}; do
        log "Round $round - Carga normal ($normal_load usuários por ${normal_duration}s)"

        # Carga normal
        local end_time=$(($(date +%s) + normal_duration))
        for i in $(seq 1 "$normal_load"); do
            (
                while [ $(date +%s) -lt "$end_time" ]; do
                    curl -s "$TARGET_URL" >/dev/null 2>&1
                    sleep 1
                done
            ) &
        done
        wait

        log "Round $round - Spike de carga ($spike_load usuários por ${spike_duration}s)"

        # Spike de carga
        end_time=$(($(date +%s) + spike_duration))
        for i in $(seq 1 "$spike_load"); do
            (
                while [ $(date +%s) -lt "$end_time" ]; do
                    curl -s "$TARGET_URL" >/dev/null 2>&1
                    sleep 0.1
                done
            ) &
        done
        wait

        log "Round $round concluído, aguardando recuperação..."
        sleep 10
    done

    success "Teste de spike concluído"
}

# Teste de performance de endpoints específicos
test_endpoint_performance() {
    local endpoint="$1"
    local requests="$2"

    log "🎯 Testando performance de $endpoint ($requests requests)..."

    local url="$TARGET_URL$endpoint"
    local total_time=0
    local successful=0
    local failed=0

    for i in $(seq 1 "$requests"); do
        local start_time=$(date +%s.%N)
        local response_code=$(curl -s -w "%{http_code}" -o /dev/null --connect-timeout 10 "$url" 2>/dev/null || echo "000")
        local end_time=$(date +%s.%N)

        local response_time=$(echo "$end_time - $start_time" | bc -l)
        local response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)

        total_time=$((total_time + response_time_ms))

        if [[ "$response_code" == "200" ]]; then
            successful=$((successful + 1))
        else
            failed=$((failed + 1))
        fi

        # Mostrar progresso a cada 10 requests
        if [[ $((i % 10)) -eq 0 ]]; then
            log "Progresso: $i/$requests requests"
        fi
    done

    local avg_time=0
    if [[ $successful -gt 0 ]]; then
        avg_time=$((total_time / successful))
    fi

    local success_rate=0
    if [[ $requests -gt 0 ]]; then
        success_rate=$(echo "scale=1; $successful * 100 / $requests" | bc)
    fi

    log "Resultados para $endpoint:"
    log "  - Requests: $requests"
    log "  - Sucessos: $successful"
    log "  - Falhas: $failed"
    log "  - Taxa de sucesso: ${success_rate}%"
    log "  - Tempo médio: ${avg_time}ms"

    return 0
}

# Gerar relatório de performance
generate_performance_report() {
    local report_file="${PROJECT_ROOT}/load-test-report-$(date +%Y%m%d-%H%M%S).json"

    log "📊 Gerando relatório de performance..."

    local avg_response_time=0
    local success_rate=0

    if [[ $TOTAL_REQUESTS -gt 0 ]]; then
        avg_response_time=$((TOTAL_RESPONSE_TIME / TOTAL_REQUESTS))
        success_rate=$(echo "scale=2; $SUCCESSFUL_REQUESTS * 100 / $TOTAL_REQUESTS" | bc)
    fi

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "test_config": {
    "target_url": "$TARGET_URL",
    "concurrent_users": $CONCURRENT_USERS,
    "duration_seconds": $DURATION,
    "ramp_up_seconds": $RAMP_UP_TIME
  },
  "results": {
    "total_requests": $TOTAL_REQUESTS,
    "successful_requests": $SUCCESSFUL_REQUESTS,
    "failed_requests": $FAILED_REQUESTS,
    "success_rate_percent": "$success_rate",
    "average_response_time_ms": $avg_response_time,
    "requests_per_second": $(echo "scale=2; $TOTAL_REQUESTS / $DURATION" | bc)
  },
  "performance_thresholds": {
    "avg_response_time_threshold_ms": 2000,
    "success_rate_threshold_percent": 95,
    "avg_response_time_ok": $([ $avg_response_time -lt 2000 ] && echo true || echo false),
    "success_rate_ok": $(echo "$success_rate > 95" | bc -l | grep -q 1 && echo true || echo false)
  }
}
EOF

    success "Relatório gerado: $report_file"

    # Mostrar resumo
    echo ""
    echo "=========================================="
    log "📈 RESUMO DO TESTE DE PERFORMANCE"
    echo "=========================================="
    echo ""
    echo -e "🎯 URL testada: ${BLUE}$TARGET_URL${NC}"
    echo -e "👥 Usuários concorrentes: ${BLUE}$CONCURRENT_USERS${NC}"
    echo -e "⏱️ Duração: ${BLUE}${DURATION}s${NC}"
    echo ""
    echo -e "📊 Total de requests: ${BLUE}$TOTAL_REQUESTS${NC}"
    echo -e "✅ Requests bem-sucedidas: ${GREEN}$SUCCESSFUL_REQUESTS${NC}"
    echo -e "❌ Requests falharam: ${RED}$FAILED_REQUESTS${NC}"
    echo -e "📈 Taxa de sucesso: ${GREEN}${success_rate}%${NC}"
    echo -e "⚡ Tempo médio de resposta: ${YELLOW}${avg_response_time}ms${NC}"
    echo -e "🚀 Requests por segundo: ${BLUE}$(echo "scale=1; $TOTAL_REQUESTS / $DURATION" | bc)${NC}"
    echo ""

    # Avaliação final
    if [[ $avg_response_time -lt 2000 ]] && echo "$success_rate > 95" | bc -l | grep -q 1; then
        echo -e "${GREEN}🎉 PERFORMANCE EXCELENTE!${NC}"
        echo -e "${GREEN}✨ Sistema passou em todos os critérios de performance.${NC}"
    elif [[ $avg_response_time -lt 3000 ]] && echo "$success_rate > 90" | bc -l | grep -q 1; then
        echo -e "${YELLOW}⚠️ PERFORMANCE ACEITÁVEL${NC}"
        echo -e "${YELLOW}🔧 Sistema funciona mas pode ser otimizado.${NC}"
    else
        echo -e "${RED}❌ PERFORMANCE INADEQUADA${NC}"
        echo -e "${RED}🚨 Sistema precisa de otimizações antes da produção.${NC}"
    fi
}

# Função de ajuda
show_help() {
    cat << EOF
⚡ Load Testing - Antropia Desk

USO: $0 [COMANDO] [OPÇÕES]

COMANDOS:
    basic              Teste de carga básico (padrão)
    stress             Teste de stress (carga crescente)
    spike              Teste de picos de carga
    endpoints          Teste de performance de endpoints específicos

OPÇÕES:
    --users N          Número de usuários concorrentes (padrão: 10)
    --duration N       Duração do teste em segundos (padrão: 60)
    --ramp-up N        Tempo de ramp-up em segundos (padrão: 10)
    --url URL          URL para testar (padrão: usa APP_DOMAIN do .env)

EXEMPLOS:
    $0                                    # Teste básico com configurações padrão
    $0 basic --users 20 --duration 120   # Teste básico com 20 usuários por 2 minutos
    $0 stress                            # Teste de stress
    $0 spike                             # Teste de picos de carga
    $0 endpoints                         # Teste de endpoints específicos

OBSERVAÇÕES:
- Certifique-se de que a aplicação está rodando
- Testes podem impactar a performance durante execução
- Use com cuidado em ambiente de produção
- Monitore recursos do sistema durante os testes

EOF
}

# Função principal
main() {
    local test_type="${1:-basic}"

    # Parse de argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --users)
                CONCURRENT_USERS="$2"
                shift 2
                ;;
            --duration)
                DURATION="$2"
                shift 2
                ;;
            --ramp-up)
                RAMP_UP_TIME="$2"
                shift 2
                ;;
            --url)
                TARGET_URL="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            basic|stress|spike|endpoints)
                test_type="$1"
                shift
                ;;
            --*)
                warning "Opção desconhecida: $1"
                shift
                ;;
            *)
                test_type="$1"
                shift
                ;;
        esac
    done

    load_config

    # Verificar dependências
    if ! command -v bc >/dev/null; then
        fail "Comando 'bc' não encontrado. Instale com: sudo apt install bc"
        exit 1
    fi

    case $test_type in
        "basic")
            run_basic_load_test
            ;;
        "stress")
            run_stress_test
            ;;
        "spike")
            run_spike_test
            ;;
        "endpoints")
            test_endpoint_performance "/" 50
            test_endpoint_performance "/health" 50
            test_endpoint_performance "/status" 50
            ;;
        *)
            warning "Tipo de teste desconhecido: $test_type"
            show_help
            exit 1
            ;;
    esac

    if [[ "$test_type" == "basic" ]]; then
        generate_performance_report
    fi

    log "✅ Teste de carga concluído!"
}

# Executar função principal
main "$@"