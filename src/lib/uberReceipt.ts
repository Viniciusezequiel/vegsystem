import jsPDF from 'jspdf';
import { UBER_STATUS_LABELS, type UberRequest } from '@/hooks/useUberRequests';

export type ReceiptData = Pick<
  UberRequest,
  'code' | 'requester_name' | 'origin' | 'destination' | 'trip_date' | 'trip_time' | 'reason' | 'status'
> & { notes?: string | null; created_at: string };

export function formatDateBR(value: string) {
  if (!value) return '-';
  const [y, m, d] = value.split('-');
  if (!d) return value;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(value: string) {
  const d = new Date(value);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function receiptToText(r: ReceiptData) {
  return [
    '*COMPROVANTE DE SOLICITAÇÃO DE VIAGEM*',
    `Código: ${r.code}`,
    `Solicitante: ${r.requester_name}`,
    '',
    `Viagem de: ${r.origin}`,
    `Para: ${r.destination}`,
    `Motivo: ${r.reason}`,
    '',
    `Data da viagem: ${formatDateBR(r.trip_date)}`,
    `Horário: ${r.trip_time}`,
    r.notes ? `Observações: ${r.notes}` : '',
    `Registrado em: ${formatDateTimeBR(r.created_at)}`,
    `Status: ${UBER_STATUS_LABELS[r.status] ?? r.status}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function downloadReceiptPdf(r: ReceiptData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 18;
  let y = 22;

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('COMPROVANTE DE SOLICITAÇÃO DE VIAGEM', left, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Código: ${r.code}`, left, 23);

  y = 45;
  doc.setTextColor(30, 41, 59);

  const line = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    const wrapped = doc.splitTextToSize(value || '-', 174);
    doc.text(wrapped, left, y + 6);
    y += 6 + wrapped.length * 6 + 4;
  };

  line('Solicitante', r.requester_name);

  // Highlight block
  doc.setFillColor(239, 246, 255);
  const blockTop = y;
  doc.roundedRect(left - 4, blockTop, 182, 34, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216);
  doc.text(`Viagem de: ${r.origin}`, left, blockTop + 10);
  doc.text(`Para: ${r.destination}`, left, blockTop + 19);
  doc.text(doc.splitTextToSize(`Motivo: ${r.reason}`, 170), left, blockTop + 28);
  y = blockTop + 44;

  doc.setTextColor(15, 23, 42);
  line('Data da viagem', formatDateBR(r.trip_date));
  line('Horário da solicitação', r.trip_time);
  if (r.notes) line('Observações', r.notes);
  line('Registro criado em', formatDateTimeBR(r.created_at));
  line('Status', UBER_STATUS_LABELS[r.status] ?? r.status);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento gerado automaticamente pelo Controle de Viagens Uber.', left, 285);

  doc.save(`comprovante-${r.code}.pdf`);
}
