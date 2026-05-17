#!/bin/bash
# ================================
# Deploy Automatizado - Antropia Desk
# Deploy seguro para Docker Swarm com rollback automático
# ================================

set -euo pipefail

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STACK_NAME="${STACK_NAME:-antropia}"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"
ENV_FILE="${PROJECT_ROOT}/.env"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOG_FILE="${BACKUP_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Função de logging
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "${BLUE}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

success() {
    local message="✅ $1"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

warning() {
    local message="⚠️  $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

error() {
    local message="❌ $1"
    echo -e "${RED}${message}${NC}"
    echo "$message" >> "$LOG_FILE"
}

# Função para cleanup em caso de erro
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Deploy falhou com código $exit_code"
        error "Log completo disponível em: $LOG_FILE"
    fi
}

# Configurar trap para cleanup
trap cleanup EXIT

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Inicializar log
log "Iniciando deploy do Antropia Desk..."
log "Stack: $STACK_NAME"
log "Compose file: $COMPOSE_FILE"
log "Environment file: $ENV_FILE"

# Verificar dependências
check_dependencies() {
    log "Verificando dependências..."

    local deps=("docker" "git")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            error "Dependência não encontrada: $dep"
            exit 1
        fi
        success "Dependência OK: $dep"
    done
}

# Verificar se é um manager node
check_swarm_manager() {
    log "Verificando Docker Swarm..."

    if ! docker node ls >/dev/null 2>&1; then
        error "Este script deve ser executado em um nó manager do Docker Swarm!"
        error "Execute: docker swarm init"
        exit 1
    fi

    local manager_nodes=$(docker node ls --filter "role=manager" --format "{{.Status}}" | grep -c "Ready" || echo "0")
    local total_nodes=$(docker node ls --format "{{.Status}}" | grep -c "Ready" || echo "0")

    success "Docker Swarm ativo: $total_nodes nós ($manager_nodes managers)"
}

# Verificar arquivos necessários
check_files() {
    log "Verificando arquivos necessários..."

    local required_files=("$COMPOSE_FILE" "$ENV_FILE")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            error "Arquivo não encontrado: $file"
            exit 1
        fi
        success "Arquivo OK: $file"
    done

    # Verificar scripts auxiliares
    if [ -f "${SCRIPT_DIR}/secrets.sh" ]; then
        success "Script de secrets disponível"
    else
        warning "Script de secrets não encontrado"
    fi

    if [ -f "${SCRIPT_DIR}/security-check.sh" ]; then
        success "Script de verificação de segurança disponível"
    else
        warning "Script de verificação não encontrado"
    fi
}

# Carregar variáveis de ambiente
load_environment() {
    log "Carregando variáveis de ambiente..."

    if [ ! -f "$ENV_FILE" ]; then
        error "Arquivo .env não encontrado!"
        exit 1
    fi

    # Source do .env
    set -a
    source "$ENV_FILE"
    set +a

    # Validar variáveis obrigatórias
    local required_vars=("APP_DOMAIN" "LETSENCRYPT_EMAIL" "VITE_SUPABASE_URL")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            error "Variável obrigatória não definida: $var"
            exit 1
        fi
        success "Variável OK: $var"
    done
}

# Executar verificação de segurança
run_security_check() {
    log "Executando verificação de segurança..."

    if [ -f "${SCRIPT_DIR}/security-check.sh" ]; then
        if ! "${SCRIPT_DIR}/security-check.sh"; then
            error "Verificação de segurança falhou!"
            exit 1
        fi
        success "Verificação de segurança passou"
    else
        warning "Pulando verificação de segurança (script não encontrado)"
    fi
}

# Verificar/criar secrets
setup_secrets() {
    log "Configurando secrets..."

    if [ -f "${SCRIPT_DIR}/secrets.sh" ]; then
        # Verificar se secrets existem
        if ! "${SCRIPT_DIR}/secrets.sh" validate >/dev/null 2>&1; then
            warning "Secrets não encontrados, criando..."
            "${SCRIPT_DIR}/secrets.sh" init
        else
            success "Secrets já estão configurados"
        fi
    else
        warning "Script de secrets não encontrado, pulando..."
    fi
}

# Fazer backup do estado atual
backup_current_state() {
    log "Fazendo backup do estado atual..."

    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="${BACKUP_DIR}/stack-backup-${timestamp}.yml"

    # Backup da stack atual (se existir)
    if docker stack ls --format "{{.Name}}" | grep -q "^${STACK_NAME}$"; then
        docker stack config "$STACK_NAME" > "$backup_file" 2>/dev/null || {
            warning "Não foi possível fazer backup da configuração da stack"
        }
        success "Backup da stack salvo em: $backup_file"

        # Backup da lista de serviços
        docker stack services "$STACK_NAME" --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}" > "${BACKUP_DIR}/services-${timestamp}.txt"
        success "Backup dos serviços salvo"
    else
        warning "Stack $STACK_NAME não existe, pulando backup"
    fi
}

# Fazer build da imagem (se necessário)
build_image() {
    local build_required="${BUILD_IMAGE:-false}"

    if [ "$build_required" == "true" ]; then
        log "Fazendo build da imagem..."

        cd "$PROJECT_ROOT"

        # Tag da versão
        local version="${VERSION:-$(date +%Y%m%d-%H%M%S)}"
        local image_name="antropia-desk:${version}"

        docker build \
            --target production \
            --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
            --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
            --tag "$image_name" \
            --tag "antropia-desk:latest" \
            .

        success "Imagem buildada: $image_name"

        # Atualizar variável para o compose
        export VERSION="$version"
    else
        log "Build de imagem não solicitado (BUILD_IMAGE!=true)"
    fi
}

# Validar arquivo compose
validate_compose() {
    log "Validando arquivo compose..."

    if ! docker-compose -f "$COMPOSE_FILE" config >/dev/null; then
        error "Arquivo compose inválido!"
        exit 1
    fi

    success "Arquivo compose válido"
}

# Fazer deploy
deploy_stack() {
    log "Fazendo deploy da stack $STACK_NAME..."

    # Deploy com configurações de atualização
    docker stack deploy \
        --compose-file "$COMPOSE_FILE" \
        --with-registry-auth \
        --resolve-image=always \
        "$STACK_NAME"

    success "Deploy da stack iniciado"
}

# Aguardar serviços ficarem prontos
wait_for_services() {
    log "Aguardando serviços ficarem prontos..."

    local timeout=300 # 5 minutos
    local interval=10
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        local converged=$(docker stack services "$STACK_NAME" --format "{{.Name}} {{.Replicas}}" | grep -c "/[1-9]" || echo 0)
        local total=$(docker stack services "$STACK_NAME" | tail -n +2 | wc -l)

        if [ "$converged" -eq "$total" ]; then
            success "Todos os serviços estão rodando ($converged/$total)"
            return 0
        fi

        log "Aguardando convergência: $converged/$total serviços prontos..."
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    error "Timeout aguardando serviços ficarem prontos"
    return 1
}

# Verificar health dos serviços
check_service_health() {
    log "Verificando saúde dos serviços..."

    local failed_services=()

    # Aguardar um pouco para health checks começarem
    sleep 30

    for service in $(docker stack services "$STACK_NAME" --format "{{.Name}}"); do
        local replicas=$(docker service inspect "$service" --format "{{.Spec.Mode.Replicated.Replicas}}" 2>/dev/null || echo "1")
        local running=$(docker service ps "$service" --format "{{.CurrentState}}" | grep -c "Running" || echo "0")

        if [ "$running" -eq "$replicas" ]; then
            success "Serviço healthy: $service ($running/$replicas)"
        else
            error "Serviço unhealthy: $service ($running/$replicas)"
            failed_services+=("$service")
        fi
    done

    if [ ${#failed_services[@]} -gt 0 ]; then
        error "Serviços com problema: ${failed_services[*]}"
        return 1
    fi

    return 0
}

# Fazer rollback em caso de falha
rollback_deployment() {
    log "Executando rollback do deployment..."

    # Tentar rollback automático de cada serviço
    for service in $(docker stack services "$STACK_NAME" --format "{{.Name}}"); do
        log "Fazendo rollback do serviço: $service"
        docker service rollback "$service" || warning "Falha no rollback de $service"
    done

    success "Rollback executado"
}

# Executar testes pós-deploy
run_post_deploy_tests() {
    log "Executando testes pós-deploy..."

    # Verificar se a aplicação responde
    local app_url="https://${APP_DOMAIN}"
    local max_attempts=10
    local attempt=1

    log "Testando conectividade: $app_url"

    while [ $attempt -le $max_attempts ]; do
        if curl -s -k --connect-timeout 10 "$app_url" >/dev/null 2>&1; then
            success "Aplicação responde no endereço: $app_url"
            return 0
        fi

        warning "Tentativa $attempt/$max_attempts falhou, aguardando..."
        sleep 15
        attempt=$((attempt + 1))
    done

    error "Aplicação não responde após $max_attempts tentativas"
    return 1
}

# Mostrar status final
show_final_status() {
    log "Status final do deployment:"

    echo ""
    echo "=== SERVIÇOS ==="
    docker stack services "$STACK_NAME"

    echo ""
    echo "=== TASKS ==="
    docker stack ps "$STACK_NAME" --no-trunc

    echo ""
    echo "=== NETWORKS ==="
    docker network ls | grep -E "(antropia|traefik)"

    echo ""
    echo "=== SECRETS ==="
    docker secret ls | grep antropia

    echo ""
    success "Deploy concluído com sucesso!"
    success "Aplicação disponível em: https://${APP_DOMAIN}"
    success "Dashboard Traefik em: https://traefik.${APP_DOMAIN}"
    success "Log completo em: $LOG_FILE"
}

# Função para cleanup completo
cleanup_failed_deployment() {
    error "Deploy falhou, executando limpeza..."

    # Remover stack com falha
    if docker stack ls --format "{{.Name}}" | grep -q "^${STACK_NAME}$"; then
        docker stack rm "$STACK_NAME"
        success "Stack removida"
    fi

    # Aguardar limpeza completa
    sleep 30

    error "Ambiente limpo. Verifique os logs e tente novamente."
}

# Função de ajuda
show_help() {
    cat << EOF
🚀 Deploy Automatizado - Antropia Desk

USO: $0 [OPÇÕES] [COMANDO]

COMANDOS:
    deploy (padrão)     Deploy completo da aplicação
    rollback           Rollback do deployment atual
    status             Mostrar status dos serviços
    logs               Mostrar logs dos serviços
    cleanup            Limpar deployment completamente

OPÇÕES:
    --build            Fazer build da imagem antes do deploy
    --skip-checks      Pular verificações de segurança
    --force            Forçar deploy mesmo com warnings
    --env FILE         Usar arquivo de ambiente específico (padrão: .env)

VARIÁVEIS DE AMBIENTE:
    STACK_NAME         Nome da stack (padrão: antropia)
    BUILD_IMAGE        Se deve fazer build (true/false)
    VERSION            Tag da versão da imagem
    APP_DOMAIN         Domínio da aplicação
    LETSENCRYPT_EMAIL  Email para certificados SSL

EXEMPLOS:
    $0                 # Deploy padrão
    $0 --build         # Deploy com build da imagem
    $0 rollback        # Rollback do deployment
    $0 status          # Ver status dos serviços
    $0 cleanup         # Limpar tudo

OBSERVAÇÕES:
- Execute em um nó manager do Docker Swarm
- Tenha certeza de que .env está configurado corretamente
- Faça backup antes de deployments críticos
- Teste sempre em ambiente de desenvolvimento primeiro

EOF
}

# Função principal
main() {
    local command="deploy"
    local skip_checks=false
    local force_deploy=false

    # Parse de argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --build)
                export BUILD_IMAGE=true
                shift
                ;;
            --skip-checks)
                skip_checks=true
                shift
                ;;
            --force)
                force_deploy=true
                shift
                ;;
            --env)
                ENV_FILE="$2"
                shift 2
                ;;
            deploy|rollback|status|logs|cleanup)
                command="$1"
                shift
                ;;
            help|--help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Opção desconhecida: $1"
                exit 1
                ;;
        esac
    done

    case $command in
        "deploy")
            check_dependencies
            check_swarm_manager
            check_files
            load_environment

            if [ "$skip_checks" != "true" ]; then
                run_security_check
            fi

            setup_secrets
            backup_current_state
            build_image
            validate_compose
            deploy_stack
            wait_for_services

            if check_service_health; then
                if run_post_deploy_tests; then
                    show_final_status
                else
                    if [ "$force_deploy" != "true" ]; then
                        rollback_deployment
                        exit 1
                    else
                        warning "Testes falharam, mas deploy mantido (--force usado)"
                    fi
                fi
            else
                if [ "$force_deploy" != "true" ]; then
                    rollback_deployment
                    exit 1
                else
                    warning "Health checks falharam, mas deploy mantido (--force usado)"
                fi
            fi
            ;;

        "rollback")
            check_swarm_manager
            rollback_deployment
            ;;

        "status")
            check_swarm_manager
            docker stack services "$STACK_NAME"
            ;;

        "logs")
            check_swarm_manager
            docker stack ps "$STACK_NAME"
            ;;

        "cleanup")
            check_swarm_manager
            warning "Esta operação irá remover completamente a stack $STACK_NAME"
            read -p "Continuar? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cleanup_failed_deployment
            else
                log "Operação cancelada"
            fi
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