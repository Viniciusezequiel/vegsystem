export function normalizeCollaboratorSnapshotValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  return value ?? null;
}

export function buildManualEventCollaboratorRow({ eventId, collaborator, roleValue, roleName, payValue }) {
  const source = collaborator || {};

  return {
    event_id: eventId,
    collaborator_id: source.id ?? null,
    collaborator_name: normalizeCollaboratorSnapshotValue(source.full_name),
    role_value: roleValue ?? null,
    role_name: roleName ?? null,
    pay_value: payValue ?? 0,
    sector: normalizeCollaboratorSnapshotValue(source.sector),
    unit: normalizeCollaboratorSnapshotValue(source.unit),
    institution: normalizeCollaboratorSnapshotValue(source.institution),
    cpf: normalizeCollaboratorSnapshotValue(source.cpf),
    identity_doc: normalizeCollaboratorSnapshotValue(source.identity_doc),
    email: normalizeCollaboratorSnapshotValue(source.email),
    phone: normalizeCollaboratorSnapshotValue(source.phone),
    mobile: normalizeCollaboratorSnapshotValue(source.mobile),
    pix: normalizeCollaboratorSnapshotValue(source.pix),
  };
}
