#!/usr/bin/env bash
# Verifica pré-requisitos antes de iniciar a migração.
# Uso: source migracao/.env.migracao && bash migracao/00-preflight.sh
set -uo pipefail

FAIL=0

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "  OK        $1 ($($1 --version 2>&1 | head -n1))"
  else
    echo "  FALTANDO  $1 — $2"
    FAIL=1
  fi
}

echo "### Ferramentas"
check_cmd pg_dump "instale o PostgreSQL client 15+"
check_cmd psql "instale o PostgreSQL client 15+"
check_cmd node "instale o Node 18+"
check_cmd supabase "instale a Supabase CLI (https://supabase.com/docs/guides/cli)"

echo
echo "### Variáveis de ambiente"
for v in SRC_DB_URL SRC_URL SRC_SERVICE_KEY DST_DB_URL DST_URL DST_SERVICE_KEY DST_REF; do
  if [ -n "${!v:-}" ]; then
    echo "  OK        $v definida"
  else
    echo "  FALTANDO  $v — veja migracao/README.md"
    FAIL=1
  fi
done

echo
echo "### Conexão com os bancos"
for v in SRC_DB_URL DST_DB_URL; do
  url="${!v:-}"
  if [ -z "$url" ]; then
    echo "  PULADO    $v não definida"
    continue
  fi
  if psql "$url" -tAc 'select 1' >/dev/null 2>&1; then
    echo "  OK        $v conecta"
  else
    echo "  ERRO      $v não conecta (confira senha/host/porta)"
    FAIL=1
  fi
done

echo
echo "### Versão do servidor de origem x pg_dump local"
if [ -n "${SRC_DB_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  srv=$(psql "$SRC_DB_URL" -tAc 'show server_version' 2>/dev/null | tr -d ' ')
  loc=$(pg_dump --version 2>/dev/null | grep -oE '[0-9]+' | head -n1)
  echo "  servidor: ${srv:-?} | pg_dump local: ${loc:-?}"
  echo "  (o pg_dump local deve ser IGUAL ou MAIOR que a versão do servidor)"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "Preflight OK — pode rodar 'bash migracao/01-export.sh'."
else
  echo "Preflight com pendências — resolva os itens acima antes de continuar."
  exit 1
fi
