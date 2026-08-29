import assert from 'node:assert/strict';
import test from 'node:test';
import {
  archiveSingleDeliveredItem,
  getAdminActionsButton,
  getStableArchivedFixture,
  prepareArchiveDateRange,
  selectPortalCalendarDate,
} from '../e2e/helpers/archive-delivered-harness.mjs';

const ITEM_UUID = '123e4567-e89b-42d3-a456-426614174000';
const RUN_ID = '__E2E__ARCHIVE';

function pageWithButtons(buttonNames) {
  const clicks = [];
  return {
    clicks,
    getByRole(role, options) {
      assert.equal(role, 'button');
      const matches = buttonNames.filter(name => options.exact
        ? name === options.name
        : String(name).match(options.name));
      return {
        count: async () => matches.length,
        click: async () => {
          if (matches.length !== 1) throw new Error('strict mode violation');
          clicks.push(matches[0]);
        },
      };
    },
  };
}

const checkpoint = overrides => ({
  eligibleItems: [{ uuid: ITEM_UUID, runId: RUN_ID }],
  itemUuid: ITEM_UUID,
  runId: RUN_ID,
  ...overrides,
});

test('somente Ações Admin presente: encontra o botão exato', async () => {
  const page = pageWithButtons(['Ações Admin']);
  await (await getAdminActionsButton(page)).click();
  assert.deepEqual(page.clicks, ['Ações Admin']);
});

test('Ações Admin e Expandir Administração: escolhe somente Ações Admin', async () => {
  const page = pageWithButtons(['Expandir Administração', 'Ações Admin']);
  await (await getAdminActionsButton(page)).click();
  assert.deepEqual(page.clicks, ['Ações Admin']);
});

test('nenhum Ações Admin: falha explicitamente', async () => {
  const page = pageWithButtons(['Expandir Administração']);
  await assert.rejects(getAdminActionsButton(page), error =>
    error.reason === 'button_missing' && error.label === 'Ações Admin' && error.count === 0);
});

test('dois Ações Admin: falha explicitamente', async () => {
  const page = pageWithButtons(['Ações Admin', 'Ações Admin']);
  await assert.rejects(getAdminActionsButton(page), error =>
    error.reason === 'button_ambiguous' && error.label === 'Ações Admin' && error.count === 2);
});

test('quantidade elegível diferente de um não arquiva', async () => {
  const page = pageWithButtons(['Ações Admin', 'Arquivar Entregues']);
  await assert.rejects(
    archiveSingleDeliveredItem({ page, ...checkpoint({ eligibleItems: [] }) }),
    error => error.reason === 'eligible_count_mismatch',
  );
  assert.deepEqual(page.clicks, ['Ações Admin']);
});
test('UUID divergente não arquiva', async () => {
  const page = pageWithButtons(['Ações Admin', 'Arquivar Entregues']);
  await assert.rejects(
    archiveSingleDeliveredItem({
      page,
      ...checkpoint({ eligibleItems: [{ uuid: 'outro-uuid', runId: RUN_ID }] }),
    }),
    error => error.reason === 'item_uuid_mismatch',
  );
  assert.deepEqual(page.clicks, ['Ações Admin']);
});

test('RUN_ID divergente não arquiva', async () => {
  const page = pageWithButtons(['Ações Admin', 'Arquivar Entregues']);
  await assert.rejects(
    archiveSingleDeliveredItem({
      page,
      ...checkpoint({ eligibleItems: [{ uuid: ITEM_UUID, runId: '__E2E__OTHER' }] }),
    }),
    error => error.reason === 'run_id_mismatch',
  );
  assert.deepEqual(page.clicks, ['Ações Admin']);
});

function calendarFixture({ calendars = 1, initialMonth = '2026-08', wrongMonth = false } = {}) {
  let month = initialMonth;
  let open = false;
  let focusedDay = 15;
  const clicks = [];
  const selected = [];
  const label = value => {
    const [year, numericMonth] = value.split('-').map(Number);
    return `${['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][numericMonth - 1]} ${year}`;
  };
  const move = delta => {
    const [year, numericMonth] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, numericMonth - 1 + delta, 1));
    month = date.toISOString().slice(0, 7);
  };
  const pressKey = async key => {
    if (key === 'Shift+PageDown') move(12);
    else if (key === 'Shift+PageUp') move(-12);
    else if (key === 'PageDown') move(1);
    else if (key === 'PageUp') move(-1);
    else if (key === 'ArrowRight') focusedDay += 1;
    else if (key === 'ArrowLeft') focusedDay -= 1;
    else if (key === 'Enter') {
      const [year, numericMonth] = month.split('-').map(Number);
      selected.push(`${String(focusedDay).padStart(2, '0')}/${String(numericMonth).padStart(2, '0')}/${year}`);
      open = false;
      focusedDay = 15;
    }
  };
  const grid = {
    count: async () => open ? calendars : 0,
    filter: () => grid,
    waitFor: async options => { assert.equal(options.state, 'detached'); assert.equal(open, false); },
    getByRole(role, options) {
      assert.equal(role, 'gridcell');
      assert.equal(options.name, '15');
      const button = {
        count: async () => 1,
        focus: async () => {},
        press: pressKey,
      };
      return {
        count: async () => 1,
        evaluate: async () => false,
        locator: selector => { assert.equal(selector, 'button'); return button; },
      };
    },
  };
  const page = {
    keyboard: { press: pressKey },
    getByRole(role, options = {}) {
      assert.equal(role, 'grid');
      if (!options.name) return grid;
      const matchingGrid = {
        ...grid,
        count: async () => open && calendars === 1 && options.name === (wrongMonth ? 'mês incorreto' : label(month)) ? 1 : 0,
        filter: () => matchingGrid,
      };
      return matchingGrid;
    },
  };
  const dialog = {
    getByRole(role, options) {
      assert.equal(role, 'button');
      const isTrigger = options.name === 'De' || options.name === 'Até';
      return {
        count: async () => isTrigger ? 1 : selected.filter(value => value === options.name).length,
        click: async () => { if (!isTrigger) throw new Error('unexpected click'); open = true; clicks.push(options.name); },
      };
    },
  };
  return { page, dialog, clicks, selected };
}

const AUGUST_2026 = new Date(2026, 7, 1);

test('calendário page-scoped fora do dialog seleciona intervalo', async () => {
  const fixture = calendarFixture();
  await prepareArchiveDateRange({ page: fixture.page, dialog: fixture.dialog, startDate: '2026-08-20', endDate: '2026-08-21', initialMonth: AUGUST_2026 });
  assert.deepEqual([...fixture.selected], ['20/08/2026', '21/08/2026']);
});

test('calendário ausente falha explicitamente', async () => {
  const fixture = calendarFixture({ calendars: 0 });
  await assert.rejects(selectPortalCalendarDate({ page: fixture.page, dialog: fixture.dialog, triggerName: 'De', date: '2026-08-20', initialMonth: AUGUST_2026 }), error => error.reason === 'calendar_missing');
});

test('dois calendários visíveis falham explicitamente', async () => {
  const fixture = calendarFixture({ calendars: 2 });
  await assert.rejects(selectPortalCalendarDate({ page: fixture.page, dialog: fixture.dialog, triggerName: 'De', date: '2026-08-20', initialMonth: AUGUST_2026 }), error => error.reason === 'calendar_ambiguous');
});

test('dia correto é selecionado somente após validar o mês correto', async () => {
  const fixture = calendarFixture();
  await selectPortalCalendarDate({ page: fixture.page, dialog: fixture.dialog, triggerName: 'De', date: '2026-09-10', initialMonth: AUGUST_2026 });
  assert.deepEqual([...fixture.selected], ['10/09/2026']);
});

test('número repetido em mês adjacente não é escolhido arbitrariamente', async () => {
  const fixture = calendarFixture();
  await selectPortalCalendarDate({ page: fixture.page, dialog: fixture.dialog, triggerName: 'De', date: '2026-08-31', initialMonth: AUGUST_2026 });
  assert.deepEqual([...fixture.selected], ['31/08/2026']);
});

test('mês e ano incorretos impedem a seleção', async () => {
  const fixture = calendarFixture({ wrongMonth: true });
  await assert.rejects(selectPortalCalendarDate({ page: fixture.page, dialog: fixture.dialog, triggerName: 'De', date: '2026-08-20', initialMonth: AUGUST_2026 }), error => error.reason === 'month_year_mismatch');
  assert.equal(fixture.selected.length, 0);
});

test('preparação do período nunca clica no arquivamento final', async () => {
  const fixture = calendarFixture();
  await prepareArchiveDateRange({ page: fixture.page, dialog: fixture.dialog, startDate: '2026-08-20', endDate: '2026-08-20', initialMonth: AUGUST_2026 });
  assert.deepEqual(fixture.clicks, ['De', 'Até']);
});

function archivedListFixture(counts) {
  let read = 0;
  const loadingWaits = [];
  const fixtureWaits = [];
  const fixture = {
    count: async () => counts[read],
    waitFor: async options => {
      fixtureWaits.push(options);
      if (counts[read] === 0) throw new Error('timeout');
    },
  };
  const page = {
    reload: async () => { read += 1; },
    getByText(text, options) {
      assert.equal(options.exact, true);
      if (text === 'Carregando...') {
        return { waitFor: async waitOptions => { loadingWaits.push(waitOptions); assert.equal(waitOptions.state, 'hidden'); } };
      }
      assert.equal(text, RUN_ID);
      return fixture;
    },
  };
  return { page, fixture, loadingWaits, fixtureWaits };
}

test('fixture arquivada aguarda loading e permanece única após refresh', async () => {
  const setup = archivedListFixture([1, 1]);
  const fixture = await getStableArchivedFixture({ page: setup.page, runId: RUN_ID });
  assert.equal(fixture, setup.fixture);
  assert.equal(setup.loadingWaits.length, 2);
  assert.equal(setup.fixtureWaits.length, 2);
});

test('fixture arquivada ausente falha explicitamente', async () => {
  const setup = archivedListFixture([0]);
  await assert.rejects(getStableArchivedFixture({ page: setup.page, runId: RUN_ID }), error => error.reason === 'archive_fixture_missing');
});

test('fixture arquivada duplicada falha explicitamente', async () => {
  const setup = archivedListFixture([2]);
  await assert.rejects(getStableArchivedFixture({ page: setup.page, runId: RUN_ID }), error => error.reason === 'archive_fixture_ambiguous' && error.count === 2);
});
