export function isSelfEvaluationEnabled(event = {}) {
  if (event?.status === 'finalizado') return false;
  if (event?.hidden_from_evaluation === true) return false;
  if (typeof event?.self_evaluation_enabled === 'boolean') {
    return event.self_evaluation_enabled;
  }
  return false;
}

export function filterPublicRoster(rows = [], search = '') {
  const term = String(search ?? '').trim().toLowerCase();
  if (!term) return rows;

  return rows.filter((row) => {
    const haystack = [
      row.collaborator_name,
      row.role_name,
      row.assigned_role,
      row.email,
      row.email_masked,
      row.matricula_masked,
      row.sector,
      row.unit,
      row.room,
      row.floor,
      row.building,
      row.campus,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(term);
  });
}
