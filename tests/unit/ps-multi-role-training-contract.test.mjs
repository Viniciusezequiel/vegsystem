import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260910124500_ps_multi_roles_and_training.sql'), 'utf8');
const confirmation = fs.readFileSync(path.join(root, 'src/pages/processo-seletivo/public/PsPublicConfirmation.tsx'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/pages/processo-seletivo/PsHome.tsx'), 'utf8');

test('migração cria atribuições filhas e mantém uma principal por vínculo', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ps_event_collaborator_assignments/);
  assert.match(migration, /event_collaborator_id uuid NOT NULL REFERENCES public\.ps_event_collaborators/);
  assert.match(migration, /ps_event_collaborator_assignments_one_primary_idx/);
  assert.match(migration, /INSERT INTO public\.ps_event_collaborator_assignments/);
});

test('resolver cobre cargo legado e sucoordenador', () => {
  assert.match(migration, /ps_resolve_role_value/);
  assert.match(migration, /sucoordenador_a/);
  assert.match(migration, /regexp_replace\(i\.slug\s*,\s*'_a\$'/);
  assert.match(migration, /ps_resolve_role_value\(ec\.role_value\)/);
});

test('fluxo legado sincroniza apenas a atribuição principal', () => {
  assert.match(migration, /ps_sync_primary_assignment_to_event_collaborator/);
  assert.match(migration, /ps_sync_legacy_event_collaborator_to_primary_assignment/);
  assert.match(migration, /pg_trigger_depth\(\)\s*>\s*1/);
  assert.match(migration, /ps_admin_replace_event_collaborator_assignments/);
  assert.doesNotMatch(migration, /assigned_role\s*=\s*v_assignment\.role_name/);
});

test('troca de cargos preserva a linha principal até terminar', () => {
  assert.match(migration, /v_old_secondary_ids uuid\[\]/);
  assert.match(migration, /array_agg\(id\)/);
  assert.match(migration, /v_first AND v_primary_id IS NOT NULL/);
  assert.match(migration, /id\s*=\s*ANY\(v_old_secondary_ids\)/);
});

test('substituição herda cargos secundários', () => {
  assert.match(migration, /NEW\.replacement_for_event_collaborator_id IS NOT NULL/);
  assert.match(migration, /old_a\.is_primary\s*=\s*false/);
});

test('treinamento tem grupos, cargos, datas, capacidade e uma escolha por grupo', () => {
  assert.match(migration, /ps_event_training_groups/);
  assert.match(migration, /ps_event_training_group_roles/);
  assert.match(migration, /ps_event_training_sessions/);
  assert.match(migration, /UNIQUE\s*\(event_collaborator_id\s*,\s*training_group_id\)/);
  assert.match(migration, /training_session_full/);
  assert.match(migration, /training_selection_required/);
});

test('confirmação pública v2 exige treinamento e mantém wrapper legado', () => {
  assert.match(migration, /private\.ps_public_get_event_collaborator_confirmation_v2/);
  assert.match(migration, /private\.ps_public_set_event_collaborator_confirmation_v2/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ps_public_set_event_collaborator_confirmation\(/);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path\s*=\s*''/);
  assert.match(migration, /selected_ts\.active\s*=\s*true/);
  assert.match(confirmation, /ps_public_get_event_collaborator_confirmation_v2/);
  assert.match(confirmation, /ps_public_set_event_collaborator_confirmation_v2/);
  assert.match(confirmation, /missingTraining/);
  assert.match(confirmation, /Escolha do treinamento/);
});

test('novas tabelas usam RLS e não concedem leitura direta ao anon', () => {
  for (const table of ['ps_event_collaborator_assignments','ps_event_training_groups','ps_event_training_group_roles','ps_event_training_sessions','ps_event_training_choices']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.doesNotMatch(migration, new RegExp(`GRANT (?:SELECT|ALL)[^\\n]*${table} TO anon`));
  }
});

test('central mantém sidebar global e expõe os novos fluxos', () => {
  assert.doesNotMatch(home, /Sidebar/);
  assert.match(home, /Central do Processo Seletivo/);
  assert.match(home, /Comunicações/);
  assert.match(home, /Gerar Etiquetas/);
  assert.match(home, /Treinamentos/);
  assert.match(home, /Pagamentos/);
});
