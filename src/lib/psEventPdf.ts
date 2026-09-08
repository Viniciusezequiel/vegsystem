import jsPDF from 'jspdf';
import { preparePdfSignatureRows } from './signatureStorageCore.mjs';
import { resolveSignatureDataUrl } from './signatureStorage';

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

export interface PsCandidateBadgeRow {
  full_name: string;
  cpf?: string | null;
  campus?: string | null;
  room?: string | null;
  seat_number?: string | null;
  registration_number?: string | null;
  pcd_type?: string | null;
}

export interface PsEventInfo {
  name: string;
  date?: string | null;
  location?: string | null;
}

export const PS_CANDIDATE_LABEL_SHEET = {
  pageWidth: 215.9,
  pageHeight: 279.4,
  labelWidth: 101.6,
  labelHeight: 33.9,
  columns: 2,
  rows: 7,
  perPage: 14,
  leftMargin: 4,
  topMargin: 21.05,
  horizontalGap: 4.7,
  verticalGap: 0,
} as const;

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

export function generatePsCandidateBadgesPdf(event: PsEventInfo, rows: PsCandidateBadgeRow[]): jsPDF {
  const sheet = PS_CANDIDATE_LABEL_SHEET;
  const doc = new jsPDF({ unit: 'mm', format: [sheet.pageWidth, sheet.pageHeight], orientation: 'portrait' });
  const pages = Math.max(1, Math.ceil(rows.length / sheet.perPage));

  const ensurePhysicalSize = () => {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    if (Math.abs(width - sheet.pageWidth) > 0.1 || Math.abs(height - sheet.pageHeight) > 0.1) {
      throw new Error(`CC182 requires a physical page of ${sheet.pageWidth}x${sheet.pageHeight} mm.`);
    }
  };

  for (let p = 0; p < pages; p++) {
    if (p > 0) doc.addPage([sheet.pageWidth, sheet.pageHeight], 'portrait');
    ensurePhysicalSize();
    for (let r = 0; r < sheet.rows; r++) {
      for (let c = 0; c < sheet.columns; c++) {
        const idx = p * sheet.perPage + r * sheet.columns + c;
        if (idx >= rows.length) break;
        const x = sheet.leftMargin + c * (sheet.labelWidth + sheet.horizontalGap);
        const y = sheet.topMargin + r * sheet.labelHeight;
        drawCandidateBadge(doc, event, rows[idx], x, y, sheet.labelWidth, sheet.labelHeight);
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

function drawCandidateBadge(doc: jsPDF, event: PsEventInfo, row: PsCandidateBadgeRow, x: number, y: number, w: number, h: number) {
  const paddingX = 3.5;
  const paddingY = 2.5;
  const maxTextWidth = w - (paddingX * 2);
  const eventName = truncate(doc, event.name || '', maxTextWidth - 10);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.rect(x, y, w, h, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(70, 77, 86);
  doc.text(eventName, x + paddingX, y + paddingY + 4.5);

  const pcdType = (row.pcd_type || '').trim();
  const shouldDisplayPcd = !!pcdType && pcdType !== 'NORMAL' && pcdType !== 'normal';
  if (shouldDisplayPcd) {
    const label = pcdType.length > 12 ? 'PCD' : pcdType;
    const width = doc.getTextWidth(label) + 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(118, 58, 22);
    doc.text(label, x + w - paddingX - width, y + paddingY + 4.8);
  }

  const name = row.full_name || 'Sem nome';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(18, 24, 35);
  const nameSize = fit(doc, name, maxTextWidth, 10.5, 7.2);
  doc.setFontSize(nameSize);
  doc.text(truncate(doc, name, maxTextWidth), x + w / 2, y + 12.8, { align: 'center' });

  const infoLines: string[] = [];
  const registration = row.registration_number ? `Inscrição: ${row.registration_number}` : null;
  const cpf = row.cpf ? `CPF: ${row.cpf}` : null;
  if (registration) infoLines.push(registration);
  if (cpf) infoLines.push(cpf);

  const locationParts = [
    row.campus ? `Campus ${row.campus}` : null,
    row.room ? `Sala ${row.room}` : null,
    row.seat_number ? `Carteira ${row.seat_number}` : null,
  ].filter(Boolean);
  if (locationParts.length) {
    infoLines.push(locationParts.join(' · '));
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(50, 58, 66);

  const firstLineY = y + 18.5;
  const lineGap = 4.2;
  infoLines.slice(0, 2).forEach((line, index) => {
    const rendered = truncate(doc, line, maxTextWidth);
    doc.text(rendered, x + paddingX, firstLineY + index * lineGap);
  });

  if (infoLines[2]) {
    const rendered = truncate(doc, infoLines[2], maxTextWidth);
    doc.text(rendered, x + paddingX, firstLineY + 8.4);
  }

  doc.setDrawColor(230, 233, 237);
  doc.setLineWidth(0.25);
  doc.line(x + paddingX, y + h - 4.8, x + w - paddingX, y + h - 4.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(128, 136, 146);
  doc.text(BRAND, x + paddingX, y + h - 1.7);
}

export interface PsAttendanceRow extends PsBadgeRow {
  pix?: string | null;
  signature_url?: string | null;
  notes?: string | null;
  absent?: boolean;
}

export interface PsAttendanceClosure {
  campus?: string | null;
  building: string;
  coordinator_name: string;
  signature_url?: string | null;
  signed_at?: string | null;
  present_count?: number;
  absent_count?: number;
  pending_count?: number;
  role_adjustments_count?: number;
  pix_adjustments_count?: number;
}

/** Lista de presença — A4 paisagem, com assinaturas já coletadas no sistema. */
export function generatePsAttendancePdf(
  event: PsEventInfo,
  rows: PsAttendanceRow[],
  closures: PsAttendanceClosure[] = [],
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const PW = 297, PH = 210;
  const ML = 10, MR = 10;
  const tableW = PW - ML - MR;

  const cols = [
    { key: 'name', label: 'FISCAL', w: 0.16 },
    { key: 'unit', label: 'UNIDADE', w: 0.11 },
    { key: 'role', label: 'FUNÇÃO', w: 0.16 },
    { key: 'floor', label: 'ANDAR', w: 0.07 },
    { key: 'room', label: 'SALA', w: 0.06 },
    { key: 'pix', label: 'PIX', w: 0.12 },
    { key: 'sign', label: 'ASSINATURA', w: 0.14 },
    { key: 'obs', label: 'OBSERVAÇÃO / ALTERAÇÃO', w: 0.18 },
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

  const ROW_H = 19;
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
        else if (c.key === 'obs') {
          text = row.absent
            ? (row.notes || 'AUSENTE')
            : (row.notes || '');
        }

        doc.setFont('helvetica', c.key === 'name' ? 'bold' : 'normal');
        doc.setFontSize(c.key === 'obs' ? 6.5 : 7.5);
        doc.setTextColor(30, 35, 42);

        const maxLines = c.key === 'obs' ? 4 : 3;
        const lineHeight = c.key === 'obs' ? 3 : 3.2;
        const lines = doc
          .splitTextToSize(text, c.width - 4)
          .slice(0, maxLines);

        const startY =
          y + ROW_H / 2 -
          ((lines.length - 1) * lineHeight) / 2 +
          1;

        lines.forEach((line: string, i: number) =>
          doc.text(line, cx + 2, startY + i * lineHeight)
        );
      }
      cx += c.width;
    }
    y += ROW_H;
  }

  if (closures.length > 0) {
    let closureY = 12;

    const startClosurePage = () => {
      doc.addPage('a4', 'landscape');
      closureY = 14;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(20, 24, 30);
      doc.text(
        'FECHAMENTO DA PRESENÇA',
        PW / 2,
        closureY,
        { align: 'center' }
      );

      closureY += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(90, 96, 105);
      doc.text(
        event.name || '',
        PW / 2,
        closureY,
        { align: 'center' }
      );

      closureY += 9;
    };

    startClosurePage();

    for (const closure of closures) {
      const CARD_H = 48;

      if (closureY + CARD_H > PH - 16) {
        startClosurePage();
      }

      doc.setDrawColor(205, 210, 218);
      doc.setFillColor(250, 251, 252);
      doc.roundedRect(
        ML,
        closureY,
        tableW,
        CARD_H,
        2,
        2,
        'FD'
      );

      const location = [
        closure.building,
        closure.campus &&
        closure.campus !== closure.building
          ? closure.campus
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(25, 30, 38);
      doc.text(
        location || 'Local',
        ML + 5,
        closureY + 8
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(85, 92, 102);

      doc.text(
        `Presentes: ${closure.present_count ?? 0}`,
        ML + 5,
        closureY + 17
      );

      doc.text(
        `Ausentes: ${closure.absent_count ?? 0}`,
        ML + 42,
        closureY + 17
      );

      doc.text(
        `Pendentes: ${closure.pending_count ?? 0}`,
        ML + 78,
        closureY + 17
      );

      doc.text(
        `Alterações de cargo: ${closure.role_adjustments_count ?? 0}`,
        ML + 5,
        closureY + 24
      );

      doc.text(
        `Alterações de PIX: ${closure.pix_adjustments_count ?? 0}`,
        ML + 52,
        closureY + 24
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(35, 40, 48);
      doc.text(
        `Coordenador: ${closure.coordinator_name || '-'}`,
        ML + 5,
        closureY + 34
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 106, 115);

      const signedAt = closure.signed_at
        ? new Date(closure.signed_at).toLocaleString('pt-BR')
        : '-';

      doc.text(
        `Fechamento realizado em: ${signedAt}`,
        ML + 5,
        closureY + 41
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(95, 100, 108);
      doc.text(
        'ASSINATURA DO COORDENADOR',
        PW - MR - 43,
        closureY + 7,
        { align: 'center' }
      );

      const sig = closure.signature_url;

      if (sig && sig.startsWith('data:image')) {
        try {
          doc.addImage(
            sig,
            'PNG',
            PW - MR - 82,
            closureY + 10,
            78,
            31,
            undefined,
            'FAST'
          );
        } catch {
          // ignora assinatura inválida
        }
      }

      closureY += CARD_H + 5;
    }
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

/** Resolves private R2 signatures only for the explicit PDF operation. */
export async function generatePsAttendancePdfAsync(
  event: PsEventInfo,
  rows: PsAttendanceRow[],
  closures: PsAttendanceClosure[] = [],
  resolveR2Signature = resolveSignatureDataUrl,
): Promise<jsPDF> {
  const prepared = await preparePdfSignatureRows(
    rows,
    resolveR2Signature
  );

  const preparedClosures = await Promise.all(
    closures.map(async (closure) => ({
      ...closure,
      signature_url: closure.signature_url
        ? await resolveR2Signature(closure.signature_url)
        : null,
    }))
  );

  return generatePsAttendancePdf(
    event,
    prepared,
    preparedClosures
  );
}
