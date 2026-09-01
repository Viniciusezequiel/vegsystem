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

export function psPresencePatch(field: 'present' | 'absent', checked: boolean) {
  if (field === 'present') return checked ? { present: true, absent: false } : { present: false };
  return checked ? { absent: true, present: false } : { absent: false };
}
