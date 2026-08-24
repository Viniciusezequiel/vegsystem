#!/usr/bin/env bash
# Publica as edge functions no projeto de destino
set -euo pipefail

: "${DST_REF:?defina DST_REF (referência do projeto destino)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

echo "### Login e vínculo com o projeto destino"
supabase link --project-ref "$DST_REF"

echo
echo "### Segredos (rode manualmente com os valores reais antes do deploy)"
cat <<'TXT'
supabase secrets set RESEND_API_KEY=...
supabase secrets set RECURRING_TASKS_CRON_SECRET=...
# SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY são automáticos.
TXT
echo

for fn in "${FUNCTIONS[@]}"; do
  echo "==> deploy $fn"
  supabase functions deploy "$fn" --project-ref "$DST_REF"
done

echo
echo "Deploy concluído. Confira 'supabase/config.toml' para as funções com verify_jwt = false."
