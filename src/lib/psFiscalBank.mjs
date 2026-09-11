export function normalizeFiscalEmail(value) {
  if (value == null) return '';
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, '');
  return normalized || '';
}

export function normalizeFiscalMatricula(value) {
  if (value == null) return '';
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized || '';
}

export function normalizeFiscalInstitution(value) {
  if (value == null) return '';
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized || '';
}

export function isValidFiscalCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

export function normalizeFiscalCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!isValidFiscalCpf(digits)) return '';
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function extractFiscalBankRows(matrix = []) {
  if (!Array.isArray(matrix)) return [];

  const normalizeHeader = (value) => String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

  const headerIndex = matrix.findIndex((row) => {
    if (!Array.isArray(row)) return false;
    const headers = row.map(normalizeHeader);
    return headers.includes('NOME')
      && headers.includes('CPF')
      && (headers.includes('E-MAIL') || headers.includes('EMAIL'));
  });

  if (headerIndex < 0) return [];

  const headerRow = Array.isArray(matrix[headerIndex]) ? matrix[headerIndex] : [];
  const headers = headerRow.map((value, index) => {
    const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
    return normalized || `__COL_${index + 1}`;
  });

  return matrix.slice(headerIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((value) => String(value ?? '').trim() !== ''))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        const value = row[index] ?? '';
        if (!(header in record) || String(record[header] ?? '').trim() === '') {
          record[header] = value;
        }
      });
      return record;
    });
}

export function buildFiscalImportFingerprint(row = {}) {
  const email = normalizeFiscalEmail(row.email);
  const matricula = normalizeFiscalMatricula(row.matricula);
  const institution = normalizeFiscalInstitution(row.institution);
  const fullName = String(row.full_name || '').trim().toLowerCase();
  return [email, matricula, institution, fullName].filter(Boolean).join('|') || `row:${Math.random().toString(16).slice(2)}`;
}

export function dedupeFiscalRows(rows = []) {
  const byKey = new Map();
  const deduped = [];

  for (const row of rows) {
    const source = {
      full_name: String(row.full_name || '').replace(/\s+/g, ' ').trim(),
      cpf: normalizeFiscalCpf(row.cpf),
      email: normalizeFiscalEmail(row.email),
      matricula: normalizeFiscalMatricula(row.matricula),
      institution: normalizeFiscalInstitution(row.institution),
      role: String(row.role || row.role_name || row.cargo || '').trim(),
      notes: String(row.notes || row.observacao || row.observacao_historico || '').trim(),
    };

    if (!source.full_name && !source.email && !source.matricula) continue;

    const key = source.email
      ? `email:${source.email}`
      : source.matricula && source.institution
        ? `matricula:${source.matricula}|institution:${source.institution}`
        : `name:${source.full_name.toLowerCase()}`;

    if (!byKey.has(key)) {
      byKey.set(key, { ...row, ...source, sourceKey: key, id: deduped.length + 1 });
      deduped.push(byKey.get(key));
    } else {
      const existing = byKey.get(key);
      for (const [field, value] of Object.entries({
        cpf: source.cpf || existing.cpf,
        email: source.email || existing.email,
        matricula: source.matricula || existing.matricula,
        institution: source.institution || existing.institution,
        role: source.role || existing.role,
        notes: source.notes || existing.notes,
      })) {
        existing[field] = value;
      }
      existing.full_name = existing.full_name || source.full_name;
    }
  }

  return deduped;
}

export function renderFiscalTemplate(template, variables = {}) {
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value == null ? '' : String(value);
  });
}

export function extractFiscalImportedHistory(rawValue = '') {
  const source = typeof rawValue === 'object' && rawValue !== null ? rawValue : { text: rawValue };
  const text = typeof rawValue === 'string' || typeof rawValue === 'number' ? String(rawValue) : String(source.text || source.notes || source.observations || '');
  const selectionCount = Number(source.selection_count ?? source.historical_selection_count ?? source.imported_selection_count ?? source.selections ?? source['Nº DE SELEÇÕES'] ?? 0) || 0;
  const participationCount = Number(source.participation_count ?? source.historical_participation_count ?? source.imported_participation_count ?? source.participacoes ?? source['PARTICIPAÇÕES EM PROCESSOS SELETIVOS'] ?? 0) || 0;
  const value = text.trim();
  if (!value && !selectionCount && !participationCount) {
    return { observations: '', selection_count: 0, participation_count: 0 };
  }

  const cleaned = value
    .replace(/\s*\[\s*selecao\s*=\s*(\d+)\s*\]/gi, ' ')
    .replace(/\s*\[\s*participacoes\s*=\s*(\d+)\s*\]/gi, ' ');

  const selectionMatch = value.match(/\[\s*selecao\s*=\s*(\d+)\s*\]/i);
  const participationMatch = value.match(/\[\s*participacoes\s*=\s*(\d+)\s*\]/i);
  const observations = cleaned
    .replace(/\s+/g, ' ')
    .trim();

  return {
    observations,
    selection_count: selectionMatch ? Number(selectionMatch[1]) || 0 : selectionCount,
    participation_count: participationMatch ? Number(participationMatch[1]) || 0 : participationCount,
  };
}

export function mergeFiscalImportedHistory(record = {}) {
  const history = extractFiscalImportedHistory(record.imported_history || record.notes || '');
  const current = {
    ...record,
    imported_selection_count: Number(record.imported_selection_count ?? record.historical_selection_count ?? history.selection_count) || 0,
    imported_participation_count: Number(record.imported_participation_count ?? record.historical_participation_count ?? history.participation_count) || 0,
  };

  const notes = [
    String(record.notes || '').trim(),
    history.observations ? `Observação importada: ${history.observations}` : '',
  ].filter(Boolean).join(' | ');

  return {
    ...current,
    notes: notes || null,
  };
}

export function normalizeFiscalImportNote(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';

  const history = extractFiscalImportedHistory(text);
  if (!history.selection_count && !history.participation_count && !history.observations) {
    return text;
  }

  return history.observations || text.replace(/\[\s*selecao\s*=\s*\d+\s*\]/gi, '').replace(/\[\s*participacoes\s*=\s*\d+\s*\]/gi, '').replace(/\s+/g, ' ').trim();
}
