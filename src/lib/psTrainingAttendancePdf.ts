import jsPDF from 'jspdf';

export interface PsTrainingAttendanceEvent {
  name: string;
  date?: string | null;
  location?: string | null;
}

export interface PsTrainingAttendanceGroup {
  name: string;
}

export interface PsTrainingAttendanceSession {
  starts_at: string;
  ends_at?: string | null;
  campus?: string | null;
  location?: string | null;
  room?: string | null;
}

export interface PsTrainingAttendanceRow {
  collaborator_name: string;
  roles: string[];
}

function truncate(doc: jsPDF, text: string, maxW: number) {
  if (doc.getTextWidth(text) <= maxW) return text;
  let value = text;
  while (value.length > 1 && doc.getTextWidth(`${value}...`) > maxW) value = value.slice(0, -1);
  return `${value}...`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Lista de presença do treinamento - A4 paisagem, pronta para assinatura manual. */
export function generatePsTrainingAttendancePdf(
  event: PsTrainingAttendanceEvent,
  group: PsTrainingAttendanceGroup,
  session: PsTrainingAttendanceSession,
  rows: PsTrainingAttendanceRow[],
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const PW = 297;
  const PH = 210;
  const ML = 12;
  const MR = 12;
  const tableW = PW - ML - MR;
  const cols = [
    { label: 'Nº', width: 12 },
    { label: 'NOME COMPLETO', width: 96 },
    { label: 'CARGO(S)', width: 72 },
    { label: 'ASSINATURA', width: tableW - 180 },
  ];
  const rowH = 11;
  const headerH = 9;
  const sorted = [...rows].sort((a, b) =>
    String(a.collaborator_name || '').localeCompare(String(b.collaborator_name || ''), 'pt-BR')
  );

  let page = 0;
  let y = 0;

  const drawPageHeader = () => {
    page += 1;
    if (page > 1) doc.addPage('a4', 'landscape');
    y = 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(24, 28, 35);
    doc.text('LISTA DE PRESENÇA - TREINAMENTO', PW / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(10);
    doc.text(truncate(doc, event.name || 'Processo Seletivo', tableW), PW / 2, y, { align: 'center' });
    y += 7;

    doc.setDrawColor(215, 220, 226);
    doc.setFillColor(248, 249, 251);
    doc.roundedRect(ML, y, tableW, 21, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(45, 50, 58);
    doc.text('TREINAMENTO', ML + 4, y + 5);
    doc.text('DATA / HORÁRIO', ML + 104, y + 5);
    doc.text('CAMPUS / LOCAL', ML + 181, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const when = session.ends_at
      ? `${formatDateTime(session.starts_at)} a ${formatDateTime(session.ends_at)}`
      : formatDateTime(session.starts_at);
    const location = [
      session.campus,
      session.location || event.location,
      session.room ? `Sala ${session.room}` : null,
    ].filter(Boolean).join(' - ') || '-';

    doc.text(truncate(doc, group.name || '-', 92), ML + 4, y + 12);
    doc.text(truncate(doc, when, 69), ML + 104, y + 12);
    doc.text(truncate(doc, location, 84), ML + 181, y + 12);

    doc.setFontSize(7.5);
    doc.setTextColor(95, 101, 110);
    doc.text(`Participantes inscritos nesta turma: ${sorted.length}`, ML + 4, y + 18);

    y += 27;

    doc.setFillColor(239, 242, 246);
    doc.setDrawColor(196, 202, 210);
    doc.rect(ML, y, tableW, headerH, 'FD');
    let x = ML;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(42, 48, 56);
    for (const col of cols) {
      doc.text(col.label, x + col.width / 2, y + 5.7, { align: 'center' });
      x += col.width;
      if (x < ML + tableW) doc.line(x, y, x, y + headerH);
    }
    y += headerH;
  };

  const drawRow = (row: PsTrainingAttendanceRow, index: number) => {
    if (y + rowH > PH - 16) drawPageHeader();

    doc.setDrawColor(207, 212, 219);
    doc.setFillColor(255, 255, 255);
    doc.rect(ML, y, tableW, rowH, 'FD');

    const roleText = row.roles.length ? row.roles.join(' / ') : '-';
    const values = [String(index + 1), row.collaborator_name || 'Colaborador', roleText, ''];
    let x = ML;

    values.forEach((value, colIndex) => {
      const col = cols[colIndex];
      if (colIndex > 0) doc.line(x, y, x, y + rowH);

      if (colIndex === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(55, 61, 69);
        doc.text(value, x + col.width / 2, y + 6.8, { align: 'center' });
      } else if (colIndex < 3) {
        doc.setFont('helvetica', colIndex === 1 ? 'bold' : 'normal');
        doc.setFontSize(colIndex === 1 ? 8 : 7.5);
        doc.setTextColor(35, 40, 47);
        const lines = doc.splitTextToSize(value, col.width - 5).slice(0, 2);
        const lineGap = 3.5;
        const startY = y + rowH / 2 - ((lines.length - 1) * lineGap) / 2 + 1.1;
        lines.forEach((line: string, lineIndex: number) => {
          doc.text(line, x + 2.5, startY + lineIndex * lineGap);
        });
      }

      x += col.width;
    });

    y += rowH;
  };

  drawPageHeader();

  if (!sorted.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 106, 114);
    doc.text('Nenhum participante escolheu esta data de treinamento.', PW / 2, y + 18, { align: 'center' });
  } else {
    sorted.forEach(drawRow);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(135, 141, 150);
    doc.text('VEG System - Processo Seletivo - Lista de presença de treinamento', PW / 2, PH - 7, { align: 'center' });
    doc.text(`${i}/${totalPages}`, PW - MR, PH - 7, { align: 'right' });
  }

  return doc;
}
