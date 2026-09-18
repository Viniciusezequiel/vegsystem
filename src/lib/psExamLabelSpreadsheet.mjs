import * as XLSX from 'xlsx';

const normalizeHeader = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const HEADER_ALIASES = {
  process_name: ['processo seletivo', 'processo', 'evento'],
  label_type: ['nome', 'tipo', 'material', 'etiqueta'],
  building: ['predio', 'bloco', 'predio bloco'],
  floor: ['andar', 'pavimento'],
  room: ['sala', 'local'],
};

const locateHeader = (rows) => {
  const limit = Math.min(rows.length, 15);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const normalized = (rows[rowIndex] || []).map(normalizeHeader);
    const found = Object.fromEntries(Object.entries(HEADER_ALIASES).map(([field, aliases]) => [
      field,
      normalized.findIndex((cell) => aliases.includes(cell)),
    ]));
    if (found.process_name >= 0 && found.label_type >= 0 && found.building >= 0 && found.room >= 0) {
      return { rowIndex, columns: found };
    }
  }
  return null;
};

const cleanFloor = (value) => String(value ?? '')
  .trim()
  .replace(/^andar\s*:\s*/i, '')
  .replace(/^andar\s+/i, '');

const normalizeType = (value, sheetName) => {
  const source = String(value || sheetName || '').trim().toUpperCase();
  if (source.includes('RESPOST')) return 'answer_sheet';
  if (source.includes('QUEST')) return 'question_booklet';
  return 'other';
};

export function parsePsExamLabelWorkbook(data) {
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const rows = [];
  const sheets = [];

  workbook.SheetNames.forEach((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
    const header = locateHeader(matrix);
    if (!header) return;

    let count = 0;
    matrix.slice(header.rowIndex + 1).forEach((sourceRow, offset) => {
      const value = (field) => String(sourceRow[header.columns[field]] ?? '').trim();
      const processName = value('process_name');
      const labelName = value('label_type') || sheetName;
      const building = value('building');
      const floor = cleanFloor(value('floor'));
      const room = value('room');
      if (![processName, labelName, building, floor, room].some(Boolean)) return;
      if (!building || !room) return;

      rows.push({
        process_name: processName,
        label_name: labelName.toUpperCase(),
        label_type: normalizeType(labelName, sheetName),
        building,
        floor,
        room,
        source_sheet: sheetName,
        source_row: header.rowIndex + offset + 2,
      });
      count += 1;
    });

    sheets.push({ name: sheetName, count });
  });

  if (!rows.length) {
    throw new Error('Nenhuma etiqueta válida foi encontrada. Confira as colunas Processo Seletivo, Nome, Prédio, Andar e Sala.');
  }

  return { rows, sheets };
}

