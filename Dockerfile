# ================================
# Multi-Stage Dockerfile para Antropia Desk
# Sistema de Help Desk baseado em React 19 + Vite + Supabase
# ================================

# ================================
# Etapa 1: Build do Frontend
# ================================
FROM node:20-alpine AS builder

# Metadata
LABEL maintainer="Antropia Development Team"
LABEL description="Antropia Desk - Sistema de Help Desk e Ticketing"
LABEL version="0.0.60"

# Instalar dependências do sistema
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Configurar diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração para cache de dependências
COPY package.json package-lock.json ./
COPY .npmrc ./

# Instalar dependências (aproveitar cache do Docker)
RUN npm ci

# Copiar código fonte
COPY . .

# Build Arguments para variáveis de ambiente do Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG NODE_ENV=production

# Exportar variáveis de ambiente para o build
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
ENV NODE_ENV=${NODE_ENV}

# Executar build de produção
RUN npm run build

# Limpar arquivos de desenvolvimento
RUN rm -rf node_modules src .env .git

# ================================
# Etapa 2: Servidor Nginx de Produção
# ================================
FROM nginx:1.25-alpine AS production

# Instalar certificados CA atualizados
RUN apk add --no-cache ca-certificates tzdata \
    && rm -rf /var/cache/apk/*

# Definir timezone (pode ser sobrescrito via env)
ENV TZ=America/Sao_Paulo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Remover configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuração customizada do Nginx
COPY --from=builder /app/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar arquivos buildados para o Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Criar script de entrada para substituição de variáveis de ambiente
COPY --from=builder /app/docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx-app -g nginx-app nginx-app

# Configurar permissões
RUN chown -R nginx-app:nginx-app /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    chmod 755 /usr/share/nginx/html && \
    mkdir -p /var/log/nginx /var/cache/nginx/client_temp && \
    chown -R nginx-app:nginx-app /var/log/nginx

# Health check - simplified to just check nginx is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep nginx > /dev/null || exit 1

# Expor porta
EXPOSE 80

# Nginx master precisa de root para bind na porta 80 e gravar o PID.
# Os workers rodam como non-root via diretiva 'user' no nginx.conf principal.

# Comando de entrada
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

# ================================
# Etapa 3: Desenvolvimento (target dev)
# ================================
FROM node:20-alpine AS development

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache git python3 make g++

# Copiar arquivos de configuração
COPY package.json package-lock.json ./
COPY .npmrc ./

# Instalar todas as dependências (incluindo dev)
RUN npm ci

# Copiar código fonte
COPY . .

# Expor porta de desenvolvimento
EXPOSE 8080

# Health check para desenvolvimento
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1

# Comando para desenvolvimento
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]