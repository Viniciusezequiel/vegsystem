import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';

import type { PsBadgeRow, PsCandidateBadgeRow, PsEventInfo, PsExamLabelRow } from '@/lib/psEventPdf';

const mm = convertMillimetersToTwip;
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const paragraph = (text: string, options: { bold?: boolean; color?: string; size?: number; before?: number; after?: number } = {}) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: options.before ?? 0, after: options.after ?? 0 },
    children: [new TextRun({ text, bold: options.bold, color: options.color, size: options.size ?? 16, font: 'Arial' })],
  });

const labelCell = (children: Paragraph[], widthMm: number, shade?: string) => new TableCell({
  width: { size: mm(widthMm), type: WidthType.DXA },
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: mm(1.5), bottom: mm(1.5), left: mm(2.5), right: mm(2.5) },
  borders: noBorders,
  shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
  children,
});

const gapCell = (widthMm: number) => new TableCell({
  width: { size: mm(widthMm), type: WidthType.DXA },
  borders: noBorders,
  children: [new Paragraph('')],
});

function pagedTables<T>(rows: T[], perPage: number, tableForPage: (pageRows: T[]) => Table) {
  const children: Array<Table | Paragraph> = [];
  for (let index = 0; index < rows.length; index += perPage) {
    if (index > 0) children.push(new Paragraph({ pageBreakBefore: true }));
    children.push(tableForPage(rows.slice(index, index + perPage)));
  }
  return children.length ? children : [new Paragraph('Nenhuma etiqueta disponível.')];
}

function createDocument(children: Array<Table | Paragraph>, page: { width: number; height: number; top: number; right: number; bottom: number; left: number }) {
  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: mm(page.width), height: mm(page.height), orientation: PageOrientation.PORTRAIT },
          margin: { top: mm(page.top), right: mm(page.right), bottom: mm(page.bottom), left: mm(page.left) },
        },
      },
      children,
    }],
  });
}

export async function generatePsTeamLabelsWord(event: PsEventInfo, rows: PsBadgeRow[]) {
  const tableForPage = (pageRows: PsBadgeRow[]) => new Table({
    width: { size: mm(174.2), type: WidthType.DXA },
    columnWidths: [mm(85.5), mm(3.2), mm(85.5)],
    borders: noBorders,
    rows: Array.from({ length: 4 }, (_, rowIndex) => {
      const labels = [pageRows[rowIndex * 2], pageRows[rowIndex * 2 + 1]];
      return new TableRow({
        height: { value: mm(58.7), rule: HeightRule.EXACT },
        children: [
          labels[0] ? labelCell(teamContent(event, labels[0]), 85.5, 'F7F8FA') : gapCell(85.5),
          gapCell(3.2),
          labels[1] ? labelCell(teamContent(event, labels[1]), 85.5, 'F7F8FA') : gapCell(85.5),
        ],
      });
    }),
  });
  return Packer.toBlob(createDocument(pagedTables(rows, 8, tableForPage), { width: 210, height: 297, top: 11, right: 17.8, bottom: 11, left: 18 }));
}

function teamContent(event: PsEventInfo, row: PsBadgeRow) {
  const role = String(row.role_name || row.assigned_role || '').toUpperCase();
  const location = [row.floor || '-', row.room || '-'].join(' / ');
  const unit = String(row.unit || row.institution || row.campus || '');
  return [
    paragraph(String(event.name || '').toUpperCase(), { bold: true, size: 14, after: 100 }),
    paragraph('FISCAL', { color: '808892', size: 13 }),
    paragraph(String(row.collaborator_name || '').toUpperCase(), { bold: true, size: 23, before: 80, after: 90 }),
    paragraph(role, { bold: true, color: '1E7846', size: 17, after: 80 }),
    paragraph(location, { color: '646A73', size: 16 }),
    paragraph(unit, { color: '808892', size: 13, before: 100 }),
  ];
}

export async function generatePsCandidateLabelsWord(event: PsEventInfo, rows: PsCandidateBadgeRow[]) {
  return Packer.toBlob(createCc182Document(rows, (row) => [
    paragraph(String(event.name || '').toUpperCase(), { bold: true, size: 12, after: 50 }),
    paragraph(`Nome: ${row.full_name || '-'}`, { bold: true, size: 14 }),
    paragraph(`RG: ${row.rg || '-'}   CPF: ${row.cpf || '-'}`, { size: 13 }),
    paragraph(`Prova: ${row.exam_type || '-'}   Sala: ${row.room || '-'}`, { size: 13 }),
    paragraph(`Campus: ${row.campus || '-'}   Prédio: ${row.building || '-'}`, { size: 13 }),
  ]));
}

export async function generatePsExamLabelsWord(event: PsEventInfo, rows: PsExamLabelRow[]) {
  return Packer.toBlob(createCc182Document(rows, (row) => [
    paragraph(String(row.process_name || event.name || '').toUpperCase(), { bold: true, size: 13, after: 70 }),
    paragraph(String(row.label_name || '').toUpperCase(), {
      bold: true,
      size: 17,
      color: row.label_type === 'question_booklet' ? 'EB2626' : row.label_type === 'answer_sheet' ? '87A950' : '5A5A5A',
      after: 70,
    }),
    paragraph(String(row.building || '').toUpperCase(), { bold: true, size: 14 }),
    paragraph([row.floor ? `${row.floor} ANDAR` : '', `SALA: ${String(row.room || '').toUpperCase()}`].filter(Boolean).join(' · '), { bold: true, size: 14 }),
  ]));
}

function createCc182Document<T>(rows: T[], content: (row: T) => Paragraph[]) {
  const tableForPage = (pageRows: T[]) => new Table({
    width: { size: mm(207.9), type: WidthType.DXA },
    columnWidths: [mm(101.6), mm(4.7), mm(101.6)],
    borders: noBorders,
    rows: Array.from({ length: 7 }, (_, rowIndex) => {
      const labels = [pageRows[rowIndex * 2], pageRows[rowIndex * 2 + 1]];
      return new TableRow({
        height: { value: mm(33.9), rule: HeightRule.EXACT },
        children: [
          labels[0] ? labelCell(content(labels[0]), 101.6) : gapCell(101.6),
          gapCell(4.7),
          labels[1] ? labelCell(content(labels[1]), 101.6) : gapCell(101.6),
        ],
      });
    }),
  });
  return createDocument(pagedTables(rows, 14, tableForPage), { width: 215.9, height: 279.4, top: 21.05, right: 4, bottom: 21.05, left: 4 });
}

export function saveWordBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
