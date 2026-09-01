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
