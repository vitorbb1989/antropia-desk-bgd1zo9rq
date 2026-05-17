#!/usr/bin/env bash
# ================================
# Backup Supabase (Postgres) → Google Cloud Storage
# Para uso em Cloud Run Job + Cloud Scheduler.
#
# Vars obrigatorias:
#   SUPABASE_DB_URL   Connection string completa (postgresql://...)
#                     Recomendado: usar pooler endpoint do Supabase.
#                     Ler do Secret Manager: --set-secrets=SUPABASE_DB_URL=supabase-db-url:latest
#   GCS_BUCKET        Bucket destino (default: gs://antropia-desk-backups)
#
# Vars opcionais:
#   PREFIX            Prefixo dentro do bucket (default: daily)
#   RETENTION_DAYS    Apos quantos dias remover (default: 30 — complementa lifecycle do bucket)
# ================================

set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL nao definido}"
GCS_BUCKET="${GCS_BUCKET:-gs://antropia-desk-backups}"
PREFIX="${PREFIX:-daily}"

DATE=$(date -u +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/desk-${DATE}.dump"
SHA_FILE="${BACKUP_FILE}.sha256"
GCS_DEST="${GCS_BUCKET}/${PREFIX}/desk-${DATE}.dump"
GCS_DEST_SHA="${GCS_BUCKET}/${PREFIX}/desk-${DATE}.dump.sha256"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

log "Iniciando backup → ${GCS_DEST}"

# pg_dump em formato custom (permite restore seletivo com pg_restore -L)
pg_dump "${SUPABASE_DB_URL}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --compress=9 \
  --file="${BACKUP_FILE}"

# Sanity check (banco vazio ainda da ~50KB)
SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}")
if [ "${SIZE}" -lt 10000 ]; then
  log "AVISO: dump suspeito de ser invalido (${SIZE} bytes) — abortando upload"
  exit 1
fi
log "Dump gerado: ${SIZE} bytes"

# Hash para verificacao de integridade
sha256sum "${BACKUP_FILE}" > "${SHA_FILE}"

# Upload (gcloud storage e mais rapido que gsutil para arquivos pequenos)
gcloud storage cp "${BACKUP_FILE}" "${GCS_DEST}"
gcloud storage cp "${SHA_FILE}" "${GCS_DEST_SHA}"

# Cleanup local
rm -f "${BACKUP_FILE}" "${SHA_FILE}"

log "Upload OK: ${GCS_DEST}"
log "Para restaurar: gcloud storage cp ${GCS_DEST} /tmp/restore.dump && pg_restore -d <STAGING_DB_URL> --clean --if-exists --no-owner --no-acl /tmp/restore.dump"
