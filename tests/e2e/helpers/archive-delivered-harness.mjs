export class ArchiveDeliveredHarnessError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ArchiveDeliveredHarnessError';
    Object.assign(this, details);
  }
}

async function requireExactlyOne(locator, label) {
  const count = await locator.count();
  if (count !== 1) {
    throw new ArchiveDeliveredHarnessError(
      `Expected exactly one ${label} button, found ${count}.`,
      { reason: count === 0 ? 'button_missing' : 'button_ambiguous', label, count },
    );
  }
  return locator;
}

export async function getAdminActionsButton(page) {
  return requireExactlyOne(
    page.getByRole('button', { name: 'Ações Admin', exact: true }),
    'Ações Admin',
  );
}

function assertArchiveCheckpoint({ eligibleItems, itemUuid, runId }) {
  if (!Array.isArray(eligibleItems) || eligibleItems.length !== 1) {
    throw new ArchiveDeliveredHarnessError(
      `Expected exactly one eligible item, found ${eligibleItems?.length ?? 'invalid'}.`,
      { reason: 'eligible_count_mismatch', count: eligibleItems?.length ?? null },
    );
  }

  const [eligible] = eligibleItems;
  if (eligible.uuid !== itemUuid) {
    throw new ArchiveDeliveredHarnessError('Eligible item UUID does not match ITEM_UUID.', {
      reason: 'item_uuid_mismatch', expected: itemUuid, actual: eligible.uuid,
    });
  }
  if (eligible.runId !== runId) {
    throw new ArchiveDeliveredHarnessError('Eligible item RUN_ID does not match.', {
      reason: 'run_id_mismatch', expected: runId, actual: eligible.runId,
    });
  }
}

export async function archiveSingleDeliveredItem({ page, eligibleItems, itemUuid, runId }) {
  const adminActions = await getAdminActionsButton(page);
  await adminActions.click();

  const archiveDelivered = await requireExactlyOne(
    page.getByRole('button', { name: 'Arquivar Entregues', exact: true }),
    'Arquivar Entregues',
  );

  // This is deliberately adjacent to the irreversible UI action.
  assertArchiveCheckpoint({ eligibleItems, itemUuid, runId });
  await archiveDelivered.click();
}
