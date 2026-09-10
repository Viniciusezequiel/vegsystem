export const PS_JOURNEY_OPTIONS = Object.freeze([
  { key: '4h', label: '4h', rateField: 'pay_value_4h' },
  { key: '6h', label: '6h', rateField: 'pay_value_6h' },
  { key: '7h', label: '7h', rateField: 'pay_value_7h' },
  { key: '8h', label: '8h', rateField: 'pay_value_8h' },
  { key: '9h', label: '9h', rateField: 'pay_value_9h' },
  { key: 'integral', label: 'Integral', rateField: 'pay_value_integral' },
]);

export function normalizePsJourneyKey(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (['integral', 'horario integral', 'horário integral', 'dia inteiro'].includes(raw)) return 'integral';
  const match = raw.match(/\b(4|6|7|8|9)\s*h(?:oras?)?\b/);
  return match ? `${match[1]}h` : null;
}

export function resolvePsRoleRate(role, journeyKey) {
  const option = PS_JOURNEY_OPTIONS.find(item => item.key === journeyKey);
  if (!option || !role) return null;
  const value = role[option.rateField];
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function inferPsJourneyFromPay(role, payValue) {
  const pay = Number(payValue);
  if (!role || !Number.isFinite(pay)) return null;
  const matches = PS_JOURNEY_OPTIONS.filter(option => {
    const rate = resolvePsRoleRate(role, option.key);
    return rate !== null && Math.abs(rate - pay) < 0.005;
  });
  // Prefer 8h when legacy pay_value equals the default and more than one band shares a value.
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
  const role = roles.find(item => item.value === link.role_value)
    || roles.find(item => String(item.name || '').trim().toLocaleLowerCase('pt-BR') === String(link.role_name || link.assigned_role || '').trim().toLocaleLowerCase('pt-BR'));
  const payValue = Number(link.pay_value || 0);
  return {
    role_value: link.role_value || role?.value || null,
    role_name: link.role_name || link.assigned_role || role?.name || 'Função não informada',
    journey_key: inferPsJourneyFromPay(role, payValue),
    work_schedule: link.work_schedule || null,
    pay_value: payValue,
    is_primary: true,
    source: 'legacy',
  };
}
