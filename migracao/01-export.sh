#!/usr/bin/env bash
# Exporta o banco de origem (Lovable Cloud) para migracao/dump/
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/dump"
mkdir -p "$OUT"

: "${SRC_DB_URL:?defina SRC_DB_URL (veja migracao/README.md)}"

echo "==> 1/4 Estrutura do schema public"
pg_dump "$SRC_DB_URL" \
  --schema=public --schema-only --no-owner --no-privileges --no-comments \
  -f "$OUT/01_public_schema.sql"

echo "==> 2/4 Privilégios (GRANTs / RLS policies vão junto no schema-only acima)"
pg_dump "$SRC_DB_URL" \
  --schema=public --schema-only --no-owner \
  -f "$OUT/02_public_schema_com_grants.sql"

echo "==> 3/4 Dados do schema public"
pg_dump "$SRC_DB_URL" \
  --schema=public --data-only --no-owner --disable-triggers \
  -f "$OUT/03_public_data.sql"

echo "==> 4/4 Autenticação e metadados de storage (preserva usuários e senhas)"
pg_dump "$SRC_DB_URL" \
  --data-only --no-owner \
  --table='auth.users' \
  --table='auth.identities' \
  --table='auth.mfa_factors' \
  --table='auth.mfa_amr_claims' \
  -f "$OUT/04_auth_data.sql"

pg_dump "$SRC_DB_URL" \
  --data-only --no-owner \
  --table='storage.buckets' \
  --table='storage.objects' \
  -f "$OUT/05_storage_meta.sql"

echo
echo "Dumps gerados em: $OUT"
ls -lh "$OUT"
echo
echo "GUARDE ESTA PASTA. Ela é o seu backup completo antes de desligar o Cloud."
