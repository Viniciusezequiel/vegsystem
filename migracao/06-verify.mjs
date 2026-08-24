// Compara a contagem de linhas de cada tabela entre origem e destino.
// Uso: source migracao/.env.migracao && node migracao/06-verify.mjs
import { createClient } from "@supabase/supabase-js";

const { SRC_URL, SRC_SERVICE_KEY, DST_URL, DST_SERVICE_KEY } = process.env;
for (const [k, v] of Object.entries({ SRC_URL, SRC_SERVICE_KEY, DST_URL, DST_SERVICE_KEY })) {
  if (!v) {
    console.error(`Variável ${k} não definida. Veja migracao/README.md`);
    process.exit(1);
  }
}

const TABLES = [
  "activity_logs", "app_settings", "checklist_answers", "checklist_questions",
  "classroom_call_responses", "classroom_call_room_issues", "classroom_call_rooms",
  "classroom_calls", "equipment", "equipment_loans", "equipment_reservations",
  "external_equipment_requests", "external_users", "inventory_movements",
  "locker_exchanges", "locker_loans", "lockers", "lost_items", "lost_items_archive",
  "material_requests", "profiles", "ps_campus_floors", "ps_campuses", "ps_candidates",
  "ps_collaborators", "ps_evaluation_retifications", "ps_evaluations",
  "ps_event_collaborators", "ps_events", "ps_fiscal_bank_applications",
  "ps_fiscal_bank_config", "ps_general_evaluations", "ps_roles", "ps_self_evaluations",
  "reservation_logs", "reservation_reschedulings", "reservation_rooms", "reservations",
  "role_permissions", "room_checklists", "room_combinations", "rooms",
  "semester_checklist_items", "semester_checklists", "semester_competencies",
  "semester_furniture_details", "semester_item_options", "semester_labels",
  "semester_projectors", "shift_handover_incidents", "shift_handover_tasks",
  "shift_handovers", "task_comments", "task_history", "task_team_members", "tasks",
  "uber_requests", "user_roles",
];

const src = createClient(SRC_URL, SRC_SERVICE_KEY, { auth: { persistSession: false } });
const dst = createClient(DST_URL, DST_SERVICE_KEY, { auth: { persistSession: false } });

const count = async (client, table) => {
  const { count: c, error } = await client.from(table).select("*", { count: "exact", head: true });
  return error ? `erro: ${error.message}` : c;
};

let divergentes = 0;
console.log("tabela".padEnd(34), "origem".padStart(9), "destino".padStart(9), "  status");
for (const table of TABLES) {
  const [a, b] = await Promise.all([count(src, table), count(dst, table)]);
  const ok = a === b;
  if (!ok) divergentes += 1;
  console.log(
    table.padEnd(34),
    String(a).padStart(9),
    String(b).padStart(9),
    ok ? "  OK" : "  DIVERGENTE",
  );
}

console.log(`\n${divergentes === 0 ? "Todas as tabelas conferem." : `${divergentes} tabela(s) divergente(s) — reveja antes de desligar o Cloud.`}`);
