import { supabase } from '@/integrations/supabase/client';

/**
 * Registro automático de atividades para TODOS os módulos.
 *
 * Intercepta as operações de escrita (insert/update/delete/upsert) do cliente
 * e grava um registro em `activity_logs`, do mesmo jeito que o módulo de
 * Achados e Perdidos já fazia manualmente.
 */

type Meta = { module: string; label: string };

const TABLE_MAP: Record<string, Meta> = {
  lost_items: { module: 'lost-items', label: 'Item de achados e perdidos' },
  lost_items_archive: { module: 'lost-items', label: 'Item arquivado' },
  tasks: { module: 'tasks', label: 'Demanda' },
  task_comments: { module: 'tasks', label: 'Comentário da demanda' },
  task_team_members: { module: 'tasks', label: 'Equipe da demanda' },
  equipment: { module: 'equipment', label: 'Patrimônio' },
  equipment_loans: { module: 'equipment', label: 'Empréstimo de equipamento' },
  equipment_reservations: { module: 'equipment', label: 'Pré-reserva de equipamento' },
  inventory_movements: { module: 'equipment', label: 'Movimentação de estoque' },
  lockers: { module: 'lockers', label: 'Escaninho' },
  locker_loans: { module: 'lockers', label: 'Alocação de escaninho' },
  locker_exchanges: { module: 'lockers', label: 'Troca de escaninho' },
  material_requests: { module: 'materials', label: 'Solicitação de material' },
  reservations: { module: 'reservations', label: 'Reserva de sala' },
  reservation_rooms: { module: 'reservations', label: 'Sala para reserva' },
  reservation_reschedulings: { module: 'reservations', label: 'Remarcação de reserva' },
  room_combinations: { module: 'reservations', label: 'Combinação de salas' },
  rooms: { module: 'rooms', label: 'Sala' },
  room_checklists: { module: 'rooms', label: 'Checklist de sala' },
  checklist_questions: { module: 'rooms', label: 'Pergunta de checklist' },
  shift_handovers: { module: 'rooms', label: 'Passagem de plantão' },
  semester_checklists: { module: 'semester', label: 'Checklist semestral' },
  semester_checklist_items: { module: 'semester', label: 'Item do checklist semestral' },
  semester_competencies: { module: 'semester', label: 'Competência semestral' },
  semester_projectors: { module: 'semester', label: 'Projetor' },
  semester_furniture_details: { module: 'semester', label: 'Mobiliário' },
  semester_item_options: { module: 'semester', label: 'Opção de item' },
  classroom_calls: { module: 'classroom-calls', label: 'Chamado de sala' },
  classroom_call_rooms: { module: 'classroom-calls', label: 'Sala de chamados' },
  classroom_call_room_issues: { module: 'classroom-calls', label: 'Problema de sala' },
  classroom_call_responses: { module: 'classroom-calls', label: 'Resposta de chamado' },
  uber_requests: { module: 'uber', label: 'Solicitação de Uber' },
  label_templates: { module: 'labels', label: 'Modelo de etiqueta' },
  ps_events: { module: 'processo-seletivo', label: 'Evento de processo seletivo' },
  ps_collaborators: { module: 'processo-seletivo', label: 'Colaborador' },
  ps_event_collaborators: { module: 'processo-seletivo', label: 'Equipe do evento' },
  ps_evaluations: { module: 'processo-seletivo', label: 'Avaliação' },
  ps_candidates: { module: 'processo-seletivo', label: 'Candidato' },
  ps_roles: { module: 'processo-seletivo', label: 'Cargo' },
  profiles: { module: 'users', label: 'Usuário' },
  user_roles: { module: 'users', label: 'Permissão de usuário' },
  external_users: { module: 'users', label: 'Cliente externo' },
  role_permissions: { module: 'settings', label: 'Permissão de perfil' },
  app_settings: { module: 'settings', label: 'Configuração do sistema' },
};

const ACTION_MAP: Record<string, string> = {
  insert: 'create',
  upsert: 'update',
  update: 'update',
  delete: 'delete',
};

const NAME_KEYS = [
  'title', 'name', 'full_name', 'item_name', 'equipment_name', 'collaborator_name',
  'description', 'code', 'requester_name', 'borrower_name', 'room_name', 'email',
];

function describe(payload: unknown, fallback: string): string {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (row && typeof row === 'object') {
    for (const key of NAME_KEYS) {
      const value = (row as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
    }
  }
  const count = Array.isArray(payload) ? payload.length : 1;
  return count > 1 ? `${fallback} (${count} registros)` : fallback;
}

let cachedUser: { id: string | null; name: string } | null = null;

async function currentUser() {
  if (cachedUser) return cachedUser;
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return { id: null, name: 'Sistema' };
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    cachedUser = {
      id: user.id,
      name: profile?.full_name || profile?.email || user.email || 'Usuário',
    };
    return cachedUser;
  } catch {
    return { id: null, name: 'Sistema' };
  }
}

supabase.auth.onAuthStateChange(() => {
  cachedUser = null;
});

async function writeLog(table: string, op: string, payload: unknown, result: any) {
  const meta = TABLE_MAP[table];
  if (!meta) return;
  const user = await currentUser();
  if (!user.id) return; // apenas ações autenticadas geram histórico

  const rows = Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : [];
  const entityId = rows[0]?.id ? String(rows[0].id) : null;

  try {
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: user.name,
      module: meta.module,
      action: ACTION_MAP[op] || op,
      entity_id: entityId,
      entity_description: describe(rows.length ? rows : payload, meta.label),
      details: `${meta.label} · tabela ${table}`,
    });
  } catch {
    /* logging nunca deve quebrar a aplicação */
  }
}

let installed = false;

export function installActivityAutoLog() {
  if (installed) return;
  installed = true;

  const client = supabase as any;
  const originalFrom = client.from.bind(client);

  client.from = (table: string) => {
    const builder = originalFrom(table);
    if (!TABLE_MAP[table]) return builder;

    (['insert', 'update', 'delete', 'upsert'] as const).forEach((op) => {
      const original = builder[op];
      if (typeof original !== 'function') return;
      builder[op] = (...args: any[]) => {
        const query: any = original.apply(builder, args);
        if (!query || typeof query.then !== 'function') return query;
        const originalThen = query.then.bind(query);
        query.then = (onFulfilled: any, onRejected: any) =>
          originalThen((res: any) => {
            if (res && !res.error) void writeLog(table, op, args[0], res);
            return onFulfilled ? onFulfilled(res) : res;
          }, onRejected);
        return query;
      };
    });

    return builder;
  };
}
