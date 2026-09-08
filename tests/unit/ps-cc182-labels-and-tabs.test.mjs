import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { jsPDF } from 'jspdf';

const EVENT = { name: 'Processo Seletivo 2026 - Campus Central', date: '2026-09-15', location: 'Auditório principal' };

const sourcePdf = fs.readFileSync(new URL('../../src/lib/psEventPdf.ts', import.meta.url), 'utf8');
const sourceTabs = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
const sourceGlobalTabs = fs.readFileSync(new URL('../../src/components/ui/tabs.tsx', import.meta.url), 'utf8');

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
  assert.match(sourcePdf, /campus/i);
  assert.match(sourcePdf, /room/i);
  assert.match(sourcePdf, /seat_number/i);
  assert.match(sourcePdf, /pcd_type/i);
});

test('process selection tabs are scrollable only in the screen-specific container', () => {
  const mainTabsWrapper = sourceTabs.match(/<div className="w-full overflow-x-auto overflow-y-hidden scrollbar-none">[\s\S]*?<TabsList className="w-max min-w-full flex-nowrap">[\s\S]*?<\/TabsList>[\s\S]*?<\/div>/)?.[0] ?? '';

  assert.ok(mainTabsWrapper.includes('overflow-x-auto'));
  assert.ok(mainTabsWrapper.includes('overflow-y-hidden'));
  assert.ok(mainTabsWrapper.includes('scrollbar-none'));
  assert.ok(mainTabsWrapper.includes('w-max'));
  assert.ok(mainTabsWrapper.includes('min-w-full'));
  assert.ok(mainTabsWrapper.includes('flex-nowrap'));
  assert.match(sourceTabs, /TabsTrigger value="auto" className="shrink-0"/);
  assert.doesNotMatch(mainTabsWrapper, /overflow-y-auto/i);

  assert.doesNotMatch(sourceGlobalTabs, /overflow-x-auto/i);
  assert.doesNotMatch(sourceGlobalTabs, /scrollbar-none/i);
  assert.doesNotMatch(sourceGlobalTabs, /w-max\s+min-w-full/i);
});
