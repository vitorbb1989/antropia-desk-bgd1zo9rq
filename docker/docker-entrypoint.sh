#!/bin/sh
# ================================
# Docker Entrypoint para Antropia Desk
# Substitui variáveis de ambiente no runtime
# ================================

set -e

echo "🚀 Iniciando Antropia Desk v0.0.60..."

# Função para log com timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Verificar se os arquivos necessários existem
if [ ! -f "/usr/share/nginx/html/index.html" ]; then
    log "❌ ERRO: Arquivos de build não encontrados!"
    exit 1
fi

# Ler secrets do Docker Swarm se disponíveis
if [ -f "/run/secrets/supabase_url" ] && [ -z "$VITE_SUPABASE_URL" ]; then
    export VITE_SUPABASE_URL="$(cat /run/secrets/supabase_url)"
fi
if [ -f "/run/secrets/supabase_key" ] && [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
    export VITE_SUPABASE_PUBLISHABLE_KEY="$(cat /run/secrets/supabase_key)"
fi

# Validar variáveis obrigatórias
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
    log "❌ ERRO: Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias!"
    exit 1
fi

# Rejeitar valores placeholder
case "$VITE_SUPABASE_URL" in
    *placeholder*|URL_NOT_SET)
        log "❌ ERRO: VITE_SUPABASE_URL contém valor placeholder! Configure o valor real."
        exit 1
        ;;
esac
case "$VITE_SUPABASE_PUBLISHABLE_KEY" in
    placeholder|KEY_NOT_SET)
        log "❌ ERRO: VITE_SUPABASE_PUBLISHABLE_KEY contém valor placeholder! Configure o valor real."
        exit 1
        ;;
esac

log "🔗 Configurando Supabase URL: $VITE_SUPABASE_URL"

# Criar arquivo temporário de configuração JavaScript
# que será injetado no index.html para substituir as variáveis de ambiente
# Sanitize values: strip single quotes to prevent JS injection
SAFE_URL=$(printf '%s' "$VITE_SUPABASE_URL" | tr -d "'" | tr -d '\n')
SAFE_KEY=$(printf '%s' "$VITE_SUPABASE_PUBLISHABLE_KEY" | tr -d "'" | tr -d '\n')

cat > /usr/share/nginx/html/env-config.js << EOF
window.ENV = {
  VITE_SUPABASE_URL: '${SAFE_URL}',
  VITE_SUPABASE_PUBLISHABLE_KEY: '${SAFE_KEY}'
};
EOF

# Verificar se o arquivo foi criado corretamente
if [ ! -f "/usr/share/nginx/html/env-config.js" ]; then
    log "❌ ERRO: Falha ao criar arquivo de configuração de ambiente!"
    exit 1
fi

log "✅ Arquivo de configuração de ambiente criado com sucesso"

# Substituir placeholder do Supabase host no nginx.conf CSP header
SUPABASE_HOST=$(printf '%s' "$VITE_SUPABASE_URL" | sed 's|https://||' | sed 's|http://||' | tr -d '/')
if [ -n "$SUPABASE_HOST" ]; then
    sed -i "s|__SUPABASE_HOST__|${SUPABASE_HOST}|g" /etc/nginx/conf.d/default.conf 2>/dev/null || true
    log "✅ CSP header atualizado com Supabase host: $SUPABASE_HOST"
fi

# Substituir variáveis de ambiente no arquivo index.html
# Isso permite que as variáveis sejam atualizadas em runtime
sed -i "s|{{VITE_SUPABASE_URL}}|${VITE_SUPABASE_URL}|g" /usr/share/nginx/html/index.html 2>/dev/null || true
sed -i "s|{{VITE_SUPABASE_PUBLISHABLE_KEY}}|${VITE_SUPABASE_PUBLISHABLE_KEY}|g" /usr/share/nginx/html/index.html 2>/dev/null || true

# Injetar script de configuração no index.html se não estiver presente
if ! grep -q "env-config.js" /usr/share/nginx/html/index.html; then
    sed -i '/<head>/a\    <script src="/env-config.js"></script>' /usr/share/nginx/html/index.html
    log "✅ Script de configuração de ambiente injetado no index.html"
fi

# Validar configuração do Nginx
nginx -t
if [ $? -ne 0 ]; then
    log "❌ ERRO: Configuração do Nginx inválida!"
    exit 1
fi

log "✅ Configuração do Nginx validada com sucesso"

# Configurar timezone se especificado (requer permissão de escrita)
if [ -n "$TZ" ] && [ -f "/usr/share/zoneinfo/$TZ" ]; then
    log "🌍 Configurando timezone: $TZ"
    ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime 2>/dev/null || log "⚠️ Sem permissão para alterar timezone (non-root)"
    echo "$TZ" > /etc/timezone 2>/dev/null || true
fi

# Verificar espaço em disco
DISK_USAGE=$(df /usr/share/nginx/html | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    log "⚠️ AVISO: Uso de disco alto: ${DISK_USAGE}%"
fi

# Log de informações do sistema
log "📊 Informações do sistema:"
log "   - Versão Nginx: $(nginx -v 2>&1 | cut -d' ' -f3)"
log "   - Arquivos estáticos: $(ls -la /usr/share/nginx/html | wc -l) arquivos"
log "   - Tamanho do build: $(du -sh /usr/share/nginx/html | cut -f1)"
log "   - Timezone: $(date '+%Z %z')"

# Health check interno
if [ -f "/usr/share/nginx/html/index.html" ]; then
    log "✅ Health check: Aplicação pronta para servir"
else
    log "❌ Health check falhou: index.html não encontrado"
    exit 1
fi

log "🎯 Antropia Desk iniciado com sucesso!"
log "🔗 Acesse a aplicação em: http://localhost"
log "📋 Dashboard de administração disponível após login"

# Executar comando passado como argumento
exec "$@"