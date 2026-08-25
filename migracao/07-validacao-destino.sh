#!/usr/bin/env bash
# Valida o projeto de destino sem alterar dados de produção.
# Uso:
#   export DST_URL=https://sshyjnyvihdheofjzsca.supabase.co
#   export DST_SERVICE_KEY=...      # service role do DESTINO (nunca comitar)
#   export DST_ANON_KEY=...         # chave publicável do DESTINO
#   bash migracao/07-validacao-destino.sh
set -uo pipefail

DST_URL="${DST_URL:-https://sshyjnyvihdheofjzsca.supabase.co}"
: "${DST_SERVICE_KEY:?defina DST_SERVICE_KEY}"
DST_ANON_KEY="${DST_ANON_KEY:-}"

PASS=0; FAIL=0
chk() { # nome, esperado, código
  if [ "$2" = "$3" ]; then echo "OK    [$3] $1"; PASS=$((PASS+1));
  else echo "FALHA [$3, esperado $2] $1"; FAIL=$((FAIL+1)); fi
}
svc() { curl -s -o /tmp/_v -w "%{http_code}" -H "apikey: $DST_SERVICE_KEY" -H "Authorization: Bearer $DST_SERVICE_KEY" "$@"; }
anon() { curl -s -o /tmp/_v -w "%{http_code}" -H "apikey: $DST_ANON_KEY" -H "Authorization: Bearer $DST_ANON_KEY" "$@"; }

echo "=== REST / PostgREST"
chk "REST root" 200 "$(svc "$DST_URL/rest/v1/")"
chk "leitura tasks (service)" 200 "$(svc "$DST_URL/rest/v1/tasks?select=id&limit=1")"

echo "=== Auth Admin API"
chk "listar usuários" 200 "$(svc "$DST_URL/auth/v1/admin/users?per_page=1")"

echo "=== Storage"
chk "buckets" 200 "$(svc "$DST_URL/storage/v1/bucket")"
grep -q '"id":"lost-items"' /tmp/_v && echo "OK    bucket lost-items presente" || { echo "FALHA bucket lost-items"; FAIL=$((FAIL+1)); }

echo "=== RPCs públicas"
chk "get_public_reservations" 200 "$(svc -X POST -H 'Content-Type: application/json' \
  -d '{"p_start":"2020-01-01T00:00:00Z","p_end":"2020-01-02T00:00:00Z"}' "$DST_URL/rest/v1/rpc/get_public_reservations")"

echo "=== Edge Functions (esperado 200/400/401 quando publicadas; 404 = não publicada)"
for fn in get-classroom-call-config create-classroom-call notify-task-assignment process-recurring-tasks \
          create-user delete-user reset-password update-user-email setup-first-admin generate-pdf \
          migrate-all-images migrate-lost-item-image; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DST_SERVICE_KEY" -d '{}' "$DST_URL/functions/v1/$fn")
  if [ "$code" = "404" ]; then echo "FALHA [404] $fn não publicada"; FAIL=$((FAIL+1));
  else echo "OK    [$code] $fn publicada"; PASS=$((PASS+1)); fi
done

if [ -n "$DST_ANON_KEY" ]; then
  echo "=== RLS com chave pública (anon)"
  code=$(anon "$DST_URL/rest/v1/tasks?select=id&limit=1")
  if [ "$code" = "200" ] && [ "$(cat /tmp/_v)" = "[]" ]; then echo "OK    anon não lê tasks (RLS ativa)"; PASS=$((PASS+1));
  elif [ "$code" = "401" ] || [ "$code" = "403" ]; then echo "OK    anon bloqueado em tasks"; PASS=$((PASS+1));
  else echo "FALHA anon conseguiu ler tasks"; FAIL=$((FAIL+1)); fi
  chk "anon RPC get_public_reservations" 200 "$(anon -X POST -H 'Content-Type: application/json' \
    -d '{"p_start":"2020-01-01T00:00:00Z","p_end":"2020-01-02T00:00:00Z"}' "$DST_URL/rest/v1/rpc/get_public_reservations")"
else
  echo "(pulei os testes anon: defina DST_ANON_KEY)"
fi

echo
echo "===== RESUMO: $PASS OK / $FAIL falhas ====="
[ "$FAIL" -eq 0 ]
