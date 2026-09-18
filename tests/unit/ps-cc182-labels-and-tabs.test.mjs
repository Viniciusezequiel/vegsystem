import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { parsePsExamLabelWorkbook } from '../../src/lib/psExamLabelSpreadsheet.mjs';

const EVENT = { name: 'Processo Seletivo 2026 - Campus Central', date: '2026-09-15', location: 'Auditório principal' };

const sourcePdf = fs.readFileSync(new URL('../../src/lib/psEventPdf.ts', import.meta.url), 'utf8');
const sourceTabs = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
const sourceEventNav = fs.readFileSync(new URL('../../src/components/processo-seletivo/PsEventWorkspaceNav.tsx', import.meta.url), 'utf8');
const sourceGlobalTabs = fs.readFileSync(new URL('../../src/components/ui/tabs.tsx', import.meta.url), 'utf8');
const sourceLabelsDialog = fs.readFileSync(new URL('../../src/components/processo-seletivo/PsEventLabelsDialog.tsx', import.meta.url), 'utf8');
const sourceWord = fs.readFileSync(new URL('../../src/lib/psEventWord.ts', import.meta.url), 'utf8');

const sheet = {
  labelWidth: 101.6,
  labelHeight: 33.9,
  columns: 2,
  rows: 7,
  perPage: 14,
  leftMargin: 4,
  topMargin: 21.05,
  horizontalGap: 4.7,
};

test('CC182 physical page size is compatible with jsPDF', () => {
  const doc = new jsPDF({ unit: 'mm', format: [215.9, 279.4], orientation: 'portrait' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  assert.ok(Math.abs(width - 215.9) < 0.2, `width ${width} not near 215.9`);
  assert.ok(Math.abs(height - 279.4) < 0.2, `height ${height} not near 279.4`);

  assert.match(sourcePdf, /pageWidth:\s*215\.9/i);
  assert.match(sourcePdf, /pageHeight:\s*279\.4/i);
  assert.match(sourcePdf, /labelWidth:\s*101\.6/i);
  assert.match(sourcePdf, /labelHeight:\s*33\.9/i);
  assert.match(sourcePdf, /columns:\s*2/i);
  assert.match(sourcePdf, /rows:\s*7/i);
  assert.match(sourcePdf, /perPage:\s*14/i);
  assert.match(sourcePdf, /leftMargin:\s*4/i);
  assert.match(sourcePdf, /horizontalGap:\s*4\.7/i);
  assert.match(sourcePdf, /topMargin:\s*21\.05/i);

  const secondColumnX = sheet.leftMargin + sheet.labelWidth + sheet.horizontalGap;
  assert.ok(Math.abs(secondColumnX - 110.3) < 0.05);

  const lastLabelBottom = sheet.topMargin + sheet.rows * sheet.labelHeight;
  assert.ok(Math.abs(lastLabelBottom - 258.35) < 0.05, `lastLabelBottom=${lastLabelBottom}`);
  assert.ok(Math.abs((279.4 - lastLabelBottom) - 21.05) < 0.05, `lowerMargin=${279.4 - lastLabelBottom}`);

  assert.equal(Math.ceil(14 / sheet.perPage), 1);
  assert.equal(Math.ceil(15 / sheet.perPage), 2);
  assert.equal(Math.ceil(28 / sheet.perPage), 2);
  assert.equal(Math.ceil(29 / sheet.perPage), 3);

  assert.match(sourcePdf, /generatePsCandidateBadgesPdf\s*\(/i);
  assert.match(sourcePdf, /sheet\.perPage/i);
  assert.match(sourcePdf, /format:\s*\[sheet\.pageWidth,\s*sheet\.pageHeight\]/i);
  assert.match(sourcePdf, /export function generatePsCandidateBadgesPdf[\s\S]*?format:\s*\[sheet\.pageWidth,\s*sheet\.pageHeight\]/i);
  assert.match(sourcePdf, /full_name/i);
  assert.match(sourcePdf, /registration_number/i);
  assert.match(sourcePdf, /cpf/i);
  assert.match(sourcePdf, /rg/i);
  assert.match(sourcePdf, /exam_type/i);
  assert.match(sourcePdf, /campus/i);
  assert.match(sourcePdf, /building/i);
  assert.match(sourcePdf, /room/i);
  assert.match(sourcePdf, /seat_number/i);
  assert.match(sourcePdf, /pcd_type/i);
  assert.match(sourcePdf, /drawField\('Nome:'/i);
  assert.match(sourcePdf, /drawField\('RG:'/i);
  assert.match(sourcePdf, /drawField\('CPF:'/i);
  assert.match(sourcePdf, /drawField\('Prova:'/i);
  assert.match(sourcePdf, /drawField\('Sala:'/i);
  assert.match(sourcePdf, /drawField\('Campus:'/i);
  assert.match(sourcePdf, /drawField\('Prédio:'/i);
});

test('process selection uses contextual navigation without a horizontal scrolling tab bar', () => {
  assert.match(sourceTabs, /orientation="vertical"/);
  assert.match(sourceTabs, /PsEventWorkspaceNav/);
  assert.match(sourceEventNav, /className="ps-event-nav__list"/);
  assert.match(sourceEventNav, /value: 'auto', label: 'Autoavaliações'/);
  assert.match(sourceEventNav, /value: 'fiscais', label: 'Equipe'/);
  assert.match(sourceEventNav, /value: 'confirmacoes', label: 'Confirmações'/);
  assert.doesNotMatch(sourceTabs, /overflow-x-auto overflow-y-hidden scrollbar-none/);

  assert.doesNotMatch(sourceGlobalTabs, /overflow-x-auto/i);
  assert.doesNotMatch(sourceGlobalTabs, /scrollbar-none/i);
  assert.doesNotMatch(sourceGlobalTabs, /w-max\s+min-w-full/i);
});

test('planilha de materiais preserva abas, repetições, prédio, andar e sala', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Processo Seletivo', 'Nome ', 'Prédio', 'Andar ', 'Sala '],
    ['PROCESSO SELETIVO 2027', 'CADERNO DE QUESTÕES', 'FEA - BLOCO F', 'ANDAR: 1º', 'F101'],
    ['PROCESSO SELETIVO 2027', 'CADERNO DE QUESTÕES', 'FEA - BLOCO F', 'ANDAR: 1º', 'F101'],
  ]), 'CADERNO DE QUESTÕES');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Processo Seletivo', 'Nome ', 'Prédio', 'Andar ', 'Sala '],
    ['PROCESSO SELETIVO 2027', 'FOLHA DE RESPOSTAS', 'FACE II - BLOCO E', 'ANDAR: 3º', 'E301'],
  ]), 'FOLHA DE RESPOSTAS');

  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const parsed = parsePsExamLabelWorkbook(bytes);
  assert.equal(parsed.rows.length, 3);
  assert.deepEqual(parsed.sheets.map((sheet) => sheet.count), [2, 1]);
  assert.equal(parsed.rows[0].label_type, 'question_booklet');
  assert.equal(parsed.rows[0].floor, '1º');
  assert.equal(parsed.rows[1].room, 'F101');
  assert.equal(parsed.rows[2].label_type, 'answer_sheet');
  assert.equal(parsed.rows[2].building, 'FACE II - BLOCO E');
});

test('central de etiquetas integra materiais de prova ao mesmo modelo CC182', () => {
  assert.match(sourceTabs, /setLabelsOpen\(true\)/);
  assert.match(sourceTabs, /PsEventLabelsDialog/);
  assert.match(sourceLabelsDialog, /Importar planilha/);
  assert.match(sourceLabelsDialog, /Gerar PDF/);
  assert.match(sourceLabelsDialog, /14 etiquetas por página/);
  assert.match(sourcePdf, /export function generatePsExamLabelsPdf/);
  assert.match(sourcePdf, /const sheet = PS_CANDIDATE_LABEL_SHEET/);
  assert.match(sourcePdf, /question_booklet/);
  assert.match(sourcePdf, /answer_sheet/);
  assert.match(sourcePdf, /235, 38, 38/);
  assert.match(sourcePdf, /135, 169, 80/);
});

test('central de etiquetas filtra equipe e candidatos por campus e prédio', () => {
  assert.match(sourceLabelsDialog, /Todos os campus/);
  assert.match(sourceLabelsDialog, /Todos os prédios/);
  assert.match(sourceLabelsDialog, /filterByLocation/);
  assert.match(sourceTabs, /matchesLabelLocation/);
  assert.match(sourceTabs, /labelLocationSuffix/);
});

test('central de etiquetas exporta equipe, candidatos e materiais em PDF ou Word', () => {
  assert.match(sourceLabelsDialog, /LabelExportFormat = 'pdf' \| 'word'/);
  assert.match(sourceLabelsDialog, /Gerar Word/);
  assert.match(sourceTabs, /generatePsTeamLabelsWord/);
  assert.match(sourceTabs, /generatePsCandidateLabelsWord/);
  assert.match(sourceWord, /generatePsExamLabelsWord/);
  assert.match(sourceWord, /Packer\.toBlob/);
  assert.match(sourceWord, /length: 7/);
  assert.match(sourceWord, /mm\(101\.6\).*mm\(4\.7\).*mm\(101\.6\)/);
  assert.match(sourceWord, /top: 21\.05, right: 4, bottom: 21\.05, left: 4/);
});
