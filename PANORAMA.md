# Panorama Geral — Antropia Desk até Produção

## Contexto

Voce esta voltando ao projeto Antropia Desk (sistema de help desk e ticketing) que ja foi colocado em producao em **https://desk.antrop-ia.com** durante esta jornada de trabalho. Este documento e um snapshot do estado atual e serve como guia para retomar o projeto sem precisar reler toda a conversa.

**Nada esta commitado ainda** — todo o trabalho da sessao esta como mudancas locais pendentes em `git status`. Antes de qualquer commit/PR e preciso decidir o que entra e o que e descartado.

---

## 1. Stack e Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind + shadcn/ui |
| Estado | Zustand |
| Backend | Supabase (Postgres + Auth + Edge Functions + Storage) |
| Reverse proxy / SSL | Traefik v3 (existente, na rede `minha_rede`) |
| Servidor web | Nginx 1.25 (Alpine, dentro do container) |
| Orquestracao | Docker Swarm (nó `oneserver`) |
| SSL | Lets Encrypt (HTTP challenge) |

---

## 2. Estado de Producao

### URLs ativas
- **App**: https://desk.antrop-ia.com → `200 OK` (HTTP/2, TLSv1.3)
- **Logo**: https://desk.antrop-ia.com/antropia-logo.svg → `200 OK`
- **Favicon**: https://desk.antrop-ia.com/favicon.svg → `200 OK` (servindo, mas browser pode nao mostrar — issue aberto, ver §8)

### Infraestrutura
- **IP do servidor**: `185.182.184.175` (IPv4) / `2a02:c207:2282:4553::1` (IPv6)
- **DNS configurado**: `desk.antrop-ia.com` → `185.182.184.175` ✓
- **DNS NAO configurado**: `desk-status.antrop-ia.com` (nem A nem AAAA) — esta excluido do router por isso
- **Stack Docker Swarm**: `antropia-desk` (1 replica rodando, image `antropia-desk:frontend`)
- **Compose ativo**: `docker-compose.traefik.yml` (rede `minha_rede`, integra com Traefik existente)
- **Traefik**: stack `traefik` ja existente, NAO foi instalado por nos. Compartilha SSL/cert resolver `letsencryptresolver`

### Certificado SSL
- Issuer: Lets Encrypt (R12)
- CN: `desk.antrop-ia.com`
- Expira: **3 Jul 2026** (renovacao automatica via Traefik)

---

## 3. Backend (Supabase)

- **Projeto**: `wevgxuxaplcmrnsktoud.supabase.co`
- **Dashboard**: https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud
- **Migrations aplicadas**: 20 (de `20260201000000` a `20260211150000`)
- **RLS**: habilitado nas tabelas criticas (tickets, attachments, notifications, etc.)

### Estado das tabelas (apos limpeza)
| Tabela | Registros | Observacao |
|---|---|---|
| `organizations` | 1 | Antrop-IA (id `e74f0f7c-7ad7-4e69-a41e-f46a1e8c5ea8`) |
| `memberships` | 1 | Admin user vinculado |
| `service_plans` | 0 | criar via UI admin |
| `ticket_categories` | 0 | criar via UI admin |
| `tickets` | 0 | sistema vazio, pronto para uso |

### Acesso admin
- **Email**: `admin@antrop-ia.com`
- **Senha**: `Antrop1a`
- **Role**: ADMIN
- **User ID**: `3a2e3957-ab7f-448a-b6cd-f27e3b172c52`

---

## 4. O que foi feito nesta jornada

### 4.1 Configuracao de URL
- Configurado dominio `desk.antrop-ia.com` em todos os compose files, scripts e docs
- Adicionados meta tags SEO no `index.html` (canonical, OG, Twitter Card)
- Criados `manifest.json`, `robots.txt`, `public/sounds/` (placeholder)
- Fix de CORS: `accesscontrolalloworiginlist` agora inclui `https://`

### 4.2 Deploy em producao
- Image Docker construida (`antropia-desk:frontend`)
- Stack `antropia-desk` deployada via `docker-compose.traefik.yml`
- Certificado SSL emitido pelo Lets Encrypt apos remover `desk-status.antrop-ia.com` do router (DNS faltando estava bloqueando emissao)
- `.env` criado com publishable key do Supabase (NAO commitado, `.gitignore` ok)

### 4.3 Limpeza de mocks/seed data
- `src/utils/templateUtils.ts`: substituidos nomes ficticios por dados genericos
- `src/stores/useSettingsStore.tsx`: removidos defaults de SMTP fake e logos externos
- `src/stores/useStatusPageStore.tsx`: som de alerta agora local (`/sounds/alert.ogg`)
- `src/components/ticket/TicketTimeline.tsx`: imagem placeholder local
- Removido seed de categorias hardcoded (`Bug`, `Financeiro`, etc.) de `20260202140000_create_ticket_categories.sql`
- Removido seed de service plans Meta Ads/Google Ads de `20260211120000_create_service_plans.sql`
- **Deletados do banco** todos os service_plan_categories, user_service_plans, service_plans e ticket_categories de organizacoes antigas
- Removidas organizacoes antigas — so ficou Antrop-IA

### 4.4 Branding (logo + favicon)
- `public/antropia-logo.svg` → usado nas telas de Login, ForgotPassword, ResetPassword
- `public/favicon.svg` → favicon do site (corrigido para `width="32"`, cache-bust `?v=3`)
- `public/favicon.ico`, `favicon-16.png`, `favicon-32.png` gerados (mas geracao via ImageMagick ficou falha — paths complexos do SVG nao renderizaram bem; ver §8)

### 4.5 Admin user
- Criado via Supabase Admin API
- Email confirmado, organizacao Antrop-IA criada, membership ADMIN inserida

---

## 5. Mudancas pendentes em git (resumo)

**Staged for deletion** (5 compose files legacy a serem removidos):
```
docker-compose.app.yml
docker-compose.fixed.yml
docker-compose.quick.yml
docker-compose.simple.yml
docker-compose.traefik.yml
```

> **CUIDADO**: o `docker-compose.traefik.yml` foi marcado para delecao mas e o atualmente em uso em producao. Se commitar a delecao, manter copia ou usar `docker-compose.prod.yml` no proximo deploy.

**Modificados (20)**: Dockerfile, docker-compose.prod.yml, docker/docker-entrypoint.sh, docker/nginx.conf, index.html, package-lock.json, public/favicon.ico, src/pages/auth/{Login,ForgotPassword,ResetPassword}.tsx, src/stores/{useSettingsStore,useStatusPageStore}.tsx, src/components/ticket/TicketTimeline.tsx, src/utils/templateUtils.ts, supabase/functions/_shared/auth.ts, supabase/migrations/{20260202140000,20260211120000}.sql, OPERATIONS.md, docs/DOCKER_DEPLOY.md, scripts/auto-deploy.sh, one-click-setup.sh

**Untracked (8)**: public/antropia-logo.svg, public/favicon.svg, public/favicon-16.png, public/favicon-32.png, public/manifest.json, public/robots.txt, public/sounds/, scripts/backup-supabase.sh

---

## 6. Pendencias antes de "100% producao"

### Bloqueantes para uso real
- [ ] **Admin precisa configurar pela UI**: branding (logo da organizacao), SMTP, canais de notificacao (WhatsApp/Email), service plans, categorias de ticket
- [ ] **Trocar a senha do admin** (`Antrop1a` foi senha inicial, deve ser alterada)
- [ ] **Decidir destino dos compose files marcados para delecao** — `traefik.yml` esta em uso

### Recomendado
- [ ] Criar DNS A record para `desk-status.antrop-ia.com` se for usar status page (e re-adicionar ao router)
- [ ] Resolver issue do favicon nao aparecer no browser (ver §8)
- [ ] Migrar de `docker-compose.traefik.yml` (rede `minha_rede`) para `docker-compose.prod.yml` (rede `traefik-public`) se quiser stack standalone com proprio Traefik
- [ ] Configurar backups agendados do Supabase (`scripts/backup-supabase.sh` ja existe untracked)
- [ ] Commitar as mudancas e fazer push para o repo `vitorbb1989/antropia-desk-bgd1zo9rq`

### Opcional/longo prazo
- [ ] Configurar Sentry (DSN ja preparado no `.env`)
- [ ] Configurar Slack webhook para alerts
- [ ] Habilitar Prometheus + Grafana (profile `monitoring` no `docker-compose.prod.yml`)

---

## 7. Como operar (cheatsheet)

### Verificar saude
```bash
docker stack services antropia-desk
docker stack ps antropia-desk --no-trunc
curl -sI https://desk.antrop-ia.com
```

### Logs
```bash
docker service logs antropia-desk_antropia-desk --tail 50 --follow
docker exec $(docker ps -q -f "name=traefik") cat /var/log/traefik/traefik.log | grep desk
```

### Rebuild + redeploy (com env vars)
```bash
cd /root/antropia-desk-bgd1zo9rq
docker build --target production \
  --build-arg VITE_SUPABASE_URL=https://wevgxuxaplcmrnsktoud.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_hkHkjYB96Iv0hPS8L4Zqjg_yRuELKvx \
  -t antropia-desk:frontend -t antropia-desk:latest .

docker service update --image antropia-desk:frontend --force antropia-desk_antropia-desk
```

### Re-deploy do zero
```bash
docker stack rm antropia-desk
sleep 5
VITE_SUPABASE_URL=https://wevgxuxaplcmrnsktoud.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_hkHkjYB96Iv0hPS8L4Zqjg_yRuELKvx \
  docker stack deploy -c docker-compose.traefik.yml antropia-desk
```

### Rollback rapido
```bash
docker service rollback antropia-desk_antropia-desk
```

---

## 8. Issues conhecidos

### Favicon nao aparece no browser
- **Sintoma**: usuario reportou que o favicon nao aparece, mesmo apos hard refresh
- **Estado servido**: `https://desk.antrop-ia.com/favicon.svg` retorna `200` com `image/svg+xml` correto
- **Provaveis causas**:
  1. Cache muito agressivo do browser/proxy intermediario
  2. SVG complexo (com paths sem `fill` em alguns nodes) que browser nao renderiza em 16x16/32x32
  3. CSP ou outro header bloqueando
- **Tentado**: cache-bust `?v=3`, ajuste de `width/height` para `32x32`
- **Proximas acoes possiveis**:
  - Gerar `favicon.ico` correto (a tentativa via ImageMagick gerou PNGs de 416 bytes — provavelmente cinza/transparente, instalar `librsvg2-bin` para `rsvg-convert` ou usar ferramenta online)
  - Simplificar o SVG (combinar paths, remover atributos desnecessarios)
  - Apontar `<link rel="icon">` apenas para `.ico` ate validar SVG

### `desk-status.antrop-ia.com` sem DNS
- Removido do router Traefik para nao bloquear emissao SSL de `desk.antrop-ia.com`
- Para restaurar: criar DNS A record + re-adicionar ao `Host(...)` do router em `docker-compose.traefik.yml`

### Container reiniciou varias vezes nas ultimas 8h
- Last task: 28 minutos atras (ok, rodando)
- Restarts anteriores foram durante os deploys/builds desta sessao — nao indica problema recorrente

---

## 9. Acessos rapidos

| Recurso | URL / Comando |
|---|---|
| App | https://desk.antrop-ia.com |
| Login admin | `admin@antrop-ia.com` / `Antrop1a` |
| Supabase dashboard | https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud |
| Repo Git | https://github.com/vitorbb1989/antropia-desk-bgd1zo9rq |
| Servidor | `185.182.184.175` (este host, `oneserver`) |
| Traefik dashboard | nao exposto publicamente neste deploy |
| Working dir | `/root/antropia-desk-bgd1zo9rq` |

---

## 10. Arquivos-chave para reler

Quando voltar ao projeto, comece por:

1. **`claude.md`** — guia de troubleshooting do projeto (15 KB, ja existia)
2. **`OPERATIONS.md`** — comandos make, monitoramento, backup
3. **`INSTALLATION.md`** — referencia caso precise reinstalar
4. **`docker-compose.traefik.yml`** — compose atualmente deployado
5. **`.env`** — credenciais reais (NAO no git)
6. **`supabase/migrations/`** — schema completo do banco
