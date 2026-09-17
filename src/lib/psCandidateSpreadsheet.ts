import * as XLSX from 'xlsx';

export const PS_CANDIDATE_TEMPLATE_COLUMNS = [
  'PROCESSO SELETIVO',
  'INSCRIÇÃO',
  'CANDIDATO',
  'CELULAR',
  'E-MAIL',
  'IDENTIDADE',
  'CPF',
  'TIPO DE PROVA',
  'CAMPUS',
  'PRÉDIO',
  'SALA',
  'CÓD DE BARRAS',
  'CARTEIRA',
] as const;

export type PsCandidateImportRow = {
  event_id: string;
  process_name: string | null;
  registration_number: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  rg: string | null;
  cpf: string | null;
  exam_type: string | null;
  campus: string | null;
  building: string | null;
  room: string | null;
  barcode: string | null;
  seat_number: string | null;
};

export type PsCandidateImportResult = {
  rows: PsCandidateImportRow[];
  totalRows: number;
  campusCount: number;
  buildingCount: number;
};

export function normalizePsCandidateHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function cleanCell(value: unknown) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function pickCell(row: Record<string, unknown>, aliases: string[], headerTokens: string[] = []) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizePsCandidateHeader(key), value]),
  );

  for (const alias of aliases) {
    const value = normalized.get(normalizePsCandidateHeader(alias));
    if (cleanCell(value)) return cleanCell(value);
  }

  const normalizedTokens = headerTokens.map(normalizePsCandidateHeader);
  for (const [header, value] of normalized) {
    if (normalizedTokens.some((token) => header.includes(token)) && cleanCell(value)) {
      return cleanCell(value);
    }
  }

  return '';
}

export function parsePsCandidateWorkbook(
  workbook: XLSX.WorkBook,
  eventId: string,
): PsCandidateImportResult {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return { rows: [], totalRows: 0, campusCount: 0, buildingCount: 0 };

  // raw:false preserves formatted identifiers (including leading zeroes in CPF/inscrição).
  const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: '',
    raw: false,
  });

  const rows = sourceRows
    .map((row): PsCandidateImportRow => ({
      event_id: eventId,
      process_name: pickCell(row, ['PROCESSO SELETIVO', 'PROCESSO', 'NOME DO PROCESSO']) || null,
      registration_number: pickCell(row, ['INSCRIÇÃO', 'INSCRICAO', 'NÚMERO DE INSCRIÇÃO', 'NUMERO DE INSCRICAO']) || null,
      full_name: pickCell(row, ['CANDIDATO', 'NOME', 'NOME COMPLETO']),
      phone: pickCell(row, ['CELULAR', 'TELEFONE', 'CONTATO']) || null,
      email: pickCell(row, ['E-MAIL', 'EMAIL']) || null,
      rg: pickCell(row, ['IDENTIDADE', 'RG', 'DOCUMENTO DE IDENTIDADE']) || null,
      cpf: pickCell(row, ['CPF', 'DOCUMENTO']) || null,
      exam_type: pickCell(row, ['TIPO DE PROVA', 'TIPO', 'PROVA', 'ESPECIALIDADE']) || null,
      campus: pickCell(
        row,
        ['CAMPUS', 'CAMPUS DE PROVA', 'LOCAL DE PROVA', 'LOCAL', 'UNIDADE', 'UNIDADE DE PROVA', 'LOCAL DE REALIZAÇÃO'],
        ['CAMPUS'],
      ) || null,
      building: pickCell(
        row,
        ['PRÉDIO', 'PREDIO', 'PRÉDIO DE PROVA', 'PREDIO DE PROVA', 'EDIFÍCIO', 'EDIFICIO', 'BLOCO'],
        ['PREDIO', 'EDIFICIO', 'BLOCO'],
      ) || null,
      room: pickCell(row, ['SALA', 'SALA DE PROVA']) || null,
      barcode: pickCell(row, ['CÓD DE BARRAS', 'COD DE BARRAS', 'CÓDIGO DE BARRAS', 'CODIGO DE BARRAS']) || null,
      seat_number: pickCell(row, ['CARTEIRA', 'ASSENTO', 'NÚMERO DA CARTEIRA', 'NUMERO DA CARTEIRA']) || null,
    }))
    .filter((row) => row.full_name);

  return {
    rows,
    totalRows: sourceRows.length,
    campusCount: rows.filter((row) => row.campus).length,
    buildingCount: rows.filter((row) => row.building).length,
  };
}

export async function readPsCandidateSpreadsheet(file: File, eventId: string) {
  const workbook = XLSX.read(await file.arrayBuffer());
  return parsePsCandidateWorkbook(workbook, eventId);
}

export function downloadPsCandidateTemplate() {
  const example = {
    'PROCESSO SELETIVO': 'Residência Médica 2027',
    INSCRIÇÃO: '000805',
    CANDIDATO: 'Maria Silva Souza',
    CELULAR: '(31) 99999-9999',
    'E-MAIL': 'maria.silva@email.com',
    IDENTIDADE: 'MG-12.345.678',
    CPF: '012.345.678-90',
    'TIPO DE PROVA': 'Clínica Médica',
    CAMPUS: 'Campus I',
    PRÉDIO: 'FEA',
    SALA: '501/502',
    'CÓD DE BARRAS': '00080501234567890',
    CARTEIRA: '18',
  };

  const worksheet = XLSX.utils.json_to_sheet([example], {
    header: [...PS_CANDIDATE_TEMPLATE_COLUMNS],
  });
  worksheet['!cols'] = PS_CANDIDATE_TEMPLATE_COLUMNS.map((column) => ({
    wch: Math.max(16, column.length + 3),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidatos');
  XLSX.writeFile(workbook, 'modelo-importacao-candidatos-etiquetas.xlsx');
}
