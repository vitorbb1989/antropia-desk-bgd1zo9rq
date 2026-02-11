#!/bin/bash
# ================================
# Post-Deploy Tests - Antropia Desk
# Testes abrangentes de funcionalidade pós-deploy
# ================================

set -euo pipefail

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STACK_NAME="${STACK_NAME:-antropia}"
TEST_TIMEOUT=${TEST_TIMEOUT:-30}
PARALLEL_TESTS=${PARALLEL_TESTS:-false}

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Contadores de teste
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Função de logging
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

fail() {
    echo -e "${RED}❌${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

warning() {
    echo -e "${YELLOW}⚠️${NC}  $1"
}

skip() {
    echo -e "${PURPLE}⏭️${NC}  $1"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
}

# Função para executar teste
run_test() {
    local test_name="$1"
    local test_command="$2"
    local required="${3:-true}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "Executando: $test_name"

    if eval "$test_command" >/dev/null 2>&1; then
        success "$test_name"
        return 0
    else
        if [[ "$required" == "true" ]]; then
            fail "$test_name (CRÍTICO)"
            return 1
        else
            skip "$test_name (OPCIONAL)"
            return 0
        fi
    fi
}

# Carregar variáveis de ambiente
load_environment() {
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        set -a
        source "${PROJECT_ROOT}/.env"
        set +a
        success "Variáveis de ambiente carregadas"
    else
        fail "Arquivo .env não encontrado"
        return 1
    fi
}

# Função para fazer HTTP request com retry
http_request() {
    local url="$1"
    local expected_code="${2:-200}"
    local method="${3:-GET}"
    local data="${4:-}"
    local max_attempts=3

    for attempt in $(seq 1 $max_attempts); do
        if [[ -n "$data" ]]; then
            response=$(curl -s -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" --connect-timeout "$TEST_TIMEOUT" "$url" 2>/dev/null || echo "000")
        else
            response=$(curl -s -w "%{http_code}" -X "$method" --connect-timeout "$TEST_TIMEOUT" "$url" 2>/dev/null || echo "000")
        fi

        http_code="${response: -3}"
        response_body="${response%???}"

        if [[ "$http_code" == "$expected_code" ]]; then
            echo "$response_body"
            return 0
        fi

        if [[ $attempt -lt $max_attempts ]]; then
            sleep 2
        fi
    done

    return 1
}

# Testes de infraestrutura
test_infrastructure() {
    log "🏗️ Iniciando testes de infraestrutura..."

    # Test 1: Docker Swarm ativo
    run_test "Docker Swarm ativo" "docker node ls"

    # Test 2: Stack deployada
    run_test "Stack deployada" "docker stack ls | grep -q '$STACK_NAME'"

    # Test 3: Serviços rodando
    local services_running=true
    for service in $(docker stack services "$STACK_NAME" --format "{{.Name}}"); do
        if ! run_test "Serviço $service rodando" "docker service ps '$service' --format '{{.CurrentState}}' | grep -q Running"; then
            services_running=false
        fi
    done

    # Test 4: Networks criadas
    run_test "Network traefik-public existe" "docker network ls | grep -q traefik-public"

    # Test 5: Secrets configurados
    run_test "Secrets configurados" "docker secret ls | grep -q antropia"

    # Test 6: Volumes criados (se existirem)
    if docker volume ls | grep -q antropia; then
        run_test "Volumes criados" "docker volume ls | grep -q antropia"
    else
        skip "Volumes não aplicáveis (aplicação stateless)"
    fi

    return 0
}

# Testes de conectividade
test_connectivity() {
    log "🌐 Iniciando testes de conectividade..."

    load_environment

    local app_domain="${APP_DOMAIN:-localhost}"
    local base_url="https://$app_domain"

    # Se for localhost, tentar HTTP primeiro
    if [[ "$app_domain" == "localhost" ]]; then
        if curl -s --connect-timeout 5 http://localhost:80 >/dev/null 2>&1; then
            base_url="http://localhost:80"
        elif curl -s --connect-timeout 5 http://localhost:8080 >/dev/null 2>&1; then
            base_url="http://localhost:8080"
        fi
    fi

    # Test 1: Aplicação responde
    run_test "Aplicação principal responde" "http_request '$base_url' 200"

    # Test 2: Health endpoint
    run_test "Endpoint de health" "http_request '$base_url/health' 200"

    # Test 3: Status endpoint
    run_test "Endpoint de status" "http_request '$base_url/status' 200"

    # Test 4: Assets estáticos
    if http_request "$base_url" 200 | grep -q "assets/"; then
        run_test "Assets estáticos carregam" "true" false
    else
        skip "Assets estáticos não verificáveis"
    fi

    # Test 5: Redirecionamento HTTPS (se domínio real)
    if [[ "$app_domain" != "localhost" ]]; then
        run_test "Redirecionamento HTTPS" "http_request 'http://$app_domain' 301" false
    else
        skip "Redirecionamento HTTPS (apenas localhost)"
    fi

    # Test 6: Headers de segurança
    if curl -s -I "$base_url" | grep -qi "x-frame-options\|x-content-type-options"; then
        run_test "Headers de segurança presentes" "true"
    else
        fail "Headers de segurança ausentes"
    fi

    return 0
}

# Testes de aplicação
test_application() {
    log "🎯 Iniciando testes de aplicação..."

    load_environment

    local app_domain="${APP_DOMAIN:-localhost}"
    local base_url="https://$app_domain"

    if [[ "$app_domain" == "localhost" ]]; then
        if curl -s --connect-timeout 5 http://localhost:80 >/dev/null 2>&1; then
            base_url="http://localhost:80"
        elif curl -s --connect-timeout 5 http://localhost:8080 >/dev/null 2>&1; then
            base_url="http://localhost:8080"
        fi
    fi

    # Test 1: Página principal carrega
    local main_page=$(http_request "$base_url" 200)
    if [[ -n "$main_page" ]] && echo "$main_page" | grep -q "<!DOCTYPE html>"; then
        success "Página principal carrega HTML válido"
    else
        fail "Página principal não retorna HTML válido"
    fi

    # Test 2: JavaScript/CSS resources
    if echo "$main_page" | grep -q "script\|css"; then
        success "Recursos JavaScript/CSS presentes"
    else
        warning "Recursos JavaScript/CSS não detectados"
    fi

    # Test 3: Configuração de ambiente no frontend
    if echo "$main_page" | grep -q "window.ENV\|vite\|react"; then
        success "Aplicação React detectada"
    else
        warning "Aplicação React não claramente detectada"
    fi

    # Test 4: Teste de rota SPA (se aplicável)
    if http_request "$base_url/login" 200 >/dev/null 2>&1; then
        success "SPA routing funciona (/login)"
    else
        # Pode ser que /login redirecione ou não exista
        skip "SPA routing /login (pode não existir)"
    fi

    # Test 5: API endpoints (se expostos)
    if http_request "$base_url/api/health" 200 >/dev/null 2>&1; then
        success "API health endpoint funciona"
    else
        skip "API health endpoint (pode não existir)"
    fi

    return 0
}

# Testes de integração
test_integrations() {
    log "🔗 Iniciando testes de integração..."

    load_environment

    # Test 1: Conectividade com Supabase
    if [[ -n "${VITE_SUPABASE_URL:-}" ]]; then
        if http_request "$VITE_SUPABASE_URL/health" 200 >/dev/null 2>&1; then
            success "Supabase acessível"
        else
            # Tentar apenas conectividade básica
            local domain=$(echo "$VITE_SUPABASE_URL" | sed 's|https\?://||' | cut -d'/' -f1)
            if ping -c 1 -W 5 "$domain" >/dev/null 2>&1; then
                success "Domínio Supabase responde"
            else
                fail "Supabase não acessível"
            fi
        fi
    else
        skip "VITE_SUPABASE_URL não configurado"
    fi

    # Test 2: Supabase API com key
    if [[ -n "${VITE_SUPABASE_URL:-}" ]] && [[ -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
        local supabase_api="$VITE_SUPABASE_URL/rest/v1/"
        if curl -s -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" "$supabase_api" >/dev/null 2>&1; then
            success "Supabase API com credenciais funciona"
        else
            warning "Supabase API com credenciais não responde"
        fi
    else
        skip "Credenciais Supabase não configuradas"
    fi

    # Test 3: Evolution API (se configurado)
    if [[ -n "${EVOLUTION_API_URL:-}" ]]; then
        if http_request "$EVOLUTION_API_URL/health" 200 >/dev/null 2>&1; then
            success "Evolution API acessível"
        else
            warning "Evolution API não acessível"
        fi
    else
        skip "Evolution API não configurado"
    fi

    # Test 4: DNS resolution para domínios externos
    local external_domains=("google.com" "github.com")
    for domain in "${external_domains[@]}"; do
        if nslookup "$domain" >/dev/null 2>&1; then
            success "DNS resolution para $domain"
        else
            fail "DNS resolution para $domain falhou"
        fi
    done

    return 0
}

# Testes de performance
test_performance() {
    log "⚡ Iniciando testes de performance..."

    load_environment

    local app_domain="${APP_DOMAIN:-localhost}"
    local base_url="https://$app_domain"

    if [[ "$app_domain" == "localhost" ]]; then
        if curl -s --connect-timeout 5 http://localhost:80 >/dev/null 2>&1; then
            base_url="http://localhost:80"
        elif curl -s --connect-timeout 5 http://localhost:8080 >/dev/null 2>&1; then
            base_url="http://localhost:8080"
        fi
    fi

    # Test 1: Tempo de resposta < 3s
    local start_time=$(date +%s.%N)
    if http_request "$base_url" 200 >/dev/null; then
        local end_time=$(date +%s.%N)
        local response_time=$(echo "$end_time - $start_time" | bc -l)
        local response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)

        if [[ ${response_time_ms} -lt 3000 ]]; then
            success "Tempo de resposta OK: ${response_time_ms}ms"
        else
            warning "Tempo de resposta alto: ${response_time_ms}ms"
        fi
    else
        fail "Não foi possível medir tempo de resposta"
    fi

    # Test 2: Teste de carga básico (10 requests concorrentes)
    local load_test_passed=true
    local concurrent_requests=10

    log "Executando teste de carga ($concurrent_requests requests)..."

    for i in $(seq 1 $concurrent_requests); do
        if ! http_request "$base_url" 200 >/dev/null 2>&1 & then
            load_test_passed=false
        fi
    done
    wait

    if [[ "$load_test_passed" == "true" ]]; then
        success "Teste de carga básico passou"
    else
        warning "Teste de carga básico falhou parcialmente"
    fi

    # Test 3: Compressão gzip
    if curl -s -H "Accept-Encoding: gzip" "$base_url" | file - | grep -q "gzip"; then
        success "Compressão gzip ativa"
    else
        warning "Compressão gzip não detectada"
    fi

    return 0
}

# Testes de segurança
test_security() {
    log "🔒 Iniciando testes de segurança..."

    load_environment

    local app_domain="${APP_DOMAIN:-localhost}"
    local base_url="https://$app_domain"

    if [[ "$app_domain" == "localhost" ]]; then
        if curl -s --connect-timeout 5 http://localhost:80 >/dev/null 2>&1; then
            base_url="http://localhost:80"
        elif curl -s --connect-timeout 5 http://localhost:8080 >/dev/null 2>&1; then
            base_url="http://localhost:8080"
        fi
    fi

    # Test 1: Headers de segurança
    local security_headers=(
        "X-Frame-Options"
        "X-Content-Type-Options"
        "X-XSS-Protection"
        "Referrer-Policy"
    )

    local headers_response=$(curl -s -I "$base_url")
    for header in "${security_headers[@]}"; do
        if echo "$headers_response" | grep -qi "$header"; then
            success "Header de segurança presente: $header"
        else
            warning "Header de segurança ausente: $header"
        fi
    done

    # Test 2: HTTPS redirect (se domínio real)
    if [[ "$app_domain" != "localhost" ]]; then
        if curl -s -I "http://$app_domain" | grep -q "301\|302"; then
            success "Redirecionamento HTTPS funciona"
        else
            fail "Redirecionamento HTTPS não configurado"
        fi
    else
        skip "Teste HTTPS redirect (apenas localhost)"
    fi

    # Test 3: Teste de vulnerabilidades básicas
    # SQL Injection básico
    if http_request "$base_url/?id=1'OR'1'='1" 200 >/dev/null 2>&1; then
        warning "Aplicação responde a tentativa de SQL injection (verificar logs)"
    fi

    # XSS básico
    if http_request "$base_url/?search=<script>alert(1)</script>" 200 >/dev/null 2>&1; then
        warning "Aplicação responde a tentativa de XSS (verificar logs)"
    fi

    # Test 4: Rate limiting (se configurado)
    log "Testando rate limiting..."
    local rate_limit_triggered=false

    for i in {1..20}; do
        local response_code=$(curl -s -w "%{http_code}" -o /dev/null "$base_url" 2>/dev/null || echo "000")
        if [[ "$response_code" == "429" ]]; then
            rate_limit_triggered=true
            break
        fi
        sleep 0.1
    done

    if [[ "$rate_limit_triggered" == "true" ]]; then
        success "Rate limiting está funcionando"
    else
        warning "Rate limiting não detectado (pode não estar configurado)"
    fi

    return 0
}

# Testes de monitoramento
test_monitoring() {
    log "📊 Iniciando testes de monitoramento..."

    # Test 1: Health checks configurados
    local health_checks_ok=true
    for service in $(docker stack services "$STACK_NAME" --format "{{.Name}}"); do
        local health_config=$(docker service inspect "$service" --format "{{.Spec.TaskTemplate.ContainerSpec.Healthcheck}}" 2>/dev/null || echo "")
        if [[ "$health_config" != "<no value>" ]] && [[ -n "$health_config" ]]; then
            success "Health check configurado para $service"
        else
            warning "Health check não configurado para $service"
            health_checks_ok=false
        fi
    done

    # Test 2: Logs disponíveis
    if docker service logs "$STACK_NAME"_antropia-desk --tail 1 >/dev/null 2>&1; then
        success "Logs acessíveis"
    else
        fail "Logs não acessíveis"
    fi

    # Test 3: Métricas (se Prometheus estiver rodando)
    if curl -s http://localhost:9090/metrics >/dev/null 2>&1; then
        success "Prometheus métricas disponíveis"
    else
        skip "Prometheus não detectado (opcional)"
    fi

    # Test 4: Grafana (se estiver rodando)
    if docker stack services "$STACK_NAME" --format "{{.Name}}" | grep -q grafana; then
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            success "Grafana acessível"
        else
            warning "Grafana não acessível"
        fi
    else
        skip "Grafana não deployado (opcional)"
    fi

    return 0
}

# Gerar relatório de testes
generate_test_report() {
    local report_file="${PROJECT_ROOT}/test-report-$(date +%Y%m%d-%H%M%S).json"
    local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    log "Gerando relatório de testes..."

    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "stack_name": "$STACK_NAME",
  "test_summary": {
    "total": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "skipped": $SKIPPED_TESTS,
    "success_rate": "$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)%"
  },
  "environment": {
    "app_domain": "${APP_DOMAIN:-not_set}",
    "node_env": "${NODE_ENV:-not_set}",
    "stack_services": $(docker stack services "$STACK_NAME" --format json 2>/dev/null | jq -s '.' || echo '[]')
  },
  "test_categories": {
    "infrastructure": "executed",
    "connectivity": "executed",
    "application": "executed",
    "integrations": "executed",
    "performance": "executed",
    "security": "executed",
    "monitoring": "executed"
  }
}
EOF

    success "Relatório de testes gerado: $report_file"
    return 0
}

# Mostrar resumo final
show_summary() {
    echo ""
    echo "========================================"
    log "📋 RESUMO DOS TESTES"
    echo "========================================"
    echo ""

    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    fi

    echo -e "📊 Total de testes: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "✅ Aprovados: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "❌ Falharam: ${RED}$FAILED_TESTS${NC}"
    echo -e "⏭️ Pulados: ${PURPLE}$SKIPPED_TESTS${NC}"
    echo -e "📈 Taxa de sucesso: ${GREEN}${success_rate}%${NC}"
    echo ""

    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 TODOS OS TESTES CRÍTICOS PASSARAM!${NC}"
        echo -e "${GREEN}✨ Sistema está funcionando corretamente.${NC}"
        return 0
    else
        echo -e "${RED}⚠️ ALGUNS TESTES FALHARAM!${NC}"
        echo -e "${YELLOW}🔧 Verifique os logs e corrija os problemas antes de colocar em produção.${NC}"
        return 1
    fi
}

# Função de ajuda
show_help() {
    cat << EOF
🧪 Post-Deploy Tests - Antropia Desk

USO: $0 [COMANDO] [OPÇÕES]

COMANDOS:
    all (padrão)       Executar todos os testes
    infrastructure     Testes de infraestrutura Docker
    connectivity       Testes de conectividade HTTP/HTTPS
    application        Testes da aplicação React
    integrations       Testes de integrações externas
    performance        Testes de performance básicos
    security           Testes de segurança básicos
    monitoring         Testes de monitoramento
    report             Gerar apenas relatório (sem executar testes)

OPÇÕES:
    --timeout N        Timeout para requests HTTP (padrão: 30s)
    --parallel         Executar testes em paralelo (experimental)
    --stack NAME       Nome da stack (padrão: antropia)

EXEMPLOS:
    $0                 # Executar todos os testes
    $0 connectivity    # Apenas testes de conectividade
    $0 --timeout 60    # Com timeout de 60s
    $0 all --parallel  # Todos os testes em paralelo

OBSERVAÇÕES:
- Execute após deploy bem-sucedido
- Certifique-se de que .env está configurado
- Alguns testes requerem aplicação acessível
- Testes marcados como CRÍTICOS devem passar

EOF
}

# Função principal
main() {
    local test_category="${1:-all}"

    # Parse de argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --timeout)
                TEST_TIMEOUT="$2"
                shift 2
                ;;
            --parallel)
                PARALLEL_TESTS=true
                shift
                ;;
            --stack)
                STACK_NAME="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            infrastructure|connectivity|application|integrations|performance|security|monitoring|report|all)
                test_category="$1"
                shift
                ;;
            --*)
                warning "Opção desconhecida: $1"
                shift
                ;;
            *)
                test_category="$1"
                shift
                ;;
        esac
    done

    log "🚀 Iniciando testes pós-deploy para $STACK_NAME"
    log "⏱️ Timeout configurado: ${TEST_TIMEOUT}s"

    case $test_category in
        "infrastructure")
            test_infrastructure
            ;;
        "connectivity")
            test_connectivity
            ;;
        "application")
            test_application
            ;;
        "integrations")
            test_integrations
            ;;
        "performance")
            test_performance
            ;;
        "security")
            test_security
            ;;
        "monitoring")
            test_monitoring
            ;;
        "report")
            generate_test_report
            return 0
            ;;
        "all")
            if [[ "$PARALLEL_TESTS" == "true" ]]; then
                log "⚡ Executando testes em paralelo..."
                test_infrastructure &
                test_connectivity &
                test_application &
                test_integrations &
                test_performance &
                test_security &
                test_monitoring &
                wait
            else
                test_infrastructure
                test_connectivity
                test_application
                test_integrations
                test_performance
                test_security
                test_monitoring
            fi
            ;;
        *)
            warning "Categoria de teste desconhecida: $test_category"
            show_help
            exit 1
            ;;
    esac

    generate_test_report
    show_summary

    # Retornar código de erro se houver falhas críticas
    if [[ $FAILED_TESTS -gt 0 ]]; then
        exit 1
    fi
}

# Executar função principal
main "$@"