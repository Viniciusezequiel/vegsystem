#!/usr/bin/env bash
# SINCRONIZAÇÃO INCREMENTAL FINAL — NÃO RODAR ANTES DA JANELA DE VIRADA.
#
# Copia da ORIGEM para o DESTINO apenas os registros criados/alterados após o
# corte da clonagem inicial (2026-08-25 16:45 UTC), usando UPSERT por id.
# Requer confirmação explícita:
#   CONFIRMO_SINCRONIZACAO=SIM bash migracao/08-sincronizacao-final.sh
#
# Variáveis necessárias:
#   SRC_URL, SRC_SERVICE_KEY   (backend atual)
#   DST_URL, DST_SERVICE_KEY   (destino)
#   CORTE                       (default abaixo)
set -euo pipefail

[ "${CONFIRMO_SINCRONIZACAO:-}" = "SIM" ] || {
  echo "Bloqueado: rode com CONFIRMO_SINCRONIZACAO=SIM apenas na janela de virada."; exit 1; }

: "${SRC_URL:?}"; : "${SRC_SERVICE_KEY:?}"; : "${DST_URL:?}"; : "${DST_SERVICE_KEY:?}"
CORTE="${CORTE:-2026-08-25T16:45:00Z}"

python3 - "$SRC_URL" "$SRC_SERVICE_KEY" "$DST_URL" "$DST_SERVICE_KEY" "$CORTE" <<'PY'
import json, sys, urllib.request

SRC, SKEY, DST, DKEY, CORTE = sys.argv[1:6]

# Tabelas em ordem de dependência (pais antes de filhos).
TABLES = [
 "profiles","user_roles","role_permissions","app_settings","activity_logs",
 "rooms","reservation_rooms","room_combinations","classroom_call_rooms","classroom_call_room_issues",
 "classroom_calls","classroom_call_responses","external_users","reservations","reservation_logs",
 "reservation_reschedulings","equipment","equipment_loans","equipment_reservations",
 "external_equipment_requests","inventory_movements","lockers","locker_loans","locker_exchanges",
 "lost_items","lost_items_archive","material_requests","tasks","task_team_members","task_comments",
 "task_history","checklist_questions","room_checklists","checklist_answers","shift_handovers",
 "shift_handover_tasks","shift_handover_incidents","semester_competencies","semester_checklists",
 "semester_checklist_items","semester_furniture_details","semester_projectors","semester_item_options",
 "semester_labels","uber_requests","ps_campuses","ps_campus_floors","ps_roles","ps_collaborators",
 "ps_events","ps_event_collaborators","ps_candidates","ps_evaluations","ps_general_evaluations",
 "ps_self_evaluations","ps_evaluation_retifications","ps_fiscal_bank_config","ps_fiscal_bank_applications",
]

def req(url, key, method="GET", body=None, extra=None):
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    h.update(extra or {})
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(r) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else []

total = 0
for t in TABLES:
    try:
        rows = req(f"{SRC}/rest/v1/{t}?select=*&or=(created_at.gte.{CORTE},updated_at.gte.{CORTE})&limit=50000", SKEY)
    except Exception:
        # tabela sem created_at/updated_at: copia tudo por upsert (idempotente)
        try:
            rows = req(f"{SRC}/rest/v1/{t}?select=*&limit=50000", SKEY)
        except Exception as e:
            print(f"{t}: ERRO leitura {e}"); continue
    if not rows:
        print(f"{t}: 0"); continue
    for i in range(0, len(rows), 200):
        req(f"{DST}/rest/v1/{t}", DKEY, "POST", rows[i:i+200],
            {"Prefer": "resolution=merge-duplicates,return=minimal"})
    total += len(rows)
    print(f"{t}: {len(rows)} sincronizados")
print("TOTAL:", total)
PY

echo "Sincronização incremental concluída. Rode: bash migracao/09-validacao-pos-sincronizacao.sh"
