import jsPDF from 'jspdf';
import { preparePdfSignatureRows } from '@/lib/signatureStorageCore.mjs';
import { resolveSignatureDataUrl } from '@/lib/signatureStorage';

export type PsPaymentAssignment = {
  role_name: string;
  journey_key?: string | null;
  work_schedule?: string | null;
  pay_value: number | string;
};

export type PsPaymentCollaborator = {
  collaborator_name: string;
  unit?: string | null;
  institution?: string | null;
  campus?: string | null;
  floor?: string | null;
  room?: string | null;
  pix?: string | null;
  signature_url?: string | null;
  notes?: string | null;
  assignments: PsPaymentAssignment[];
};

export type PsPaymentEvent = {
  name: string;
  date?: string | null;
  location?: string | null;
};

const BRAND = 'RD Avaliações';

const brl = (value: unknown) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const journeyLabel = (value?: string | null) => value === 'integral' ? 'Integral' : value || '';

export function generatePsPaymentsPdf(event: PsPaymentEvent, rows: PsPaymentCollaborator[]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const PW = 297;
  const PH = 210;
  const ML = 10;
  const MR = 10;
  const tableW = PW - ML - MR;

  const cols = [
    { key: 'name', label: 'FISCAL', w: 0.14 },
    { key: 'unit', label: 'UNIDADE', w: 0.09 },
    { key: 'assignments', label: 'FUNÇÃO / JORNADA / VALOR', w: 0.23 },
    { key: 'floor', label: 'ANDAR', w: 0.05 },
    { key: 'room', label: 'SALA', w: 0.05 },
    { key: 'pix', label: 'PIX', w: 0.11 },
    { key: 'sign', label: 'ASSINATURA', w: 0.13 },
    { key: 'total', label: 'TOTAL', w: 0.08 },
    { key: 'obs', label: 'OBSERVAÇÃO / ALTERAÇÃO', w: 0.12 },
  ].map((column) => ({ ...column, width: column.w * tableW }));

  const sorted = [...rows].sort((a, b) =>
    (a.collaborator_name || '').localeCompare(b.collaborator_name || '', 'pt-BR'));

  const grandTotal = sorted.reduce(
    (sum, row) => sum + row.assignments.reduce((acc, item) => acc + Number(item.pay_value || 0), 0),
    0,
  );

  let y = 0;
  let page = 0;

  const header = () => {
    page += 1;
    if (page > 1) doc.addPage('a4', 'landscape');
    y = 12;

    doc.setDrawColor(214, 219, 226);
    doc.setFillColor(250, 251, 252);
    doc.roundedRect(ML, y, tableW, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 76, 85);
    doc.text(
      doc.splitTextToSize(
        'Cada fiscal aparece uma única vez. Quando houver mais de um cargo no mesmo evento, as funções, jornadas e valores são discriminados individualmente e somados no total do colaborador.',
        tableW - 6,
      ),
      ML + 3,
      y + 4.5,
    );
    y += 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 24, 30);
    doc.text('PLANILHA DE PAGAMENTOS', PW / 2, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(80, 86, 95);
    doc.text(event.name || '', PW / 2, y, { align: 'center' });
    y += 5;

    const sub = [
      event.date ? `Data: ${event.date}` : '',
      event.location ? `Local: ${event.location}` : '',
    ].filter(Boolean).join(' · ');
    if (sub) {
      doc.setFontSize(8.5);
      doc.text(doc.splitTextToSize(sub, tableW), PW / 2, y, { align: 'center' });
      y += 5;
    }
    y += 3;

    doc.setFillColor(244, 246, 249);
    doc.setDrawColor(190, 196, 205);
    doc.setLineWidth(0.2);
    doc.rect(ML, y, tableW, 9, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(35, 40, 48);

    let cx = ML;
    cols.forEach((column) => {
      const center = ['floor', 'room', 'sign', 'total', 'obs'].includes(column.key);
      const lines = doc.splitTextToSize(column.label, column.width - 3);
      doc.text(lines, center ? cx + column.width / 2 : cx + 1.5, y + (lines.length > 1 ? 3.5 : 5.8), {
        align: center ? 'center' : 'left',
      });
      cx += column.width;
      if (column !== cols[cols.length - 1]) doc.line(cx, y, cx, y + 9);
    });
    y += 9;
  };

  header();

  for (const row of sorted) {
    const assignmentLines = row.assignments.length
      ? row.assignments.map((item) => {
          const detail = [journeyLabel(item.journey_key), item.work_schedule].filter(Boolean).join(' · ');
          return `${item.role_name}${detail ? ` — ${detail}` : ''} — ${brl(item.pay_value)}`;
        })
      : ['Sem cargo/valor registrado'];

    doc.setFontSize(6.8);
    const assignmentWidth = cols.find((column) => column.key === 'assignments')?.width || 60;
    const assignmentWrapped = assignmentLines.flatMap((line) => doc.splitTextToSize(line, assignmentWidth - 3));
    const rowHeight = Math.max(19, assignmentWrapped.length * 3.2 + 6);

    if (y + rowHeight > PH - 22) header();

    const rowTotal = row.assignments.reduce((sum, item) => sum + Number(item.pay_value || 0), 0);
    doc.setDrawColor(205, 210, 218);
    doc.setLineWidth(0.2);
    doc.rect(ML, y, tableW, rowHeight);

    let cx = ML;
    for (const column of cols) {
      if (column !== cols[0]) doc.line(cx, y, cx, y + rowHeight);

      if (column.key === 'sign') {
        const signature = row.signature_url;
        if (signature && signature.startsWith('data:image')) {
          try {
            doc.addImage(signature, 'PNG', cx + 2.5, y + 2, column.width - 5, rowHeight - 4, undefined, 'FAST');
          } catch {
            // Assinatura inválida não deve impedir a geração do documento.
          }
        }
      } else if (column.key === 'assignments') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(30, 35, 42);
        const lineHeight = 3.2;
        const startY = y + rowHeight / 2 - ((assignmentWrapped.length - 1) * lineHeight) / 2 + 1;
        assignmentWrapped.forEach((line: string, index: number) => {
          doc.text(line, cx + 1.5, startY + index * lineHeight);
        });
      } else {
        let text = '';
        if (column.key === 'name') text = row.collaborator_name || '';
        else if (column.key === 'unit') text = row.unit || row.institution || row.campus || '';
        else if (column.key === 'floor') text = row.floor || '-';
        else if (column.key === 'room') text = row.room || '-';
        else if (column.key === 'pix') text = row.pix || '—';
        else if (column.key === 'total') text = brl(rowTotal);
        else if (column.key === 'obs') text = row.notes || '';

        doc.setFont('helvetica', ['name', 'total'].includes(column.key) ? 'bold' : 'normal');
        doc.setFontSize(column.key === 'total' ? 7.2 : column.key === 'obs' ? 6.2 : 6.8);
        doc.setTextColor(30, 35, 42);

        const maxLines = column.key === 'obs' ? 4 : 3;
        const lineHeight = column.key === 'obs' ? 2.9 : 3.1;
        const lines = doc.splitTextToSize(text, column.width - 3).slice(0, maxLines);
        const startY = y + rowHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 1;
        lines.forEach((line: string, index: number) => {
          doc.text(line, cx + 1.5, startY + index * lineHeight);
        });
      }

      cx += column.width;
    }

    y += rowHeight;
  }

  if (y + 17 > PH - 12) {
    doc.addPage('a4', 'landscape');
    y = 15;
  } else {
    y += 4;
  }

  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(195, 201, 209);
  doc.roundedRect(PW - MR - 92, y, 92, 13, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(70, 76, 85);
  doc.text('TOTAL GERAL DO EVENTO', PW - MR - 88, y + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(25, 30, 38);
  doc.text(brl(grandTotal), PW - MR - 4, y + 9, { align: 'right' });

  const totalPages = doc.getNumberOfPages();
  for (let index = 1; index <= totalPages; index += 1) {
    doc.setPage(index);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 162);
    doc.text(`${BRAND} — Planilha de Pagamentos gerada automaticamente`, PW / 2, PH - 8, { align: 'center' });
    doc.text(`${index}/${totalPages}`, PW - MR, PH - 8, { align: 'right' });
  }

  return doc;
}

/** Resolve assinaturas privadas no R2 somente durante a geração explícita do PDF. */
export async function generatePsPaymentsPdfAsync(
  event: PsPaymentEvent,
  rows: PsPaymentCollaborator[],
  resolveR2Signature = resolveSignatureDataUrl,
): Promise<jsPDF> {
  const prepared = await preparePdfSignatureRows(rows, resolveR2Signature);
  return generatePsPaymentsPdf(event, prepared as PsPaymentCollaborator[]);
}
