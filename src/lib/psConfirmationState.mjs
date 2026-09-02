export const PS_CONFIRMATION_STATUS = Object.freeze({
  pending_confirmation: 'pending_confirmation',
  confirmed: 'confirmed',
  declined: 'declined',
  replaced: 'replaced',
});

const TRANSITIONS = Object.freeze({
  pending_confirmation: new Set(['pending_confirmation', 'confirmed', 'declined', 'replaced']),
  confirmed: new Set(['confirmed', 'declined', 'replaced']),
  declined: new Set(['declined', 'pending_confirmation', 'replaced']),
  replaced: new Set(['replaced']),
});

export function normalizePsConfirmationStatus(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const normalized = raw.toLowerCase();

  if (normalized === 'pending' || normalized === 'pending_confirmation') return PS_CONFIRMATION_STATUS.pending_confirmation;
  if (normalized === 'confirmado' || normalized === 'confirmed') return PS_CONFIRMATION_STATUS.confirmed;
  if (normalized === 'recusado' || normalized === 'declined' || normalized === 'rejected') return PS_CONFIRMATION_STATUS.declined;
  if (normalized === 'substituido' || normalized === 'replaced' || normalized === 'substitution') return PS_CONFIRMATION_STATUS.replaced;

  return PS_CONFIRMATION_STATUS.pending_confirmation;
}

export function canTransitionPsConfirmation(from, to) {
  return TRANSITIONS[normalizePsConfirmationStatus(from)].has(normalizePsConfirmationStatus(to));
}

export function getPsConfirmationStatusLabel(value) {
  const status = normalizePsConfirmationStatus(value);

  const labels = {
    [PS_CONFIRMATION_STATUS.pending_confirmation]: 'Aguardando confirmação',
    [PS_CONFIRMATION_STATUS.confirmed]: 'Confirmado',
    [PS_CONFIRMATION_STATUS.declined]: 'Recusou',
    [PS_CONFIRMATION_STATUS.replaced]: 'Substituído',
  };

  return labels[status] || 'Aguardando confirmação';
}

export function getPsConfirmationSummary(rows = []) {
  const summary = {
    pending_confirmation: 0,
    confirmed: 0,
    declined: 0,
    replaced: 0,
  };

  for (const row of rows) {
    const status = normalizePsConfirmationStatus(row?.participation_status ?? row?.status ?? row?.confirmation_status);
    if (summary[status] !== undefined) summary[status] += 1;
  }

  return summary;
}

export function replacementAssignment(link = {}) {
  return {
    role_value: link.role_value ?? null,
    role_name: link.role_name ?? null,
    assigned_role: link.assigned_role ?? null,
    pay_value: Number(link.pay_value || 0),
    unit: link.unit ?? null,
    building: link.building ?? null,
    floor: link.floor ?? null,
    room: link.room ?? null,
    work_schedule: link.work_schedule ?? null,
  };
}
