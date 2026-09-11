export const PS_JOURNEY_OPTIONS = Object.freeze([
  { key: '4h', label: '4h', rateField: 'pay_value_4h', specialRateField: 'pay_value_special_4h' },
  { key: '6h', label: '6h', rateField: 'pay_value_6h', specialRateField: 'pay_value_special_6h' },
  { key: '7h', label: '7h', rateField: 'pay_value_7h', specialRateField: 'pay_value_special_7h' },
  { key: '8h', label: '8h', rateField: 'pay_value_8h', specialRateField: 'pay_value_special_8h' },
  { key: '9h', label: '9h', rateField: 'pay_value_9h', specialRateField: 'pay_value_special_9h' },
  { key: 'integral', label: 'Integral', rateField: 'pay_value_integral', specialRateField: 'pay_value_special_integral' },
]);

export function normalizePsJourneyKey(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (/\b(?:horario|horário)?\s*integral\b/.test(raw)) return 'integral';
  const match = raw.match(/\b0?(4|6|7|8|9)\s*h(?:oras?)?\b/);
  return match ? `${match[1]}h` : null;
}

export function stripPsJourneyFromRoleLabel(value) {
  return String(value ?? '')
    .replace(/\s*[\[(]\s*0?(4|6|7|8|9)\s*h(?:oras?)?\s*[\])]\s*$/i, '')
    .replace(/\s*[-–—]\s*0?(4|6|7|8|9)\s*h(?:oras?)?\s*$/i, '')
    .replace(/\s+0?(4|6|7|8|9)\s*h(?:oras?)?\s*$/i, '')
    .replace(/\s*[-–—]?\s*(?:horário|horario)?\s*integral\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRoleLookup(value) {
  return stripPsJourneyFromRoleLabel(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function findRoleForSnapshot(snapshot, roles = []) {
  if (!snapshot) return null;
  const byValue = roles.find(item => item.value === snapshot.role_value);
  if (byValue) return byValue;

  const candidates = [snapshot.role_name, snapshot.assigned_role, snapshot.role]
    .map(normalizeRoleLookup)
    .filter(Boolean);

  return roles.find(item => candidates.includes(normalizeRoleLookup(item.name))) || null;
}

export function resolvePsRoleRate(role, journeyKey, special = false) {
  const option = PS_JOURNEY_OPTIONS.find(item => item.key === journeyKey);
  if (!option || !role) return null;
  const field = special ? option.specialRateField : option.rateField;
  const value = role[field];
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function inferPsJourneyFromPay(role, payValue) {
  const pay = Number(payValue);
  if (!role || !Number.isFinite(pay)) return null;
  const matches = PS_JOURNEY_OPTIONS.filter(option => {
    const standardRate = resolvePsRoleRate(role, option.key);
    const specialRate = resolvePsRoleRate(role, option.key, true);
    return (standardRate !== null && Math.abs(standardRate - pay) < 0.005)
      || (specialRate !== null && Math.abs(specialRate - pay) < 0.005);
  });
  if (matches.some(option => option.key === '8h')) return '8h';
  return matches[0]?.key ?? null;
}

export function psAssignmentsTotal(assignments = []) {
  return assignments.reduce((sum, assignment) => {
    const value = Number(assignment?.pay_value ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function psAssignmentRoleLabels(assignments = []) {
  return assignments
    .map(assignment => String(assignment?.role_name || '').trim())
    .filter(Boolean);
}

export function psAssignmentDisplayLine(assignment) {
  const role = String(assignment?.role_name || 'Função não informada').trim();
  const journey = String(assignment?.journey_key || '').trim();
  return journey ? `${role} · ${journey === 'integral' ? 'Integral' : journey}` : role;
}

export function buildLegacyAssignment(link, roles = []) {
  if (!link) return null;
  const role = findRoleForSnapshot(link, roles);
  const payValue = Number(link.pay_value ?? 0);
  const rawRoleLabel = link.role_name || link.assigned_role || link.role || '';
  const roleName = role?.name || stripPsJourneyFromRoleLabel(rawRoleLabel) || 'Função não informada';
  const journey = normalizePsJourneyKey(link.journey_key)
    || normalizePsJourneyKey(rawRoleLabel)
    || normalizePsJourneyKey(link.assigned_role)
    || inferPsJourneyFromPay(role, payValue);

  return {
    role_value: role?.value || link.role_value || null,
    role_name: roleName,
    journey_key: journey,
    work_schedule: link.work_schedule || null,
    pay_value: payValue,
    is_primary: link.is_primary ?? true,
    source: link.source || 'legacy',
  };
}

export function hydratePsAssignmentSnapshot(assignment, link, roles = []) {
  const merged = {
    ...(link || {}),
    ...(assignment || {}),
    role_value: assignment?.role_value || link?.role_value || null,
    role_name: assignment?.role_name || link?.role_name || null,
    assigned_role: assignment?.assigned_role || link?.assigned_role || null,
    journey_key: assignment?.journey_key || null,
    work_schedule: assignment?.work_schedule ?? link?.work_schedule ?? null,
    pay_value: assignment?.pay_value ?? link?.pay_value ?? 0,
    is_primary: assignment?.is_primary ?? true,
    source: assignment?.source || link?.source || 'legacy',
  };
  const compatible = buildLegacyAssignment(merged, roles);

  return {
    ...(assignment || {}),
    role_value: compatible?.role_value || merged.role_value || null,
    role_name: compatible?.role_name || merged.role_name || merged.assigned_role || 'Função não informada',
    journey_key: normalizePsJourneyKey(assignment?.journey_key) || compatible?.journey_key || null,
    work_schedule: merged.work_schedule,
    pay_value: Number(merged.pay_value ?? 0),
    is_primary: merged.is_primary,
    source: merged.source,
  };
}
