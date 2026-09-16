import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../../supabase/migrations/20260916020500_fix_ps_special_sector_training_role.sql', import.meta.url),
  'utf8',
);

const baseTraining = fs.readFileSync(
  new URL('../../supabase/migrations/20260910124500_ps_multi_roles_and_training.sql', import.meta.url),
  'utf8',
);

test('qualquer função com setor/sala especial resolve para o cargo canônico de treinamento', () => {
  assert.match(migration, /\(setor_especial\|sala_especial\)/);
  assert.match(migration, /THEN 'fiscal_de_sala_especial'/);
  assert.match(migration, /UPDATE public\.ps_event_collaborator_assignments/);
});

test('correção preserva links existentes e o getter público continua dinâmico por assignment', () => {
  assert.doesNotMatch(migration, /public_confirmation_token_hash\s*=/);
  assert.doesNotMatch(migration, /public_confirmation_token_revoked_at\s*=/);
  assert.doesNotMatch(migration, /participation_status\s*=/);
  assert.match(baseTraining, /a\.event_collaborator_id=v_link\.id AND a\.role_value=tgr\.role_value/);
  assert.match(baseTraining, /training_groups/);
});
