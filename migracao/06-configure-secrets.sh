#!/usr/bin/env bash
# Configura os secrets das Edge Functions no projeto de destino.
# Uso:
#   1) substitua os placeholders abaixo (ou exporte as variáveis no shell)
#   2) supabase login
#   3) bash migracao/06-configure-secrets.sh
#
# NUNCA versione este arquivo com valores reais.
set -euo pipefail

DST_REF="${DST_REF:-sshyjnyvihdheofjzsca}"

# --- Preencha (ou exporte antes de rodar) --------------------------------
RESEND_API_KEY="${RESEND_API_KEY:-COLE_AQUI_RESEND_API_KEY}"
RECURRING_TASKS_CRON_SECRET="${RECURRING_TASKS_CRON_SECRET:-COLE_AQUI_CRON_SECRET}"
# Opcional: protege a função setup-first-admin. Deixe vazio para não configurar.
ADMIN_SETUP_KEY="${ADMIN_SETUP_KEY:-}"
# -------------------------------------------------------------------------

command -v supabase >/dev/null 2>&1 || { echo "ERRO: Supabase CLI não encontrado."; exit 1; }
supabase projects list >/dev/null 2>&1 || { echo "ERRO: rode 'supabase login' primeiro."; exit 1; }

fail_placeholder() { echo "ERRO: o secret $1 ainda está com placeholder. Substitua pelo valor real."; exit 1; }
case "$RESEND_API_KEY" in ""|COLE_AQUI_*) fail_placeholder RESEND_API_KEY;; esac
case "$RECURRING_TASKS_CRON_SECRET" in ""|COLE_AQUI_*) fail_placeholder RECURRING_TASKS_CRON_SECRET;; esac

echo "== Definindo secrets no projeto $DST_REF (valores não são exibidos)"
supabase secrets set \
  RESEND_API_KEY="$RESEND_API_KEY" \
  RECURRING_TASKS_CRON_SECRET="$RECURRING_TASKS_CRON_SECRET" \
  --project-ref "$DST_REF" >/dev/null

if [ -n "$ADMIN_SETUP_KEY" ]; then
  case "$ADMIN_SETUP_KEY" in COLE_AQUI_*) fail_placeholder ADMIN_SETUP_KEY;; esac
  supabase secrets set ADMIN_SETUP_KEY="$ADMIN_SETUP_KEY" --project-ref "$DST_REF" >/dev/null
  echo "ADMIN_SETUP_KEY configurado."
fi

echo
echo "== Secrets presentes (somente nomes):"
supabase secrets list --project-ref "$DST_REF" | awk '{print $1}'

echo
echo "Lembrete: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL"
echo "são injetados automaticamente pelo Supabase — não precisam ser configurados."
