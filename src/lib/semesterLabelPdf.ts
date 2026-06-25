import jsPDF from 'jspdf';

// Pimaco A4365 — A4 (210x297mm), 2 colunas × 4 linhas, etiquetas de 99,0 x 67,7mm
export interface SemesterLabelData {
  competency: string;
  room: string;
  floor: string;
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
// Centraliza na página
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

  // Cabeçalho colorido
  doc.setFillColor(30, 64, 175); // azul-700
  doc.rect(ox, oy, LABEL_W, 11, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CHECKLIST SEMESTRAL', ox + padding, oy + 7.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(l.competency, ox + LABEL_W - padding, oy + 7.2, { align: 'right' });

  // Corpo
  doc.setTextColor(20, 20, 20);
  let cy = oy + 16;

  const line = (label: string, value: string, big = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(label.toUpperCase(), ox + padding, cy);
    doc.setTextColor(15, 15, 15);
    doc.setFont('helvetica', big ? 'bold' : 'normal');
    doc.setFontSize(big ? 12 : 10);
    const wrapped = doc.splitTextToSize(value || '-', innerW);
    doc.text(wrapped[0] ?? '-', ox + padding, cy + 5);
    cy += big ? 11 : 9;
  };

  // Linha 1: Sala + Andar (lado a lado)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('SALA', ox + padding, cy);
  doc.text('ANDAR', ox + padding + innerW / 2, cy);
  doc.setTextColor(15, 15, 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(l.room || '-', ox + padding, cy + 6);
  doc.text(l.floor || '-', ox + padding + innerW / 2, cy + 6);
  cy += 11;

  line('Item', l.itemType);
  line('Problema', l.problem);

  // Manutenção + Responsável lado a lado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('MANUTENÇÃO', ox + padding, cy);
  doc.text('RESPONSÁVEL', ox + padding + innerW / 2, cy);
  doc.setTextColor(15, 15, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(l.maintenance || '-', ox + padding, cy + 5);
  doc.text(doc.splitTextToSize(l.responsible || '-', innerW / 2 - 2)[0] ?? '-', ox + padding + innerW / 2, cy + 5);
  cy += 9;

  // Rodapé — data + sequência + código
  const footerY = oy + LABEL_H - 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(ox + padding, footerY - 4, ox + LABEL_W - padding, footerY - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
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
