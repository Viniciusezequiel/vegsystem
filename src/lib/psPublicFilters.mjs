export function isSelfEvaluationEnabled(event = {}) {
  if (typeof event?.self_evaluation_enabled === 'boolean') {
    return event.self_evaluation_enabled;
  }
  return false;
}

export function filterPublicRoster(rows = [], search = '') {
  const term = search.trim().toLowerCase();
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
