#!/usr/bin/env bash
# Publica SOMENTE as Edge Functions definitivas no projeto de destino.
# Uso:  supabase login   &&   bash migracao/04-deploy-functions.sh
set -euo pipefail

DST_REF="${DST_REF:-sshyjnyvihdheofjzsca}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Funções definitivas (as export-*-migracao são temporárias e NÃO entram)
FUNCTIONS=(
  create-classroom-call
  create-user
  delete-user
  generate-pdf
  get-classroom-call-config
  migrate-all-images
  migrate-lost-item-image
  notify-task-assignment
  process-recurring-tasks
  reset-password
  setup-first-admin
  update-user-email
)

echo "== 1/4 Validando Supabase CLI"
command -v supabase >/dev/null 2>&1 || { echo "ERRO: Supabase CLI não encontrado. Instale: https://supabase.com/docs/guides/cli"; exit 1; }
supabase --version

echo "== 2/4 Validando autenticação"
if ! supabase projects list >/dev/null 2>&1; then
  echo "ERRO: não autenticado. Rode 'supabase login' e tente novamente."; exit 1
fi

echo "== 3/4 Validando project ref '$DST_REF'"
if ! supabase projects list | grep -q "$DST_REF"; then
  echo "ERRO: o project ref '$DST_REF' não aparece na sua conta."; exit 1
fi

for fn in "${FUNCTIONS[@]}"; do
  [ -f "supabase/functions/$fn/index.ts" ] || { echo "ERRO: supabase/functions/$fn/index.ts não existe"; exit 1; }
done

echo "== 4/4 Deploy (${#FUNCTIONS[@]} funções)"
OK=(); FAIL=()
for fn in "${FUNCTIONS[@]}"; do
  echo "---- deploy $fn"
  if supabase functions deploy "$fn" --project-ref "$DST_REF"; then
    OK+=("$fn")
  else
    FAIL+=("$fn")
    echo "ERRO no deploy de $fn — interrompendo."
    break
  fi
done

echo
echo "===== RESULTADO ====="
for f in "${OK[@]:-}";   do [ -n "$f" ] && echo "OK       $f"; done
for f in "${FAIL[@]:-}"; do [ -n "$f" ] && echo "FALHOU   $f"; done
[ ${#FAIL[@]} -eq 0 ] || exit 1

echo
echo "Deploy concluído. verify_jwt=false vem de supabase/config.toml para:"
echo "  setup-first-admin, create-classroom-call, update-user-email, get-classroom-call-config, notify-task-assignment"
echo "Próximo passo: bash migracao/06-configure-secrets.sh"
