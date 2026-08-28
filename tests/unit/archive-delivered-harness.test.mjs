import assert from 'node:assert/strict';
import test from 'node:test';
import {
  archiveSingleDeliveredItem,
  getAdminActionsButton,
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
