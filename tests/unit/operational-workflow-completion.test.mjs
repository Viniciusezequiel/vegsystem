import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

function load(path) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../src/lib/${path}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports });
  return exports;
}
const storage = load('lostItemStorageSuggestion');
const loans = load('equipmentLoanItems');
const pix = load('psPixPlan');
const plain = value => JSON.parse(JSON.stringify(value));
const config = shelves => ({ campuses: [{ campus: 'central', shelves }] });
const shelf = (code, label, boxes) => ({ code, label, boxes: boxes.map(label => ({ label })) });
const occupancy = (shelf, box, status = 'available') => ({ campus: 'central', shelf, box, box_number: box, status });
function suggest(shelves, items = [], category = 'variados') {
  return storage.getLostItemStorageSuggestion({ storageConfig: config(shelves), campus: 'central', storageCategory: category, occupancy: items });
}
test('Omega3 e embalagens genéricas não são garrafas', () => {
  for (const text of ['Suplemento alimentar Omega 3 Neo Química, frasco azul com rótulo laranja', 'embalagem', 'recipiente']) {
    assert.equal(storage.inferLostItemStorageCategoryFromDescription(text), 'variados');
  }
});
test('descrições determinísticas independem da IA', () => {
  for (const [description, expected] of [['garrafa azul','garrafas_copos'], ['fone preto','eletronicos'], ['power bank','eletronicos'], ['jaleco branco','jalecos_pijamas'], ['pijama','jalecos_pijamas'], ['caneta','material_academico'], ['marmita','vasilhas'], ['necessaire','necessaire_lancheiras'], ['RG','documentos_valores'], ['pipeta','itens_laboratorio']]) {
    assert.equal(storage.inferLostItemStorageCategory('garrafas_copos', description), expected);
  }
});
test('labels compostos preservam todas as categorias', () => {
  for (const label of ['Diversos','Variados','Objetos variados']) assert.deepEqual(plain(storage.resolveCategoryKeys(label)), ['variados']);
  for (const [label, expected] of [
    ['Eletrônicos e pequenos pertences', ['eletronicos','pequenos_pertences']],
    ['Itens de laboratório, Jalecos e pijamas', ['itens_laboratorio','jalecos_pijamas']],
    ['Vasilhas, nécessaires e lancheiras', ['vasilhas','necessaire_lancheiras']],
    ['Copos e Garrafas', ['garrafas_copos']],
  ]) assert.deepEqual(plain(storage.resolveCategoryKeys(label)).sort(), expected.sort());
});
test('shelves 2.1/2.2/2.3 balanceadas somente por available', () => {
  const shelves = ['2.1','2.2','2.3'].map(code => shelf(code, 'Diversos', ['11','12']));
  assert.equal(suggest(shelves, [occupancy('2.1','11'), occupancy('2.2','11'), occupancy('2.3','11','delivered')]).shelfCode, '2.3');
  assert.equal(suggest([...shelves].reverse()).shelfCode, '2.1');
});
test('caixa menos ocupada e empate pelo label', () => {
  const shelves = [shelf('2.1','Diversos',['12','11'])];
  assert.equal(suggest(shelves).boxNumber, '11');
  assert.equal(suggest(shelves, [occupancy('2.1','11')]).boxNumber, '12');
});
test('shelf mista nunca escolhe caixa incompatível', () => {
  const shelves = [shelf('2.1','Eletrônicos e pequenos pertences',['19 - Eletrônicos','20 - Pequenos pertences'])];
  assert.equal(suggest(shelves, [], 'eletronicos').boxNumber, '19 - Eletrônicos');
  assert.equal(suggest(shelves, [], 'pequenos_pertences').boxNumber, '20 - Pequenos pertences');
  assert.equal(suggest(shelves), null);
});
test('balanceamento soma apenas caixas compatíveis', () => {
  const shelves = [shelf('2.1','Eletrônicos e pequenos pertences',['19 - Eletrônicos','20 - Pequenos pertences']), shelf('2.2','Eletrônicos',['21'])];
  assert.equal(suggest(shelves, [occupancy('2.1','20 - Pequenos pertences')], 'eletronicos').shelfCode, '2.1');
});
test('auto recalc sincroniza quatro campos e respeita override', () => {
  const suggestion = suggest([shelf('2.1','Diversos',['11'])]);
  assert.deepEqual(plain(storage.automaticStorageFields(false, suggestion)), { shelfCode:'2.1',shelf:'2.1',boxNumber:'11',box:'11' });
  assert.equal(storage.automaticStorageFields(true, suggestion), null);
  assert.equal(storage.automaticStorageFields(true, null), null);
  assert.equal(storage.automaticStorageFields(false, null).box, '');
});
test('manual payload válido e sem nome rejeitado antes da escrita', () => {
  assert.deepEqual(plain(loans.selectedLoanPayload({kind:'manual',key:1,name:' Chave sala 601 ',quantity:2})), {equipment_id:null,manual_item_name:'Chave sala 601',quantity_borrowed:2});
  assert.throws(() => loans.selectedLoanPayload({kind:'manual',key:1,name:' ',quantity:1}), /Nome/);
  assert.throws(() => loans.normalizeLoanItem({equipment_id:null,manual_item_name:'chave',quantity_borrowed:0}), /Quantidade/);
});
test('grupo misto preserva inventário e exclui manual do estoque', () => {
  const items = [{kind:'inventory',equipment:{id:'notebook'},quantity:1}, {kind:'manual',key:1,name:'Chave sala 601',quantity:1}].map(item => loans.selectedLoanPayload(item));
  assert.equal(items[0].manual_item_name, null);
  assert.deepEqual(plain(Array.from(loans.loanStockNeeded(items))), [['notebook',1]]);
  assert.equal(loans.loanStockNeeded([{equipment_id:'notebook',quantity_borrowed:1,skip_stock_deduction:true}]).size,0);
});
test('devolução e exclusão manual não restauram estoque', () => {
  assert.equal(loans.shouldRestoreLoanStock({equipment_id:null,status:'active'}),false);
  assert.equal(loans.shouldRestoreLoanStock({equipment_id:'notebook',status:'returned'}),false);
  assert.equal(loans.shouldRestoreLoanStock({equipment_id:'notebook',status:'active'}),true);
  assert.equal(loans.loanItemName({manual_item_name:'Chave 601',equipment:null}),'Chave 601');
});
test('PIX ausente ou sentinel bloqueia toda seleção sem writes', async () => {
  const writes=[];
  for (const invalid of ['', 'Sem PIX', ' sem pix ']) {
    await assert.rejects(async () => pix.persistPixPlan(pix.preparePixPlan([{id:'a',pix:'ok'},{id:'b',pix:invalid}],{}),async (...args)=>writes.push(args)), /Informe/);
  }
  assert.equal(writes.length,0);
});
test('override PIX vira snapshot real e persiste apenas cadastro alterado', async () => {
  const plan=pix.preparePixPlan([{id:'a',pix:'old'},{id:'b',pix:'same'}],{a:' new '});
  assert.equal(plan[0].pix,'new');
  const writes=[];
  await pix.persistPixPlan(plan,async (...args)=>writes.push(args));
  assert.deepEqual(writes,[['a','new']]);
});
