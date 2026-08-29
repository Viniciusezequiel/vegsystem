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

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const monthName = date => `${PT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
const formDate = date => [date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear()]
  .map((value, index) => index < 2 ? String(value).padStart(2, '0') : String(value))
  .join('/');

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new TypeError('date must use YYYY-MM-DD');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new TypeError('date must be valid');
  return date;
}

async function visibleCalendar(page) {
  // Radix renders this popover under document.body, outside the archive dialog.
  const calendars = page.getByRole('grid').filter({ visible: true });
  const count = await calendars.count();
  if (count !== 1) {
    throw new ArchiveDeliveredHarnessError(
      `Expected exactly one visible calendar, found ${count}.`,
      { reason: count === 0 ? 'calendar_missing' : 'calendar_ambiguous', count },
    );
  }
  return calendars;
}

async function calendarForMonth(page, expected) {
  const calendar = await visibleCalendar(page);
  const expectedName = monthName(expected);
  const matching = page.getByRole('grid', { name: expectedName, exact: true }).filter({ visible: true });
  if (await matching.count() !== 1) {
    throw new ArchiveDeliveredHarnessError(`Visible calendar is not ${expectedName}.`, {
      reason: 'month_year_mismatch', expected: expectedName,
    });
  }
  return calendar;
}

async function uniqueAnchor(calendar) {
  const anchorCell = calendar.getByRole('gridcell', { name: '15', exact: true });
  const count = await anchorCell.count();
  if (count !== 1) {
    throw new ArchiveDeliveredHarnessError(`Expected one current-month day 15, found ${count}.`, {
      reason: 'day_anchor_ambiguous', count,
    });
  }
  const anchorButton = await anchorCell.evaluate(element => element.tagName === 'BUTTON')
    ? anchorCell
    : anchorCell.locator('button');
  if (await anchorButton.count() !== 1) {
    throw new ArchiveDeliveredHarnessError('Current-month day 15 has no unique interactive control.', {
      reason: 'day_anchor_control_ambiguous', count: await anchorButton.count(),
    });
  }
  return anchorButton;
}

export async function selectPortalCalendarDate({ page, dialog, triggerName, date, initialMonth = new Date() }) {
  const target = parseDate(date);
  const expectedFormDate = formDate(target);
  const selectedBefore = await dialog.getByRole('button', { name: expectedFormDate, exact: true }).count();
  const trigger = dialog.getByRole('button', { name: triggerName, exact: true });
  await requireExactlyOne(trigger, triggerName);
  await trigger.click();

  let current = new Date(Date.UTC(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  await calendarForMonth(page, current);
  let monthDelta = (target.getUTCFullYear() - current.getUTCFullYear()) * 12
    + target.getUTCMonth() - current.getUTCMonth();

  while (Math.abs(monthDelta) >= 12) {
    const direction = monthDelta > 0 ? 1 : -1;
    await (await uniqueAnchor(await calendarForMonth(page, current))).press(direction > 0 ? 'Shift+PageDown' : 'Shift+PageUp');
    current = new Date(Date.UTC(current.getUTCFullYear() + direction, current.getUTCMonth(), 1));
    monthDelta -= direction * 12;
    await calendarForMonth(page, current);
  }
  while (monthDelta !== 0) {
    const direction = monthDelta > 0 ? 1 : -1;
    await (await uniqueAnchor(await calendarForMonth(page, current))).press(direction > 0 ? 'PageDown' : 'PageUp');
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + direction, 1));
    monthDelta -= direction;
    await calendarForMonth(page, current);
  }

  const anchor = await uniqueAnchor(await calendarForMonth(page, target));
  const offset = target.getUTCDate() - 15;
  const key = offset > 0 ? 'ArrowRight' : 'ArrowLeft';
  await anchor.focus();
  for (let step = 0; step < Math.abs(offset); step += 1) await page.keyboard.press(key);
  await page.keyboard.press('Enter');

  const selected = dialog.getByRole('button', { name: expectedFormDate, exact: true });
  if (await selected.count() !== selectedBefore + 1) {
    throw new ArchiveDeliveredHarnessError('Selected date was not reflected in the archive form.', {
      reason: 'selected_date_mismatch', expected: expectedFormDate,
    });
  }
  await page.getByRole('grid').filter({ visible: true }).waitFor({ state: 'detached' });
}

export async function prepareArchiveDateRange({ page, dialog, startDate, endDate, initialMonth }) {
  await selectPortalCalendarDate({ page, dialog, triggerName: 'De', date: startDate, initialMonth });
  await selectPortalCalendarDate({ page, dialog, triggerName: 'Até', date: endDate, initialMonth });
}

async function archivedFixtureAfterLoading({ page, runId, timeoutMs }) {
  await page.getByText('Carregando...', { exact: true }).waitFor({ state: 'hidden', timeout: timeoutMs });
  const fixture = page.getByText(runId, { exact: true });
  try {
    await fixture.waitFor({ state: 'visible', timeout: timeoutMs });
  } catch (cause) {
    throw new ArchiveDeliveredHarnessError('Archived fixture did not appear after loading.', {
      reason: 'archive_fixture_missing', runId, cause,
    });
  }
  const count = await fixture.count();
  if (count !== 1) {
    throw new ArchiveDeliveredHarnessError(`Expected exactly one archived fixture, found ${count}.`, {
      reason: count === 0 ? 'archive_fixture_missing' : 'archive_fixture_ambiguous', runId, count,
    });
  }
  return fixture;
}

export async function getStableArchivedFixture({ page, runId, refresh = () => page.reload(), timeoutMs = 30_000 }) {
  await archivedFixtureAfterLoading({ page, runId, timeoutMs });
  await refresh();
  return archivedFixtureAfterLoading({ page, runId, timeoutMs });
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
