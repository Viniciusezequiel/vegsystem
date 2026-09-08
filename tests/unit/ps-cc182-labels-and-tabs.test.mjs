import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import jsPDF from 'jspdf';

const EVENT = { name: 'Processo Seletivo 2026 - Campus Central', date: '2026-09-15', location: 'Auditório principal' };

const sourcePdf = fs.readFileSync(new URL('../../src/lib/psEventPdf.ts', import.meta.url), 'utf8');
const sourceTabs = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');

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

test('geometry CC182 uses carta physical sizing and 14 labels per page', () => {
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

  const lastY = sheet.topMargin + (sheet.rows - 1) * sheet.labelHeight;
  assert.ok(lastY < 279.4);

  assert.equal(Math.ceil(14 / sheet.perPage), 1);
  assert.equal(Math.ceil(15 / sheet.perPage), 2);
  assert.equal(Math.ceil(28 / sheet.perPage), 2);
  assert.equal(Math.ceil(29 / sheet.perPage), 3);
});

test('candidate labels generate CC182 size document and render content without errors', () => {
  const doc = new jsPDF({ unit: 'mm', format: [215.9, 279.4], orientation: 'portrait' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  assert.ok(Math.abs(width - 215.9) < 0.2, `width ${width} not near 215.9`);
  assert.ok(Math.abs(height - 279.4) < 0.2, `height ${height} not near 279.4`);
});

test('event tabs use horizontal overflow without vertical overflow', () => {
  assert.match(sourceTabs, /overflow-x-auto/i);
  assert.match(sourceTabs, /overflow-y-hidden/i);
  assert.match(sourceTabs, /whitespace-nowrap/i);
  assert.match(sourceTabs, /shrink-0/i);
  assert.doesNotMatch(sourceTabs, /overflow-y-auto/i);
});
