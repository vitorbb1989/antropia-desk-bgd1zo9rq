#!/bin/bash
# ================================
# Gerenciamento de Secrets - Docker Swarm
# Sistema Antropia Desk
# ================================

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log com cores
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ✅ $1"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ⚠️  $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} ❌ $1"
}

# Verificar se está executando em um manager node
check_swarm_manager() {
    if ! docker node ls >/dev/null 2>&1; then
        error "Este script deve ser executado em um nó manager do Docker Swarm!"
        error "Execute: docker swarm init (ou docker swarm join se já existe um cluster)"
        exit 1
    fi
    success "Docker Swarm Manager detectado"
}

# Função para criar secret de forma segura
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local version="${3:-v1}"
    local full_name="${secret_name}_${version}"

    # Verificar se secret já existe
    if docker secret ls --format "table {{.Name}}" | grep -q "^${full_name}$"; then
        warning "Secret '${full_name}' já existe. Pulando..."
        return 0
    fi

    # Criar secret
    echo -n "$secret_value" | docker secret create "$full_name" - >/dev/null
    success "Secret '${full_name}' criado com sucesso"
}

# Função para atualizar secret (criar nova versão)
update_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local old_version="${3:-v1}"
    local new_version="${4:-v2}"

    local old_full_name="${secret_name}_${old_version}"
    local new_full_name="${secret_name}_${new_version}"

    # Criar nova versão do secret
    echo -n "$secret_value" | docker secret create "$new_full_name" - >/dev/null
    success "Nova versão do secret '${new_full_name}' criada"

    warning "Para aplicar a mudança, atualize o docker-compose.prod.yml e faça o redeploy"
    warning "Após confirmar que tudo funciona, remova o secret antigo com: docker secret rm $old_full_name"
}

# Função para listar secrets
list_secrets() {
    log "Secrets existentes no cluster:"
    docker secret ls --format "table {{.Name}}\t{{.CreatedAt}}\t{{.UpdatedAt}}"
}

# Função para remover secret
remove_secret() {
    local secret_name="$1"

    if ! docker secret ls --format "table {{.Name}}" | grep -q "^${secret_name}$"; then
        warning "Secret '${secret_name}' não existe"
        return 1
    fi

    # Verificar se secret está em uso
    if docker service ls --format "table {{.Name}}" | xargs -I {} docker service inspect {} 2>/dev/null | grep -q "$secret_name"; then
        error "Secret '${secret_name}' está em uso por serviços! Remova das configurações primeiro."
        return 1
    fi

    docker secret rm "$secret_name"
    success "Secret '${secret_name}' removido com sucesso"
}

# Função para ler variáveis do .env
read_env_file() {
    local env_file="${1:-.env}"

    if [ ! -f "$env_file" ]; then
        error "Arquivo $env_file não encontrado!"
        error "Copie .env.example para .env e configure as variáveis"
        exit 1
    fi

    # Source do arquivo .env
    set -a
    source "$env_file"
    set +a

    success "Variáveis carregadas de $env_file"
}

# Função para criar todos os secrets necessários
create_all_secrets() {
    log "Criando todos os secrets necessários para Antropia Desk..."

    # Verificar se as variáveis existem
    if [ -z "${VITE_SUPABASE_URL:-}" ]; then
        error "VITE_SUPABASE_URL não está definida!"
        exit 1
    fi

    if [ -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
        error "VITE_SUPABASE_PUBLISHABLE_KEY não está definida!"
        exit 1
    fi

    # Criar secrets principais
    create_secret "antropia_supabase_url" "$VITE_SUPABASE_URL" "v1"
    create_secret "antropia_supabase_key" "$VITE_SUPABASE_PUBLISHABLE_KEY" "v1"

    # Redis password (gerar se não existir)
    REDIS_PASSWORD="${REDIS_PASSWORD:-$(openssl rand -base64 32)}"
    create_secret "antropia_redis_password" "$REDIS_PASSWORD" "v1"

    # Grafana password (gerar se não existir)
    GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-$(openssl rand -base64 16)}"
    create_secret "antropia_grafana_password" "$GRAFANA_PASSWORD" "v1"

    # Evolution API Key (usar variável ou gerar)
    EVOLUTION_API_KEY="${EVOLUTION_API_KEY:-evolution-antropia-$(date +%Y)}"
    create_secret "antropia_evolution_api_key" "$EVOLUTION_API_KEY" "v1"

    success "Todos os secrets foram criados com sucesso!"

    # Mostrar secrets criados
    echo ""
    log "Secrets criados:"
    list_secrets | grep antropia
}

# Função para backup dos secrets
backup_secrets() {
    local backup_dir="./backups/secrets"
    local backup_file="${backup_dir}/secrets-backup-$(date +%Y%m%d-%H%M%S).txt"

    mkdir -p "$backup_dir"

    log "Criando backup dos secrets..."

    {
        echo "# Backup dos secrets - $(date)"
        echo "# ATENÇÃO: Este arquivo contém informações sensíveis!"
        echo ""
        docker secret ls --format "table {{.Name}}\t{{.CreatedAt}}"
    } > "$backup_file"

    # Proteger arquivo de backup
    chmod 600 "$backup_file"

    success "Backup criado em: $backup_file"
    warning "IMPORTANTE: Mantenha este arquivo seguro e nunca o commite no git!"
}

# Função para rotacionar secrets
rotate_secrets() {
    log "Iniciando rotação de secrets..."

    warning "Esta operação criará novas versões dos secrets."
    warning "Você precisará atualizar docker-compose.prod.yml e fazer redeploy."

    read -p "Continuar? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Rotação cancelada."
        exit 0
    fi

    # Gerar novos valores
    NEW_REDIS_PASSWORD=$(openssl rand -base64 32)
    NEW_GRAFANA_PASSWORD=$(openssl rand -base64 16)
    NEW_EVOLUTION_API_KEY="evolution-antropia-$(date +%Y%m%d)"

    # Criar novas versões
    update_secret "antropia_redis_password" "$NEW_REDIS_PASSWORD" "v1" "v2"
    update_secret "antropia_grafana_password" "$NEW_GRAFANA_PASSWORD" "v1" "v2"
    update_secret "antropia_evolution_api_key" "$NEW_EVOLUTION_API_KEY" "v1" "v2"

    success "Rotação de secrets concluída!"

    echo ""
    warning "PRÓXIMOS PASSOS:"
    warning "1. Atualize docker-compose.prod.yml para usar as novas versões (v2)"
    warning "2. Execute: docker stack deploy -c docker-compose.prod.yml antropia"
    warning "3. Após confirmar que tudo funciona, remova os secrets antigos"
}

# Função para validar secrets
validate_secrets() {
    log "Validando secrets..."

    local required_secrets=(
        "antropia_supabase_url_v1"
        "antropia_supabase_key_v1"
        "antropia_redis_password_v1"
        "antropia_grafana_password_v1"
    )

    local missing_secrets=()

    for secret in "${required_secrets[@]}"; do
        if ! docker secret ls --format "table {{.Name}}" | grep -q "^${secret}$"; then
            missing_secrets+=("$secret")
        fi
    done

    if [ ${#missing_secrets[@]} -eq 0 ]; then
        success "Todos os secrets obrigatórios estão presentes!"
        return 0
    else
        error "Secrets em falta:"
        for secret in "${missing_secrets[@]}"; do
            error "  - $secret"
        done
        return 1
    fi
}

# Função de ajuda
show_help() {
    cat << EOF
🔐 Gerenciamento de Secrets - Antropia Desk

USO: $0 [COMANDO] [OPÇÕES]

COMANDOS:
    init [env_file]     Inicializar todos os secrets (padrão: .env)
    list               Listar todos os secrets
    create <nome> <valor> [versão]  Criar um secret específico
    update <nome> <valor> [versão_antiga] [versão_nova]  Atualizar secret
    remove <nome>      Remover secret (apenas se não estiver em uso)
    backup             Fazer backup da lista de secrets
    rotate             Rotacionar secrets sensíveis
    validate           Validar se todos os secrets obrigatórios existem

EXEMPLOS:
    $0 init                          # Criar todos os secrets usando .env
    $0 init .env.prod               # Criar secrets usando .env.prod
    $0 list                         # Listar secrets
    $0 create meu_secret "valor"    # Criar secret específico
    $0 backup                       # Fazer backup
    $0 rotate                       # Rotacionar passwords
    $0 validate                     # Verificar secrets obrigatórios

OBSERVAÇÕES:
- Execute em um nó manager do Docker Swarm
- Mantenha os valores dos secrets seguros
- Use backup antes de operações críticas
- Teste sempre em ambiente de desenvolvimento primeiro

EOF
}

# Função principal
main() {
    local command="${1:-help}"

    case $command in
        "init")
            check_swarm_manager
            read_env_file "${2:-.env}"
            create_all_secrets
            validate_secrets
            ;;
        "list")
            check_swarm_manager
            list_secrets
            ;;
        "create")
            check_swarm_manager
            if [ $# -lt 3 ]; then
                error "Uso: $0 create <nome> <valor> [versão]"
                exit 1
            fi
            create_secret "$2" "$3" "${4:-v1}"
            ;;
        "update")
            check_swarm_manager
            if [ $# -lt 3 ]; then
                error "Uso: $0 update <nome> <valor> [versão_antiga] [versão_nova]"
                exit 1
            fi
            update_secret "$2" "$3" "${4:-v1}" "${5:-v2}"
            ;;
        "remove")
            check_swarm_manager
            if [ $# -lt 2 ]; then
                error "Uso: $0 remove <nome>"
                exit 1
            fi
            remove_secret "$2"
            ;;
        "backup")
            check_swarm_manager
            backup_secrets
            ;;
        "rotate")
            check_swarm_manager
            rotate_secrets
            ;;
        "validate")
            check_swarm_manager
            validate_secrets
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Comando desconhecido: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Executar função principal com todos os parâmetros
main "$@"