// Utilitários compartilhados pelas funções TEMPORÁRIAS de migração.
// Remover junto com as funções após a virada.
import { createClient } from "npm:@supabase/supabase-js@2";

export const SRC_URL = Deno.env.get("SUPABASE_URL")!;
export const SRC_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const DST_URL = (Deno.env.get("DST_URL") ?? "https://sshyjnyvihdheofjzsca.supabase.co").replace(/\/$/, "");
export const DST_SERVICE_KEY = Deno.env.get("DST_SERVICE_KEY") ?? "";

export function srcClient() {
  return createClient(SRC_URL, SRC_SERVICE_KEY, { auth: { persistSession: false } });
}

export function dstClient() {
  return createClient(DST_URL, DST_SERVICE_KEY, { auth: { persistSession: false } });
}

/** Valida o JWT do chamador e exige papel admin na origem. */
export async function requireAdmin(req: Request): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "Não autenticado" };

  const admin = srcClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, status: 401, error: "Sessão inválida" };

  const { data: isAdmin, error: roleErr } = await admin.rpc("is_admin", { _user_id: userData.user.id });
  if (roleErr) return { ok: false, status: 500, error: roleErr.message };
  if (!isAdmin) return { ok: false, status: 403, error: "Apenas administradores" };

  return { ok: true, userId: userData.user.id };
}

export function requireDstKey(): string | null {
  if (!DST_SERVICE_KEY) return "Segredo DST_SERVICE_KEY não cadastrado no backend";
  return null;
}

/** Ordem de carga respeitando dependências de chave estrangeira. */
export const TABLE_ORDER: string[] = [
  // base / identidade
  "profiles",
  "user_roles",
  "role_permissions",
  "app_settings",
  // catálogos
  "rooms",
  "reservation_rooms",
  "room_combinations",
  "lockers",
  "equipment",
  "checklist_questions",
  "classroom_call_rooms",
  "classroom_call_room_issues",
  "classroom_call_responses",
  "semester_competencies",
  "semester_item_options",
  "ps_campuses",
  "ps_campus_floors",
  "ps_roles",
  "ps_collaborators",
  "ps_events",
  "ps_fiscal_bank_config",
  "external_users",
  // transacionais
  "lost_items",
  "lost_items_archive",
  "equipment_loans",
  "equipment_reservations",
  "inventory_movements",
  "locker_loans",
  "locker_exchanges",
  "material_requests",
  "external_equipment_requests",
  "reservations",
  "reservation_logs",
  "reservation_reschedulings",
  "classroom_calls",
  "room_checklists",
  "checklist_answers",
  "shift_handovers",
  "shift_handover_incidents",
  "shift_handover_tasks",
  "semester_checklists",
  "semester_checklist_items",
  "semester_furniture_details",
  "semester_projectors",
  "semester_labels",
  "tasks",
  "task_team_members",
  "task_comments",
  "task_history",
  "uber_requests",
  "ps_candidates",
  "ps_event_collaborators",
  "ps_evaluations",
  "ps_evaluation_retifications",
  "ps_general_evaluations",
  "ps_self_evaluations",
  "ps_fiscal_bank_applications",
  // por último (volumoso, sem dependentes)
  "activity_logs",
];

/** Tabelas com colunas grandes: páginas menores para não estourar memória. */
export const HEAVY_TABLES = new Set([
  "lost_items",
  "lost_items_archive",
  "ps_event_collaborators",
  "semester_labels",
  "task_comments",
]);

export function pageSizeFor(table: string) {
  return HEAVY_TABLES.has(table) ? 100 : 500;
}

/** Insere linhas no destino via REST, com upsert por chave primária. */
export async function upsertToDestination(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${DST_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: DST_SERVICE_KEY,
      Authorization: `Bearer ${DST_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table}: destino respondeu ${res.status} — ${body.slice(0, 400)}`);
  }
}

/** Conta linhas em uma tabela do destino. */
export async function countAtDestination(table: string): Promise<number | null> {
  const res = await fetch(`${DST_URL}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: DST_SERVICE_KEY,
      Authorization: `Bearer ${DST_SERVICE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  if (!res.ok) return null;
  const range = res.headers.get("content-range");
  if (!range) return null;
  const total = range.split("/")[1];
  return total === "*" ? null : Number(total);
}
