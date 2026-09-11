import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePsRoleSpreadsheetRows } from '../../src/lib/psRoleSpreadsheet.mjs';

const rows = [
  ['VALORES PRATICADOS'],
  [],
  [' PAGAMENTO FISCAIS ', null, null, ' PAGAMENTO FISCAIS ', null, null, ' PAGAMENTO FISCAIS ', null, null, ' PAGAMENTO FISCAIS ', null, null, ' PAGAMENTO FISCAIS', null, null, ' PAGAMENTO FISCAIS - SETOR ESPECIAL ', null, null, ' PAGAMENTO FISCAIS', null, null, ' PAGAMENTO FISCAIS - SETOR ESPECIAL '],
  [],
  ['04 Horas', null, null, '06 Horas', null, null, '07 Horas', null, null, '08 Horas', null, null, '09 Horas', null, null, null, null, null, 'HORÁRIO INTEGRAL (MANHÃ E TARDE)', null, null, 'HORÁRIO INTEGRAL (MANHÃ E TARDE)'],
  ['Função','Valor pago',null,'Função','Valor pago',null,'Função','Valor pago',null,'Função','Valor pago',null,'Função','Valor pago',null,'Função','Valor pago',null,'Função','Valor pago',null,'Função','Valor pago'],
  ['ADVOGADO(A)','NA',null,'ADVOGADO(A)',700,null,'ADVOGADO(A)',700,null,'ADVOGADO(A)',700,null,'ADVOGADO(A)',700,null,'ADVOGADO(A)',750,null,'ADVOGADO(A)',1100,null,'ADVOGADO(A)',1150],
  ['FISCAL DE SALA',170,null,'FISCAL DE SALA',220,null,'FISCAL DE SALA',280,null,'FISCAL DE SALA',300,null,'FISCAL DE SALA',320,null,'FISCAL DE SALA','NA',null,'FISCAL DE SALA','NA',null,'FISCAL DE SALA','NA'],
  ['FISCAL LÍDER DE SALA',200,null,'FISCAL LÍDER DE SALA',250,null,'FISCAL LÍDER DE SALA',300,null,'FISCAL LÍDER DE SALA',321,null,'FISCAL LÍDER DE SALA',342,null,'FISCAL LÍDER DE SALA 04H',240,null,'FISCAL LÍDER DE SALA','NA',null,'FISCAL LÍDER DE SALA','NA'],
  [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'FISCAL LÍDER DE SALA 06H',280],
  [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'FISCAL LÍDER DE SALA 07H',330],
  [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'FISCAL LÍDER DE SALA 08H',352],
  [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'FISCAL LÍDER DE SALA 09H',374],
];

test('interpreta setor especial como faixas do mesmo cargo, sem criar cargos duplicados', () => {
  const roles = parsePsRoleSpreadsheetRows(rows);
  assert.equal(roles.length, 3);
  assert.deepEqual(roles.map(role => role.value), ['advogado', 'fiscal_sala', 'fiscal_lider_de_sala']);

  const advogado = roles.find(role => role.value === 'advogado');
  assert.equal(advogado.pay_value_8h, 700);
  assert.equal(advogado.pay_value_integral, 1100);
  assert.equal(advogado.pay_value_special_8h, 750);
  assert.equal(advogado.pay_value_special_integral, 1150);

  const fiscalSala = roles.find(role => role.value === 'fiscal_sala');
  assert.equal(fiscalSala.pay_value_4h, 170);
  assert.equal(fiscalSala.pay_value_special_8h, null);

  const lider = roles.find(role => role.value === 'fiscal_lider_de_sala');
  assert.equal(lider.pay_value_special_4h, 240);
  assert.equal(lider.pay_value_special_6h, 280);
  assert.equal(lider.pay_value_special_7h, 330);
  assert.equal(lider.pay_value_special_8h, 352);
  assert.equal(lider.pay_value_special_9h, 374);
});
