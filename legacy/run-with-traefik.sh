#!/bin/bash
# Script para rodar Antropia Desk com Traefik labels
docker run -d --name antropia-desk-live \
  --network minha_rede \
  --env-file .env \
  --label "traefik.enable=true" \
  --label "traefik.docker.lbswarm=false" \
  --label "traefik.docker.network=minha_rede" \
  --label "traefik.http.routers.antropia-desk-http.rule=Host(\`desk.antrop-ia.com\`) || Host(\`desk-status.antrop-ia.com\`)" \
  --label "traefik.http.routers.antropia-desk-http.entrypoints=web" \
  --label "traefik.http.routers.antropia-desk-http.middlewares=redirect-to-https" \
  --label "traefik.http.routers.antropia-desk.rule=Host(\`desk.antrop-ia.com\`) || Host(\`desk-status.antrop-ia.com\`)" \
  --label "traefik.http.routers.antropia-desk.entrypoints=websecure" \
  --label "traefik.http.routers.antropia-desk.tls=true" \
  --label "traefik.http.routers.antropia-desk.tls.certresolver=letsencryptresolver" \
  --label "traefik.http.services.antropia-desk.loadbalancer.server.port=80" \
  --label "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https" \
  --restart unless-stopped \
  antropia-desk:latest