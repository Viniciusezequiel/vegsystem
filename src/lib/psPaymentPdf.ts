import jsPDF from 'jspdf';

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
  pix?: string | null;
  assignments: PsPaymentAssignment[];
};

export type PsPaymentEvent = {
  name: string;
  date?: string | null;
  location?: string | null;
};

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
  const widths = { name: 50, unit: 42, assignments: 100, pix: 52, total: 33 };
  const sorted = [...rows].sort((a, b) => a.collaborator_name.localeCompare(b.collaborator_name, 'pt-BR'));
  const grandTotal = sorted.reduce((sum, row) => sum + row.assignments.reduce((acc, item) => acc + Number(item.pay_value || 0), 0), 0);

  let y = 0;
  let page = 0;

  const header = () => {
    page += 1;
    if (page > 1) doc.addPage('a4', 'landscape');
    y = 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(24, 28, 35);
    doc.text('PLANILHA DE PAGAMENTOS', PW / 2, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 86, 95);
    doc.text(event.name || '', PW / 2, y, { align: 'center' });
    y += 5;
    const info = [event.date ? `Data: ${event.date}` : '', event.location ? `Local: ${event.location}` : ''].filter(Boolean).join(' · ');
    if (info) {
      doc.setFontSize(8);
      doc.text(info, PW / 2, y, { align: 'center' });
      y += 7;
    } else y += 3;

    doc.setFillColor(244, 246, 249);
    doc.setDrawColor(195, 201, 209);
    doc.rect(ML, y, tableW, 9, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.setTextColor(35, 40, 48);

    let x = ML;
    for (const [label, width] of [
      ['COLABORADOR', widths.name], ['UNIDADE', widths.unit], ['CARGOS / JORNADAS / VALORES', widths.assignments], ['PIX', widths.pix], ['TOTAL', widths.total],
    ] as Array<[string, number]>) {
      doc.text(label, x + 2, y + 5.8);
      x += width;
      if (x < ML + tableW) doc.line(x, y, x, y + 9);
    }
    y += 9;
  };

  header();

  for (const row of sorted) {
    const assignmentLines = row.assignments.length
      ? row.assignments.map(item => {
          const detail = [journeyLabel(item.journey_key), item.work_schedule].filter(Boolean).join(' · ');
          return `${item.role_name}${detail ? ` — ${detail}` : ''} — ${brl(item.pay_value)}`;
        })
      : ['Sem cargo/valor registrado'];

    const rowTotal = row.assignments.reduce((sum, item) => sum + Number(item.pay_value || 0), 0);
    doc.setFontSize(7.2);
    const assignmentWrapped = assignmentLines.flatMap(line => doc.splitTextToSize(line, widths.assignments - 4));
    const rowHeight = Math.max(14, assignmentWrapped.length * 3.6 + 6);

    if (y + rowHeight > PH - 22) header();

    doc.setDrawColor(210, 215, 222);
    doc.rect(ML, y, tableW, rowHeight);
    let x = ML;
    const unit = row.unit || row.institution || row.campus || '—';
    const values = [row.collaborator_name, unit, '', row.pix || '—', brl(rowTotal)];
    const colWidths = [widths.name, widths.unit, widths.assignments, widths.pix, widths.total];

    for (let index = 0; index < colWidths.length; index += 1) {
      const width = colWidths[index];
      if (index > 0) doc.line(x, y, x, y + rowHeight);
      if (index !== 2) {
        doc.setFont('helvetica', index === 0 || index === 4 ? 'bold' : 'normal');
        doc.setFontSize(index === 4 ? 8 : 7.2);
        doc.setTextColor(30, 35, 42);
        const lines = doc.splitTextToSize(values[index], width - 4).slice(0, 4);
        lines.forEach((line: string, lineIndex: number) => doc.text(line, x + 2, y + 5 + lineIndex * 3.4));
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(30, 35, 42);
        assignmentWrapped.forEach((line: string, lineIndex: number) => doc.text(line, x + 2, y + 5 + lineIndex * 3.6));
      }
      x += width;
    }
    y += rowHeight;
  }

  if (y + 16 > PH - 12) {
    doc.addPage('a4', 'landscape');
    y = 15;
  } else y += 4;

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

  const pages = doc.getNumberOfPages();
  for (let index = 1; index <= pages; index += 1) {
    doc.setPage(index);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(130, 136, 145);
    doc.text(`VEG System · Processo Seletivo · Página ${index}/${pages}`, PW / 2, PH - 5, { align: 'center' });
  }

  return doc;
}
