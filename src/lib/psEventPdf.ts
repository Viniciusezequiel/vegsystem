import jsPDF from 'jspdf';

export interface PsBadgeRow {
  collaborator_name: string;
  role_name?: string | null;
  assigned_role?: string | null;
  floor?: string | null;
  room?: string | null;
  unit?: string | null;
  institution?: string | null;
  campus?: string | null;
}

export interface PsEventInfo {
  name: string;
  date?: string | null;
  location?: string | null;
}

const BRAND = 'RD Avaliações';

function fit(doc: jsPDF, text: string, maxW: number, start: number, min = 6) {
  let size = start;
  doc.setFontSize(size);
  while (doc.getTextWidth(text) > maxW && size > min) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
}

function truncate(doc: jsPDF, text: string, maxW: number) {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** Crachás de colaboradores — A4 retrato, 2 colunas x 4 linhas (85,5 x 58,7 mm). */
export function generatePsBadgesPdf(event: PsEventInfo, rows: PsBadgeRow[]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const ML = 18, MT = 11, W = 85.5, H = 58.7, HG = 3.2, VG = 4.6;
  const COLS = 2, ROWS = 4, PER_PAGE = COLS * ROWS;
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));

  for (let p = 0; p < pages; p++) {
    if (p > 0) doc.addPage('a4', 'portrait');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = p * PER_PAGE + r * COLS + c;
        if (idx >= rows.length) break;
        drawBadge(doc, event, rows[idx], ML + c * (W + HG), MT + r * (H + VG), W, H);
      }
    }
  }
  return doc;
}

function drawBadge(doc: jsPDF, event: PsEventInfo, row: PsBadgeRow, x: number, y: number, w: number, h: number) {
  // card
  doc.setDrawColor(210, 214, 220);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');

  // header band
  doc.setFillColor(244, 246, 248);
  doc.roundedRect(x, y, w, 9, 2.5, 2.5, 'F');
  doc.rect(x, y + 6.5, w, 2.5, 'F');
  doc.setDrawColor(226, 229, 234);
  doc.line(x, y + 9, x + w, y + 9);

  // header star mark
  doc.setFillColor(34, 139, 84);
  doc.roundedRect(x + 4, y + 2.6, 3.8, 3.8, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(45, 52, 60);
  doc.text(truncate(doc, event.name || '', w - 14), x + 10, y + 5.6);

  // "FISCAL"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(130, 137, 146);
  doc.text('FISCAL', x + w / 2, y + 18, { align: 'center' });

  // name
  const name = row.collaborator_name || '';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 24, 30);
  const size = fit(doc, name, w - 10, 14, 7);
  doc.setFontSize(size);
  doc.text(name, x + w / 2, y + 25.5, { align: 'center' });

  // role pill
  const role = (row.role_name || row.assigned_role || '').toUpperCase();
  if (role) {
    doc.setFont('helvetica', 'bold');
    const rs = fit(doc, role, w - 24, 9, 6);
    doc.setFontSize(rs);
    const tw = doc.getTextWidth(role);
    const pw = tw + 10;
    doc.setFillColor(240, 249, 243);
    doc.setDrawColor(180, 220, 195);
    doc.roundedRect(x + (w - pw) / 2, y + 29.5, pw, 7.5, 3.5, 3.5, 'FD');
    doc.setTextColor(30, 120, 70);
    doc.text(role, x + w / 2, y + 34.5, { align: 'center' });
  }

  // location
  const loc = `${row.floor || '-'} / ${row.room || '-'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 106, 115);
  doc.text(loc, x + w / 2, y + 43.5, { align: 'center' });

  // footer
  doc.setDrawColor(226, 229, 234);
  doc.line(x, y + h - 8, x + w, y + h - 8);
  doc.setFontSize(6.5);
  doc.setTextColor(140, 146, 155);
  doc.text(BRAND, x + 4, y + h - 3.2);
  const unit = row.unit || row.institution || row.campus || '';
  if (unit) doc.text(truncate(doc, unit, w / 2 - 6), x + w - 4, y + h - 3.2, { align: 'right' });
}

export interface PsAttendanceRow extends PsBadgeRow {
  pix?: string | null;
  signature_url?: string | null;
  notes?: string | null;
  absent?: boolean;
}

/** Lista de presença — A4 paisagem, com assinaturas já coletadas no sistema. */
export function generatePsAttendancePdf(event: PsEventInfo, rows: PsAttendanceRow[]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const PW = 297, PH = 210;
  const ML = 10, MR = 10;
  const tableW = PW - ML - MR;

  const cols = [
    { key: 'name', label: 'FISCAL', w: 0.16 },
    { key: 'unit', label: 'UNIDADE', w: 0.12 },
    { key: 'role', label: 'FUNÇÃO', w: 0.19 },
    { key: 'floor', label: 'ANDAR', w: 0.08 },
    { key: 'room', label: 'SALA', w: 0.07 },
    { key: 'pix', label: 'PIX', w: 0.12 },
    { key: 'sign', label: 'ASSINATURA', w: 0.16 },
    { key: 'obs', label: 'OBSERVAÇÃO / ALTERAÇÃO', w: 0.10 },
  ].map((c) => ({ ...c, width: c.w * tableW }));

  const sorted = [...rows].sort((a, b) =>
    (a.collaborator_name || '').localeCompare(b.collaborator_name || '', 'pt-BR'));

  let y = 0;
  let page = 0;

  const header = () => {
    page++;
    if (page > 1) doc.addPage('a4', 'landscape');
    y = 12;

    // aviso
    doc.setDrawColor(214, 219, 226);
    doc.setFillColor(250, 251, 252);
    doc.roundedRect(ML, y, tableW, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 76, 85);
    doc.text(
      doc.splitTextToSize(
        'Qualquer alteração de cargo deve ser informada no campo observação/alteração na frente do nome do fiscal. Caso o fiscal não tenha comparecido no Processo Seletivo, escrever "ausente" no campo de observação/alteração.',
        tableW - 6,
      ),
      ML + 3,
      y + 4.5,
    );
    y += 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 24, 30);
    doc.text('LISTA DE FISCAIS', PW / 2, y, { align: 'center' });
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

    // table head
    doc.setFillColor(244, 246, 249);
    doc.setDrawColor(190, 196, 205);
    doc.setLineWidth(0.2);
    doc.rect(ML, y, tableW, 9, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(35, 40, 48);
    let cx = ML;
    cols.forEach((c) => {
      const center = ['sign', 'obs'].includes(c.key);
      const lines = doc.splitTextToSize(c.label, c.width - 4);
      doc.text(lines, center ? cx + c.width / 2 : cx + 2, y + (lines.length > 1 ? 4 : 5.8), {
        align: center ? 'center' : 'left',
      });
      cx += c.width;
      if (c !== cols[cols.length - 1]) doc.line(cx, y, cx, y + 9);
    });
    y += 9;
  };

  header();

  const ROW_H = 16;
  for (const row of sorted) {
    if (y + ROW_H > PH - 16) header();

    doc.setDrawColor(205, 210, 218);
    doc.setLineWidth(0.2);
    doc.rect(ML, y, tableW, ROW_H);

    let cx = ML;
    for (const c of cols) {
      if (c !== cols[0]) doc.line(cx, y, cx, y + ROW_H);

      if (c.key === 'sign') {
        const sig = row.signature_url;
        if (sig && sig.startsWith('data:image')) {
          try {
            const iw = c.width - 6, ih = ROW_H - 4;
            doc.addImage(sig, 'PNG', cx + 3, y + 2, iw, ih, undefined, 'FAST');
          } catch { /* ignore malformed signature */ }
        }
      } else {
        let text = '';
        if (c.key === 'name') text = row.collaborator_name || '';
        else if (c.key === 'unit') text = row.unit || row.institution || row.campus || '';
        else if (c.key === 'role') text = row.role_name || row.assigned_role || '';
        else if (c.key === 'floor') text = row.floor || '-';
        else if (c.key === 'room') text = row.room || '-';
        else if (c.key === 'pix') text = row.pix || '—';
        else if (c.key === 'obs') text = row.absent ? 'AUSENTE' : (row.notes || '');

        doc.setFont('helvetica', c.key === 'name' ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 35, 42);
        const lines = doc.splitTextToSize(text, c.width - 4).slice(0, 3);
        const startY = y + ROW_H / 2 - ((lines.length - 1) * 3.2) / 2 + 1;
        lines.forEach((line: string, i: number) => doc.text(line, cx + 2, startY + i * 3.2));
      }
      cx += c.width;
    }
    y += ROW_H;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 162);
    doc.text(`${BRAND} — Lista de Presença gerada automaticamente`, PW / 2, PH - 8, { align: 'center' });
    doc.text(`${i}/${total}`, PW - MR, PH - 8, { align: 'right' });
  }

  return doc;
}
