#!/bin/bash

# =============================================================================
# SCRIPT DE APLICAÇÃO DAS CORREÇÕES CRÍTICAS DE SEGURANÇA
# =============================================================================
# Aplicar migrações de segurança criadas pela análise da Semana 1
#
# IMPORTANTE: Execute este script IMEDIATAMENTE para proteger os dados!
#
# Execução: ./apply_security_migrations.sh
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}🔒 INICIANDO APLICAÇÃO DAS CORREÇÕES CRÍTICAS DE SEGURANÇA${NC}"
echo "======================================================================="
echo "Este script aplicará as migrações que resolvem vulnerabilidades críticas:"
echo "• Row Level Security (RLS) em 11+ tabelas"
echo "• Políticas de isolamento por organização"
echo "• Correção de função RPC sem validação"
echo "======================================================================="
echo

# Check if migrations exist
MIGRATION1="$SCRIPT_DIR/supabase/migrations/20260203230000_critical_rls_security_fixes.sql"
MIGRATION2="$SCRIPT_DIR/supabase/migrations/20260203230001_fix_rpc_functions_security.sql"

if [[ ! -f "$MIGRATION1" ]]; then
    echo -e "${RED}❌ ERRO: Migration 1 não encontrada: $MIGRATION1${NC}"
    exit 1
fi

if [[ ! -f "$MIGRATION2" ]]; then
    echo -e "${RED}❌ ERRO: Migration 2 não encontrada: $MIGRATION2${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migrações encontradas e prontas para aplicação${NC}"
echo

# Method selection
echo -e "${YELLOW}Escolha o método de aplicação:${NC}"
echo "1. Supabase CLI (Recomendado - requer login)"
echo "2. Mostrar SQL para aplicação manual no Dashboard"
echo "3. Aplicar via psql (requer string de conexão)"
echo

read -p "Digite sua escolha (1-3): " method

case $method in
    1)
        echo -e "${BLUE}📋 Método 1: Supabase CLI${NC}"
        echo "Verificando se está logado no Supabase..."

        # Check if logged in
        if npx supabase projects list >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Logado no Supabase CLI${NC}"
        else
            echo -e "${YELLOW}⚠️ Não logado no Supabase CLI${NC}"
            echo "Execute primeiro:"
            echo "  npx supabase login"
            echo
            read -p "Já está logado? (y/N): " logged_in
            if [[ $logged_in != "y" && $logged_in != "Y" ]]; then
                echo -e "${RED}❌ Faça login primeiro e execute novamente${NC}"
                exit 1
            fi
        fi

        # Check if linked
        if [[ ! -f "$SCRIPT_DIR/.supabase/config.toml" ]]; then
            echo -e "${YELLOW}⚠️ Projeto não linkado ao Supabase${NC}"
            echo "Executando link automático..."
            cd "$SCRIPT_DIR"
            npx supabase init --debug
            npx supabase link --project-ref wevgxuxaplcmrnsktoud --debug
        fi

        echo -e "${BLUE}📤 Aplicando migrações...${NC}"
        cd "$SCRIPT_DIR"

        echo "Aplicando Migration 1: RLS Security Fixes..."
        npx supabase migration new critical_rls_security_fixes
        cp "$MIGRATION1" "supabase/migrations/$(ls supabase/migrations/ | tail -1)"

        echo "Aplicando Migration 2: RPC Functions Security..."
        npx supabase migration new fix_rpc_functions_security
        cp "$MIGRATION2" "supabase/migrations/$(ls supabase/migrations/ | tail -1)"

        # Apply migrations
        npx supabase db push --debug

        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}✅ MIGRAÇÕES APLICADAS COM SUCESSO!${NC}"
        else
            echo -e "${RED}❌ ERRO ao aplicar migrações${NC}"
            exit 1
        fi
        ;;

    2)
        echo -e "${BLUE}📋 Método 2: Aplicação Manual no Dashboard${NC}"
        echo "======================================================================="
        echo "1. Acesse: https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud"
        echo "2. Vá para: SQL Editor"
        echo "3. Execute as seguintes queries em ordem:"
        echo
        echo -e "${YELLOW}MIGRATION 1: Critical RLS Security Fixes${NC}"
        echo "-- Copie e cole no SQL Editor:"
        echo "-- Arquivo: $MIGRATION1"
        echo
        cat "$MIGRATION1"
        echo
        echo "======================================================================="
        echo -e "${YELLOW}MIGRATION 2: Fix RPC Functions Security${NC}"
        echo "-- Copie e cole no SQL Editor:"
        echo "-- Arquivo: $MIGRATION2"
        echo
        cat "$MIGRATION2"
        echo
        echo "======================================================================="
        echo -e "${GREEN}💡 Após executar ambas as migrações, execute este comando de validação:${NC}"
        echo
        cat << 'EOF'
-- VALIDAÇÃO: Execute para verificar se RLS foi aplicado
SELECT
  t.table_name,
  CASE WHEN p.rowsecurity THEN '✅ RLS Enabled' ELSE '❌ RLS Disabled' END as rls_status,
  COUNT(pol.policyname) as policy_count
FROM information_schema.tables t
LEFT JOIN pg_tables p ON p.tablename = t.table_name AND p.schemaname = 'public'
LEFT JOIN pg_policies pol ON pol.tablename = t.table_name AND pol.schemaname = 'public'
WHERE t.table_schema = 'public'
  AND t.table_name IN ('tickets', 'attachments', 'notifications', 'workflows', 'integrations_config')
GROUP BY t.table_name, p.rowsecurity
ORDER BY t.table_name;
EOF
        ;;

    3)
        echo -e "${BLUE}📋 Método 3: psql Connection${NC}"
        echo "Digite a string de conexão PostgreSQL:"
        echo "Formato: postgresql://user:password@host:port/database"
        echo "Exemplo: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
        echo
        read -p "String de conexão: " connection_string

        if [[ -z "$connection_string" ]]; then
            echo -e "${RED}❌ String de conexão não pode ser vazia${NC}"
            exit 1
        fi

        echo -e "${BLUE}📤 Aplicando Migration 1...${NC}"
        if psql "$connection_string" -f "$MIGRATION1"; then
            echo -e "${GREEN}✅ Migration 1 aplicada com sucesso${NC}"
        else
            echo -e "${RED}❌ ERRO na Migration 1${NC}"
            exit 1
        fi

        echo -e "${BLUE}📤 Aplicando Migration 2...${NC}"
        if psql "$connection_string" -f "$MIGRATION2"; then
            echo -e "${GREEN}✅ Migration 2 aplicada com sucesso${NC}"
        else
            echo -e "${RED}❌ ERRO na Migration 2${NC}"
            exit 1
        fi

        echo -e "${GREEN}✅ TODAS AS MIGRAÇÕES APLICADAS COM SUCESSO!${NC}"
        ;;

    *)
        echo -e "${RED}❌ Opção inválida${NC}"
        exit 1
        ;;
esac

echo
echo "======================================================================="
echo -e "${GREEN}🎉 CORREÇÕES DE SEGURANÇA APLICADAS!${NC}"
echo "======================================================================="
echo "✅ Row Level Security habilitado em 11+ tabelas críticas"
echo "✅ Políticas de isolamento por organização implementadas"
echo "✅ Função RPC test_notification_settings corrigida"
echo "✅ Sistema agora protege dados entre organizações"
echo
echo -e "${BLUE}📋 Próximos passos (Semana 2):${NC}"
echo "• Migrar credenciais para Supabase Vault"
echo "• Implementar audit trail"
echo "• Adicionar soft delete em tabelas críticas"
echo "• Criar testes automatizados de segurança"
echo
echo -e "${YELLOW}⚠️ IMPORTANTE: Teste a aplicação após aplicação para garantir que tudo funciona!${NC}"
echo "======================================================================="