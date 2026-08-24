#!/usr/bin/env bash
# Restaura os dumps no projeto Supabase de destino (sua conta)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/dump"

: "${DST_DB_URL:?defina DST_DB_URL (veja migracao/README.md)}"

run() {
  echo "==> $1"
  psql "$DST_DB_URL" -v ON_ERROR_STOP=0 -f "$OUT/$1"
}

echo "### Extensões necessárias"
psql "$DST_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_cron;
create extension if not exists pg_net;
SQL

echo "### Estrutura (tabelas, enums, funções, triggers, RLS, GRANTs)"
run 02_public_schema_com_grants.sql

echo "### Usuários da autenticação (mantém os mesmos UUIDs)"
run 04_auth_data.sql

echo "### Dados do schema public"
run 03_public_data.sql

echo "### Metadados de storage (buckets e registros de objetos)"
run 05_storage_meta.sql

echo
echo "Import concluído. Rode 'node migracao/06-verify.mjs' para conferir as contagens."
echo "Erros de 'already exists' nas extensões/roles do Supabase são esperados e podem ser ignorados."
