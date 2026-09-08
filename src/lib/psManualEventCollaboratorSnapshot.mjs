export function normalizeCollaboratorSnapshotValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  return value ?? null;
}

export function buildManualEventCollaboratorRow({ eventId, collaboratorId, collaborator, roleValue, roleName, payValue, campus }) {
  const source = collaborator || {};

  return {
    event_id: eventId,
    collaborator_id: collaboratorId ?? null,
    collaborator_name: normalizeCollaboratorSnapshotValue(source.full_name),
    role_value: roleValue ?? null,
    role_name: roleName ?? null,
    pay_value: payValue ?? 0,
    campus: normalizeCollaboratorSnapshotValue(campus),
    sector: normalizeCollaboratorSnapshotValue(source.sector),
    institution: normalizeCollaboratorSnapshotValue(source.institution),
    cpf: normalizeCollaboratorSnapshotValue(source.cpf),
    identity_doc: normalizeCollaboratorSnapshotValue(source.identity_doc),
    email: normalizeCollaboratorSnapshotValue(source.email),
    phone: normalizeCollaboratorSnapshotValue(source.phone),
    mobile: normalizeCollaboratorSnapshotValue(source.mobile),
    pix: normalizeCollaboratorSnapshotValue(source.pix),
  };
}
