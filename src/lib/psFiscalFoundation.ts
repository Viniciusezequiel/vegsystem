export type PsFiscalIdentity = {
  id: string;
  email?: string | null;
  email_normalized?: string | null;
  matricula?: string | null;
  institution?: string | null;
};

export type PsFiscalInput = Omit<PsFiscalIdentity, 'id'> & { full_name?: string | null };

export type PsFiscalResolution =
  | { status: 'matched'; collaboratorId: string; matchedBy: 'email' | 'matricula_institution' }
  | { status: 'ambiguous'; matchedBy: 'email' | 'matricula_institution' | 'identity_conflict'; candidateIds: string[] }
  | { status: 'new' }
  | { status: 'inconsistent'; reason: 'missing_identity' };

export type PsFiscalDecision = PsFiscalResolution & { rowIndex: number; temporaryId?: string };

// Mirrors the SQL classification in ps_sync_imported_evaluators (assigned_role text matching).
export function classifyEvaluatorRole(assignedRole?: string | null): 'coordinator' | 'subcoordinator' | null {
  const role = String(assignedRole ?? '').trim().toLowerCase();
  if (role.includes('sub') && role.includes('coord')) return 'subcoordinator';
  if (role.includes('coord')) return 'coordinator';
  return null;
}

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeNameForMatch(name?: string | null): string {
  return stripDiacritics(String(name ?? ''))
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

export function nameSimilarity(a?: string | null, b?: string | null): number {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (!na || !nb) return 0;
  const distance = levenshteinDistance(na, nb);
  return 1 - distance / Math.max(na.length, nb.length);
}

export type PsNameMatchCandidate = { collaboratorId: string; name: string; exact: boolean; similarity: number };

const PS_NAME_SIMILARITY_THRESHOLD = 0.82;

// Suggests an existing collaborator whose registered name is a close (but not literal) match
// for the sheet name, so coordinators/subcoordinators are never silently merged by name alone.
export function findPossibleNameMatch(
  sheetName: string | null | undefined,
  candidates: { id: string; full_name?: string | null }[],
): PsNameMatchCandidate | null {
  const rawSheet = String(sheetName ?? '').trim().replace(/\s+/g, ' ');
  const normalizedSheet = normalizeNameForMatch(rawSheet);
  if (!normalizedSheet) return null;

  let best: PsNameMatchCandidate | null = null;
  for (const candidate of candidates) {
    const rawCandidate = String(candidate.full_name ?? '').trim().replace(/\s+/g, ' ');
    if (!rawCandidate) continue;
    if (rawCandidate === rawSheet) return null; // literal exact match: proceed normally, no confirmation needed
    const similarity = nameSimilarity(rawSheet, rawCandidate);
    const normalizedEqual = normalizeNameForMatch(rawCandidate) === normalizedSheet;
    if (normalizedEqual || similarity >= PS_NAME_SIMILARITY_THRESHOLD) {
      if (!best || similarity > best.similarity) {
        best = { collaboratorId: candidate.id, name: rawCandidate, exact: normalizedEqual, similarity };
      }
    }
  }
  return best;
}


const normalizedText = (value?: string | null) => {
  const result = String(value ?? '').trim().toLowerCase();
  return result || null;
};

export const normalizeEmail = normalizedText;
export const normalizeMatricula = normalizedText;

export function normalizeInstitution(value?: string | null) {
  const result = String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return result || null;
}

export function resolvePsFiscal(existing: PsFiscalIdentity[], input: PsFiscalInput): PsFiscalResolution {
  const email = normalizeEmail(input.email);
  const matricula = normalizeMatricula(input.matricula);
  const institution = normalizeInstitution(input.institution);
  const emailMatches = email
    ? existing.filter(candidate => normalizeEmail(candidate.email_normalized ?? candidate.email) === email)
    : [];
  const fallbackMatches = matricula && institution
    ? existing.filter(candidate => normalizeMatricula(candidate.matricula) === matricula
      && normalizeInstitution(candidate.institution) === institution)
    : [];

  if (emailMatches.length > 1) {
    return { status: 'ambiguous', matchedBy: 'email', candidateIds: emailMatches.map(item => item.id) };
  }
  if (fallbackMatches.length > 1) {
    return { status: 'ambiguous', matchedBy: 'matricula_institution', candidateIds: fallbackMatches.map(item => item.id) };
  }
  if (emailMatches.length === 1 && fallbackMatches.length === 1 && emailMatches[0].id !== fallbackMatches[0].id) {
    return { status: 'ambiguous', matchedBy: 'identity_conflict', candidateIds: [emailMatches[0].id, fallbackMatches[0].id] };
  }
  if (emailMatches.length === 1) return { status: 'matched', collaboratorId: emailMatches[0].id, matchedBy: 'email' };
  if (fallbackMatches.length === 1) {
    return { status: 'matched', collaboratorId: fallbackMatches[0].id, matchedBy: 'matricula_institution' };
  }
  if (!email && !(matricula && institution)) return { status: 'inconsistent', reason: 'missing_identity' };
  return { status: 'new' };
}

export function planPsFiscalReconciliation(existing: PsFiscalIdentity[], rows: PsFiscalInput[]): PsFiscalDecision[] {
  const candidates = [...existing];
  return rows.map((row, rowIndex) => {
    const resolution = resolvePsFiscal(candidates, row);
    if (resolution.status !== 'new') return { ...resolution, rowIndex };
    const temporaryId = `__new_fiscal_${rowIndex}`;
    candidates.push({ id: temporaryId, email: row.email, matricula: row.matricula, institution: row.institution });
    return { ...resolution, rowIndex, temporaryId };
  });
}

function pickEventImportValue(row: Record<string, any>, aliases: string[]) {
  const keys = Object.keys(row || {});
  const match = aliases.find((alias) =>
    keys.some((key) => String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, '')),
  );
  if (!match) return '';
  const value = row[match];
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeEventImportRow(row: Record<string, any> = {}) {
  const full_name = pickEventImportValue(row, ['NOME', 'NOME COMPLETO', 'NOME DO FISCAL', 'COLABORADOR']) || '';
  const email = pickEventImportValue(row, ['EMAIL', 'E-MAIL', 'E MAIL']) || '';
  const matricula = pickEventImportValue(row, ['MATRICULA', 'MATRÍCULA']) || '';
  const institution = pickEventImportValue(row, ['INSTITUICAO', 'INSTITUIÇÃO', 'INSTITUTO']) || '';
  const unit = pickEventImportValue(row, ['UNIDADE', 'UNIDADE DE ATUACAO', 'UNIDADE DE ATUAÇÃO', 'UNIDADE DE TRABALHO']) || '';
  const sector = pickEventImportValue(row, ['SETOR', 'SETORES']) || '';
  const role_name = pickEventImportValue(row, ['CARGO', 'FUNCAO', 'FUNÇÃO', 'FUNCAO DO EVENTO', 'FUNÇÃO DO EVENTO', 'CARGO/FUNÇÃO']) || '';
  const assigned_role = pickEventImportValue(row, ['ATRIBUICAO', 'ATRIBUIÇÃO', 'ATRIBUICAO OPERACIONAL', 'ATRIBUIÇÃO OPERACIONAL']) || role_name;
  const building = pickEventImportValue(row, ['PREDIO', 'PRÉDIO', 'EDIFICIO', 'EDIFÍCIO']) || '';
  const floor = pickEventImportValue(row, ['ANDAR', 'ANDARES', 'PAVIMENTO']) || '';
  const room = pickEventImportValue(row, ['SALA', 'SALA DE ATUACAO', 'SALA DE ATUAÇÃO', 'LOCAL']) || '';
  const work_schedule = pickEventImportValue(row, ['HORARIO', 'HORÁRIO', 'HORARIO DE ATUACAO', 'HORÁRIO DE ATUAÇÃO', 'HORARIO DE TRABALHO', 'HORÁRIO DE TRABALHO', 'HORA', 'TURNO']) || '';
  const phone = pickEventImportValue(row, ['TELEFONE', 'CELULAR', 'TELEFONE CONTATO']) || '';
  const mobile = pickEventImportValue(row, ['CELULAR', 'WHATSAPP']) || phone;

  return {
    full_name: full_name.trim(),
    email: email.trim() || null,
    phone: phone.trim() || null,
    mobile: mobile.trim() || null,
    matricula: matricula.trim() || null,
    institution: institution.trim() || null,
    role_name: role_name.trim() || null,
    assigned_role: assigned_role.trim() || null,
    unit: unit.trim() || null,
    sector: sector.trim() || null,
    building: building.trim() || null,
    floor: floor.trim() || null,
    room: room.trim() || null,
    work_schedule: work_schedule.trim() || null,
  };
}

export function psPresencePatch(field: 'present' | 'absent', checked: boolean) {
  if (field === 'present') return checked ? { present: true, absent: false } : { present: false };
  return checked ? { absent: true, present: false } : { absent: false };
}
