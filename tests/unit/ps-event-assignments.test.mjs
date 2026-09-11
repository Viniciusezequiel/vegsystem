import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePsJourneyKey, stripPsJourneyFromRoleLabel, resolvePsRoleRate, inferPsJourneyFromPay,
  psAssignmentsTotal, buildLegacyAssignment, hydratePsAssignmentSnapshot,
} from '../../src/lib/psEventAssignments.mjs';

test('normaliza jornadas aceitas', () => {
  assert.equal(normalizePsJourneyKey('8h'), '8h');
  assert.equal(normalizePsJourneyKey('08h'), '8h');
  assert.equal(normalizePsJourneyKey('Fiscal Líder de Sala (08h)'), '8h');
  assert.equal(normalizePsJourneyKey('8 horas'), '8h');
  assert.equal(normalizePsJourneyKey('Horário integral'), 'integral');
  assert.equal(normalizePsJourneyKey('10h'), null);
});

test('remove jornada do rótulo do cargo sem alterar o nome', () => {
  assert.equal(stripPsJourneyFromRoleLabel('FISCAL LÍDER DE SALA (08h)'), 'FISCAL LÍDER DE SALA');
  assert.equal(stripPsJourneyFromRoleLabel('Médico(a) - Horário integral'), 'Médico(a)');
});

test('resolve valor por faixa e infere jornada pelo snapshot', () => {
  const role = { pay_value_4h: 170, pay_value_8h: 300, pay_value_integral: 450 };
  assert.equal(resolvePsRoleRate(role, '4h'), 170);
  assert.equal(resolvePsRoleRate(role, '8h'), 300);
  assert.equal(inferPsJourneyFromPay(role, 300), '8h');
  assert.equal(inferPsJourneyFromPay(role, 999), null);
});

test('resolve tabela do Setor Especial sem alterar a tabela padrão', () => {
  const role = {
    pay_value_4h: 200,
    pay_value_8h: 321,
    pay_value_special_4h: 240,
    pay_value_special_8h: 352,
  };
  assert.equal(resolvePsRoleRate(role, '4h'), 200);
  assert.equal(resolvePsRoleRate(role, '4h', true), 240);
  assert.equal(resolvePsRoleRate(role, '8h', true), 352);
  assert.equal(resolvePsRoleRate(role, 'integral', true), null);
  assert.equal(inferPsJourneyFromPay(role, 352), '8h');
});

test('soma múltiplas atribuições sem arredondamento textual', () => {
  assert.equal(psAssignmentsTotal([{ pay_value: 170 }, { pay_value: 90.5 }]), 260.5);
});

test('legado usa role_value existente ou resolve por nome', () => {
  const roles = [{ value: 'fiscal_sala', name: 'Fiscal de Sala', pay_value_8h: 300 }];
  const item = buildLegacyAssignment({ role_name: 'Fiscal de Sala', pay_value: 300, work_schedule: '08:00-17:00' }, roles);
  assert.equal(item.role_value, 'fiscal_sala');
  assert.equal(item.journey_key, '8h');
  assert.equal(item.pay_value, 300);
});

test('legado importado com cargo e jornada no mesmo texto preenche o editor', () => {
  const roles = [{ value: 'fiscal_lider_de_sala', name: 'Fiscal Líder de Sala', pay_value_8h: 321 }];
  const item = buildLegacyAssignment({
    role_name: 'FISCAL LÍDER DE SALA (08h)',
    assigned_role: 'FISCAL LÍDER DE SALA (08h)',
    pay_value: 321,
  }, roles);

  assert.equal(item.role_value, 'fiscal_lider_de_sala');
  assert.equal(item.role_name, 'Fiscal Líder de Sala');
  assert.equal(item.journey_key, '8h');
  assert.equal(item.pay_value, 321);
});

test('atribuição já criada herda cargo e jornada do vínculo importado quando vier incompleta', () => {
  const roles = [{ value: 'fiscal_lider_de_sala', name: 'Fiscal Líder de Sala', pay_value_8h: 321 }];
  const item = hydratePsAssignmentSnapshot(
    { id: 'a1', role_value: null, role_name: 'FISCAL LÍDER DE SALA (08h)', journey_key: null, pay_value: 321 },
    { role_name: 'FISCAL LÍDER DE SALA (08h)', assigned_role: 'FISCAL LÍDER DE SALA (08h)', pay_value: 321, building: 'Prédio - FACE II' },
    roles,
  );

  assert.equal(item.role_value, 'fiscal_lider_de_sala');
  assert.equal(item.role_name, 'Fiscal Líder de Sala');
  assert.equal(item.journey_key, '8h');
  assert.equal(item.pay_value, 321);
});
