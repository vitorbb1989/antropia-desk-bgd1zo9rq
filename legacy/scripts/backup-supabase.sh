#!/bin/bash
# ================================
# Backup Supabase (Postgres) — Antropia Desk
# ================================
# Faz pg_dump do banco do Supabase para um diretório local.
# Redundante ao backup automático do Supabase Pro, e único nivel de backup
# se o projeto estiver em plano Free.
#
# Uso:
#   ./scripts/backup-supabase.sh
#
# Variáveis obrigatórias (em /etc/parrilla-booking/.env ou exportadas):
#   SUPABASE_DB_HOST    ex: db.xxxxx.supabase.co
#   SUPABASE_DB_USER    ex: postgres
#   SUPABASE_DB_PASSWORD
#   SUPABASE_DB_NAME    ex: postgres
#   BACKUP_DIR          ex: /var/backups/antropia-desk (default)
#   RETENTION_DAYS      default 30
#
# Cron sugerido (rodar diário às 02:00):
#   0 2 * * * /opt/antropia-desk/scripts/backup-supabase.sh >> /var/log/antropia-backup.log 2>&1
# ================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Carregar .env do projeto se existir (não sobrescreve env já exportadas)
if [ -f "${PROJECT_ROOT}/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "${PROJECT_ROOT}/.env"
    set +a
fi

# Validar variáveis obrigatórias — falhar rápido com mensagem genérica
: "${SUPABASE_DB_HOST:?SUPABASE_DB_HOST não configurado}"
: "${SUPABASE_DB_USER:?SUPABASE_DB_USER não configurado}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD não configurado}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/antropia-desk}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Verificar se pg_dump existe
if ! command -v pg_dump >/dev/null 2>&1; then
    echo "[$(date -Iseconds)] ERRO: pg_dump não encontrado. Instale postgresql-client."
    exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${BACKUP_DIR}/antropia-desk-${TIMESTAMP}.dump"

echo "[$(date -Iseconds)] Iniciando backup → ${DUMP_FILE}"

# Usar formato custom (-Fc), comprimido. Permite pg_restore seletivo depois.
# PGPASSWORD evita interatividade; -w (no-password) para falhar se algo pedir prompt.
PGPASSWORD="${SUPABASE_DB_PASSWORD}" pg_dump \
    --host="${SUPABASE_DB_HOST}" \
    --port="${SUPABASE_DB_PORT}" \
    --username="${SUPABASE_DB_USER}" \
    --dbname="${SUPABASE_DB_NAME}" \
    --format=custom \
    --no-owner \
    --no-acl \
    --compress=9 \
    --no-password \
    --verbose \
    --file="${DUMP_FILE}" 2> "${DUMP_FILE}.log" || {
        echo "[$(date -Iseconds)] ERRO: pg_dump falhou. Veja ${DUMP_FILE}.log"
        rm -f "${DUMP_FILE}"
        exit 1
    }

# Verificar tamanho mínimo (sanity check — banco vazio ainda dá ~50KB)
SIZE=$(stat -c%s "${DUMP_FILE}" 2>/dev/null || stat -f%z "${DUMP_FILE}")
if [ "${SIZE}" -lt 10000 ]; then
    echo "[$(date -Iseconds)] AVISO: dump suspeito de ser inválido (${SIZE} bytes)"
fi

# Hash para verificar integridade depois
sha256sum "${DUMP_FILE}" > "${DUMP_FILE}.sha256" 2>/dev/null \
    || shasum -a 256 "${DUMP_FILE}" > "${DUMP_FILE}.sha256"

echo "[$(date -Iseconds)] Backup concluído: $(du -h "${DUMP_FILE}" | cut -f1)"

# Limpeza: remover dumps mais velhos que RETENTION_DAYS
find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name "antropia-desk-*.dump" -o -name "antropia-desk-*.dump.log" -o -name "antropia-desk-*.dump.sha256" \) \
    -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] Retenção aplicada (${RETENTION_DAYS} dias). Dumps atuais:"
ls -lh "${BACKUP_DIR}/" | grep "antropia-desk-.*\.dump$" | tail -10

echo "[$(date -Iseconds)] OK"
