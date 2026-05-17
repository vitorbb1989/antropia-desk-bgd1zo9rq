# ================================
# Makefile - Antropia Desk
# Comandos simplificados para deploy e operação
# ================================

.PHONY: help dev build deploy rollback status logs cleanup secrets security-check

# Configurações padrão
STACK_NAME ?= antropia
VERSION ?= latest
COMPOSE_FILE ?= docker-compose.prod.yml
ENV_FILE ?= .env

# Cores para output
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m

help: ## Mostrar esta ajuda
	@echo "$(GREEN)🚀 Antropia Desk - Sistema de Help Desk$(NC)"
	@echo ""
	@echo "$(YELLOW)Comandos Disponíveis:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Variáveis:$(NC)"
	@echo "  STACK_NAME     Nome da stack Docker (padrão: antropia)"
	@echo "  VERSION        Versão da imagem (padrão: latest)"
	@echo "  ENV_FILE       Arquivo de ambiente (padrão: .env)"
	@echo ""
	@echo "$(YELLOW)Exemplos:$(NC)"
	@echo "  make dev           # Ambiente de desenvolvimento"
	@echo "  make build         # Build da aplicação"
	@echo "  make deploy        # Deploy em produção"
	@echo "  make status        # Status dos serviços"

# ================================
# Comandos de Desenvolvimento
# ================================

dev: ## Iniciar ambiente de desenvolvimento
	@echo "$(GREEN)🔧 Iniciando ambiente de desenvolvimento...$(NC)"
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "$(RED)❌ Arquivo $(ENV_FILE) não encontrado!$(NC)"; \
		echo "$(YELLOW)💡 Copie .env.example para .env e configure as variáveis$(NC)"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.yml up --build

dev-detached: ## Iniciar ambiente de desenvolvimento em background
	@echo "$(GREEN)🔧 Iniciando ambiente de desenvolvimento (background)...$(NC)"
	docker-compose -f docker-compose.yml up --build -d

dev-stop: ## Parar ambiente de desenvolvimento
	@echo "$(YELLOW)🛑 Parando ambiente de desenvolvimento...$(NC)"
	docker-compose -f docker-compose.yml down

dev-logs: ## Ver logs do desenvolvimento
	docker-compose -f docker-compose.yml logs -f

# ================================
# Build e Deploy
# ================================

build: ## Fazer build da aplicação
	@echo "$(GREEN)🏗️ Fazendo build da aplicação...$(NC)"
	npm run build

build-docker: ## Build da imagem Docker
	@echo "$(GREEN)🐳 Fazendo build da imagem Docker...$(NC)"
	docker build --target production -t antropia-desk:$(VERSION) -t antropia-desk:latest .

deploy: ## Deploy completo em produção
	@echo "$(GREEN)🚀 Iniciando deploy em produção...$(NC)"
	@if [ ! -f "scripts/deploy.sh" ]; then \
		echo "$(RED)❌ Script de deploy não encontrado!$(NC)"; \
		exit 1; \
	fi
	./scripts/deploy.sh deploy

deploy-build: ## Deploy com build da imagem
	@echo "$(GREEN)🚀 Deploy com build da imagem...$(NC)"
	./scripts/deploy.sh deploy --build

deploy-force: ## Deploy forçado (ignora falhas)
	@echo "$(YELLOW)⚠️ Deploy forçado (ignora falhas)...$(NC)"
	./scripts/deploy.sh deploy --force

# ================================
# Operações da Stack
# ================================

status: ## Ver status dos serviços
	@echo "$(GREEN)📊 Status dos serviços:$(NC)"
	@if docker stack ls | grep -q "$(STACK_NAME)"; then \
		docker stack services $(STACK_NAME); \
		echo ""; \
		docker stack ps $(STACK_NAME) --no-trunc; \
	else \
		echo "$(YELLOW)⚠️ Stack $(STACK_NAME) não encontrada$(NC)"; \
	fi

logs: ## Ver logs dos serviços
	@echo "$(GREEN)📝 Logs dos serviços:$(NC)"
	docker stack ps $(STACK_NAME)

rollback: ## Fazer rollback do deployment
	@echo "$(YELLOW)↩️ Fazendo rollback...$(NC)"
	./scripts/deploy.sh rollback

cleanup: ## Limpar deployment completo
	@echo "$(RED)🗑️ Limpando deployment completo...$(NC)"
	./scripts/deploy.sh cleanup

# ================================
# Secrets e Segurança
# ================================

secrets: ## Configurar secrets do Docker Swarm
	@echo "$(GREEN)🔐 Configurando secrets...$(NC)"
	@if [ ! -f "scripts/secrets.sh" ]; then \
		echo "$(RED)❌ Script de secrets não encontrado!$(NC)"; \
		exit 1; \
	fi
	./scripts/secrets.sh init

secrets-list: ## Listar secrets
	./scripts/secrets.sh list

secrets-backup: ## Fazer backup dos secrets
	./scripts/secrets.sh backup

security-check: ## Verificação de segurança
	@echo "$(GREEN)🔒 Executando verificação de segurança...$(NC)"
	@if [ ! -f "scripts/security-check.sh" ]; then \
		echo "$(RED)❌ Script de verificação não encontrado!$(NC)"; \
		exit 1; \
	fi
	./scripts/security-check.sh

security-report: ## Gerar relatório de segurança
	./scripts/security-check.sh report

# ================================
# Monitoramento e Troubleshooting
# ================================

health: ## Verificar saúde dos serviços
	@echo "$(GREEN)🩺 Verificando saúde dos serviços...$(NC)"
	@for service in $$(docker stack services $(STACK_NAME) --format "{{.Name}}"); do \
		echo "Serviço: $$service"; \
		docker service ps $$service --format "table {{.Name}}\t{{.CurrentState}}\t{{.Error}}"; \
		echo ""; \
	done

inspect: ## Inspecionar configuração da stack
	@echo "$(GREEN)🔍 Configuração da stack:$(NC)"
	docker stack config $(STACK_NAME)

stats: ## Estatísticas dos containers
	@echo "$(GREEN)📈 Estatísticas dos containers:$(NC)"
	docker stats --no-stream $$(docker stack ps $(STACK_NAME) --format "{{.Name}}.{{.ID}}")

# ================================
# Backup e Restore
# ================================

backup: ## Fazer backup completo
	@echo "$(GREEN)💾 Fazendo backup completo...$(NC)"
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d-%H%M%S); \
	echo "Backup timestamp: $$timestamp"; \
	docker stack config $(STACK_NAME) > backups/stack-$$timestamp.yml 2>/dev/null || true; \
	docker stack services $(STACK_NAME) > backups/services-$$timestamp.txt 2>/dev/null || true; \
	./scripts/secrets.sh backup 2>/dev/null || true; \
	echo "$(GREEN)✅ Backup concluído em backups/$$timestamp$(NC)"

# ================================
# Utilitários
# ================================

clean: ## Limpar recursos não utilizados
	@echo "$(YELLOW)🧹 Limpando recursos não utilizados...$(NC)"
	docker system prune -f
	docker volume prune -f

init-swarm: ## Inicializar Docker Swarm
	@echo "$(GREEN)🐝 Inicializando Docker Swarm...$(NC)"
	@if ! docker node ls >/dev/null 2>&1; then \
		docker swarm init; \
		echo "$(GREEN)✅ Docker Swarm inicializado$(NC)"; \
	else \
		echo "$(YELLOW)ℹ️ Docker Swarm já está ativo$(NC)"; \
	fi

create-network: ## Criar network traefik-public
	@echo "$(GREEN)🌐 Criando network traefik-public...$(NC)"
	@if ! docker network ls | grep -q "traefik-public"; then \
		docker network create --driver=overlay --attachable traefik-public; \
		echo "$(GREEN)✅ Network traefik-public criada$(NC)"; \
	else \
		echo "$(YELLOW)ℹ️ Network traefik-public já existe$(NC)"; \
	fi

setup: init-swarm create-network secrets ## Setup inicial completo
	@echo "$(GREEN)🎉 Setup inicial concluído!$(NC)"
	@echo "$(YELLOW)💡 Próximos passos:$(NC)"
	@echo "  1. Configure .env com suas variáveis"
	@echo "  2. Execute: make security-check"
	@echo "  3. Execute: make deploy"

# ================================
# Comandos de Teste
# ================================

test-local: ## Testar aplicação localmente
	@echo "$(GREEN)🧪 Testando aplicação localmente...$(NC)"
	npm run lint
	npm run build
	@echo "$(GREEN)✅ Testes locais passaram$(NC)"

test-health: ## Testar endpoints de saúde
	@echo "$(GREEN)🩺 Testando endpoints de saúde...$(NC)"
	@if [ -n "$$APP_DOMAIN" ]; then \
		curl -s -f "https://$$APP_DOMAIN/health" && echo "$(GREEN)✅ Health check passou$(NC)" || echo "$(RED)❌ Health check falhou$(NC)"; \
	else \
		echo "$(YELLOW)⚠️ APP_DOMAIN não configurado$(NC)"; \
	fi

# ================================
# Comandos de Desenvolvimento
# ================================

install: ## Instalar dependências
	@echo "$(GREEN)📦 Instalando dependências...$(NC)"
	npm install

format: ## Formatar código
	@echo "$(GREEN)✨ Formatando código...$(NC)"
	npm run format

lint: ## Verificar código
	@echo "$(GREEN)🔍 Verificando código...$(NC)"
	npm run lint

lint-fix: ## Corrigir problemas de código
	@echo "$(GREEN)🔧 Corrigindo problemas de código...$(NC)"
	npm run lint:fix

# ================================
# Informações
# ================================

info: ## Mostrar informações do sistema
	@echo "$(GREEN)ℹ️ Informações do sistema:$(NC)"
	@echo "Docker version: $$(docker --version)"
	@echo "Docker Compose version: $$(docker-compose --version)"
	@echo "Node.js version: $$(node --version 2>/dev/null || echo 'não instalado')"
	@echo "NPM version: $$(npm --version 2>/dev/null || echo 'não instalado')"
	@echo ""
	@if docker node ls >/dev/null 2>&1; then \
		echo "$(GREEN)Docker Swarm: Ativo$(NC)"; \
		docker node ls; \
	else \
		echo "$(YELLOW)Docker Swarm: Inativo$(NC)"; \
	fi

# Comando padrão
.DEFAULT_GOAL := help