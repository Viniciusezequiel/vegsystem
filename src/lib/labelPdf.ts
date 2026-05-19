import jsPDF from 'jspdf';
import type { LabelTemplate, LabelField } from '@/hooks/useLabelTemplates';

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
};

export function getPageDims(tpl: LabelTemplate): { w: number; h: number } {
  const [pw, ph] = PAGE_SIZES[tpl.page_size] || PAGE_SIZES.A4;
  return tpl.orientation === 'landscape' ? { w: ph, h: pw } : { w: pw, h: ph };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export interface GeneratePdfOpts {
  template: LabelTemplate;
  rows: Record<string, any>[];
  cutBorders?: boolean;
}

export function generateLabelsPdf({ template, rows, cutBorders }: GeneratePdfOpts): jsPDF {
  const { w: pageW, h: pageH } = getPageDims(template);
  const doc = new jsPDF({
    unit: 'mm',
    format: [pageW, pageH],
    orientation: template.orientation,
  });

  const perPage = template.columns * template.rows;
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) doc.addPage([pageW, pageH], template.orientation);

    for (let r = 0; r < template.rows; r++) {
      for (let c = 0; c < template.columns; c++) {
        const idx = p * perPage + r * template.columns + c;
        if (idx >= rows.length) break;
        const row = rows[idx];
        const x = template.page_margin_left + c * (template.label_width + template.horizontal_gap);
        const y = template.page_margin_top + r * (template.label_height + template.vertical_gap);

        if (cutBorders) {
          doc.setDrawColor(180);
          doc.setLineWidth(0.1);
          doc.rect(x, y, template.label_width, template.label_height);
        }

        drawFields(doc, template.fields, row, x, y, template.label_width, template.label_height);
      }
    }
  }

  return doc;
}

function drawFields(
  doc: jsPDF,
  fields: LabelField[],
  row: Record<string, any>,
  ox: number,
  oy: number,
  lw: number,
  lh: number,
) {
  for (const f of fields) {
    const value = String(row[f.column] ?? '');
    const style = (f.bold && f.italic) ? 'bolditalic' : f.bold ? 'bold' : f.italic ? 'italic' : 'normal';
    doc.setFont(f.fontFamily || 'helvetica', style);
    doc.setFontSize(f.fontSize || 10);
    const [r, g, b] = hexToRgb(f.color || '#000000');
    doc.setTextColor(r, g, b);

    const maxWidth = Math.max(1, Math.min(f.width || lw, lw - f.x));
    const lines: string[] = f.wrap ? doc.splitTextToSize(value, maxWidth) : [value];

    const lineHeightMm = ((f.fontSize || 10) * 0.3528) * (f.lineHeight || 1.15);

    lines.forEach((line, i) => {
      let tx = ox + f.x;
      if (f.align === 'center') tx = ox + f.x + maxWidth / 2;
      else if (f.align === 'right') tx = ox + f.x + maxWidth;
      const ty = oy + f.y + lineHeightMm + i * lineHeightMm;
      if (ty > oy + lh) return;
      doc.text(line, tx, ty, { align: f.align, baseline: 'alphabetic' });
    });
  }
}
