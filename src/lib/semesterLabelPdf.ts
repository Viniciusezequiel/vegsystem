import jsPDF from 'jspdf';

// Pimaco A4365 — A4 (210x297mm), 2 colunas × 4 linhas, etiquetas de 99,0 x 67,7mm
export interface SemesterLabelData {
  competency: string;
  room: string;
  itemType: string;
  problem: string;
  maintenance: string;
  responsible: string;
  date: string;
  labelCode: string;
  sequenceNumber: number;
  sequenceTotal: number;
}

const PAGE_W = 210;
const PAGE_H = 297;
const LABEL_W = 99.0;
const LABEL_H = 67.7;
const COLS = 2;
const ROWS = 4;
const H_GAP = 2.5;
const V_GAP = 0;
const MARGIN_LEFT = (PAGE_W - (LABEL_W * COLS + H_GAP * (COLS - 1))) / 2;
const MARGIN_TOP = (PAGE_H - (LABEL_H * ROWS + V_GAP * (ROWS - 1))) / 2;

export function generateSemesterLabelsPdf(labels: SemesterLabelData[]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const perPage = COLS * ROWS;

  labels.forEach((label, idx) => {
    const pageIdx = Math.floor(idx / perPage);
    const slot = idx % perPage;
    if (slot === 0 && pageIdx > 0) doc.addPage('a4', 'portrait');

    const row = Math.floor(slot / COLS);
    const col = slot % COLS;
    const x = MARGIN_LEFT + col * (LABEL_W + H_GAP);
    const y = MARGIN_TOP + row * (LABEL_H + V_GAP);

    drawLabel(doc, label, x, y);
  });

  return doc;
}

function drawLabel(doc: jsPDF, l: SemesterLabelData, ox: number, oy: number) {
  const padding = 5;
  const innerW = LABEL_W - padding * 2;

  // Cabeçalho verde vivo
  doc.setFillColor(22, 163, 74); // green-600
  doc.rect(ox, oy, LABEL_W, 12, 'F');
  // Faixa de destaque inferior do cabeçalho
  doc.setFillColor(34, 197, 94); // green-500
  doc.rect(ox, oy + 12, LABEL_W, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CHECKLIST SEMESTRAL', ox + padding, oy + 7.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(l.competency, ox + LABEL_W - padding, oy + 7.6, { align: 'right' });

  // Corpo
  doc.setTextColor(20, 20, 20);
  let cy = oy + 18.5;

  // Sala em destaque (linha cheia)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('SALA', ox + padding, cy);
  doc.setTextColor(15, 15, 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(l.room || '-', ox + padding, cy + 7);
  cy += 13;

  // Item + Problema ligados em um único bloco
  doc.setFillColor(240, 253, 244); // green-50
  doc.setDrawColor(187, 247, 208); // green-200
  doc.roundedRect(ox + padding, cy - 3, innerW, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61); // green-700
  doc.text('ITEM', ox + padding + 2, cy + 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 15, 15);
  const itemWrapped = doc.splitTextToSize(l.itemType || '-', innerW - 4);
  doc.text(itemWrapped[0] ?? '-', ox + padding + 2, cy + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  doc.text('PROBLEMA(S)', ox + padding + 2, cy + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 15, 15);
  const problemsText = (l.problem || '-').split(/\s*\+\s*|\s*,\s*/).join(' • ');
  const probWrapped = doc.splitTextToSize(problemsText, innerW - 4);
  doc.text(probWrapped.slice(0, 2).join('\n'), ox + padding + 2, cy + 13);

  cy += 19;

  // Manutenção + Responsável
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('MANUTENÇÃO', ox + padding, cy);
  doc.text('RESPONSÁVEL', ox + padding + innerW / 2, cy);
  doc.setTextColor(15, 15, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(l.maintenance || '-', ox + padding, cy + 4.5);
  doc.text(doc.splitTextToSize(l.responsible || '-', innerW / 2 - 2)[0] ?? '-', ox + padding + innerW / 2, cy + 4.5);

  // Rodapé
  const footerY = oy + LABEL_H - 5;
  doc.setDrawColor(220, 220, 220);
  doc.line(ox + padding, footerY - 4, ox + LABEL_W - padding, footerY - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Data: ${l.date}`, ox + padding, footerY);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Etiqueta ${String(l.sequenceNumber).padStart(3, '0')}/${String(l.sequenceTotal).padStart(3, '0')}`,
    ox + LABEL_W / 2,
    footerY,
    { align: 'center' },
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(l.labelCode, ox + LABEL_W - padding, footerY, { align: 'right' });
}
