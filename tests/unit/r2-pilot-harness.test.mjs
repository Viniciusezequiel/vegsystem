import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureR2Upload,
  cleanupKnownR2Locators,
  createR2PilotState,
  runR2PilotLifecycle,
} from '../e2e/helpers/r2-upload-harness.mjs';

const workerUrl = 'https://worker.test';
const locator = 'r2/lost-items/2026/08/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.webp';

function response({ status = 201, body = { locator } } = {}) {
  return {
    url: () => `${workerUrl}/v1/files/lost-items`,
    request: () => ({ method: () => 'POST' }),
    status: () => status,
    ok: () => status >= 200 && status < 300,
    json: async () => body,
  };
}

function pageWithResponse(factory, delay = 0) {
  let settled = false;
  return {
    get settled() { return settled; },
    waitForResponse(predicate, { timeout }) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout ${timeout}ms exceeded`)), timeout);
        if (factory) setTimeout(() => {
          const result = factory();
          if (!predicate(result)) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }, delay);
      });
    },
  };
}

test('POST rápido tem resposta e locator capturados', async () => {
  const state = createR2PilotState('__E2E__FAST');
  const result = await captureR2Upload({ page: pageWithResponse(() => response()), workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator' });
  assert.equal(result.status, 201);
  assert.equal(state.initialR2Locator, locator);
  assert.equal(state.uploadPhase, 'completed');
});

test('POST lento mantém o harness aguardando', async () => {
  const state = createR2PilotState('__E2E__SLOW');
  const page = pageWithResponse(() => response(), 40);
  let resolved = false;
  const pending = captureR2Upload({ page, workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator', timeoutMs: 200 }).then(() => { resolved = true; });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(resolved, false);
  assert.equal(state.uploadPhase, 'pending');
  await pending;
  assert.equal(page.settled, true);
});

test('POST 500 é capturado como indeterminado', async () => {
  const state = createR2PilotState('__E2E__500');
  await assert.rejects(
    captureR2Upload({ page: pageWithResponse(() => response({ status: 500, body: { error: 'internal_error' } })), workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator' }),
    error => error.status === 500 && error.classification === 'indeterminate',
  );
  assert.equal(state.lastUpload.status, 500);
});

test('resposta válida registra locator antes de resolver', async () => {
  const state = createR2PilotState('__E2E__STATE');
  await captureR2Upload({ page: pageWithResponse(() => response()), workerUrl, triggerUpload: async () => {}, state, locatorField: 'replacementR2Locator' });
  assert.equal(state.replacementR2Locator, locator);
  assert.equal(state.lastUpload.locator, locator);
});

test('resposta com locator inválido aborta como indeterminada', async () => {
  const state = createR2PilotState('__E2E__INVALID');
  await assert.rejects(
    captureR2Upload({ page: pageWithResponse(() => response({ body: { locator: 'lost-items/prefixo' } })), workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator' }),
    error => error.reason === 'invalid_locator' && error.classification === 'indeterminate',
  );
  assert.equal(state.initialR2Locator, null);
});

test('lifecycle não fecha page antes da resposta lenta', async () => {
  const state = createR2PilotState('__E2E__LIFECYCLE');
  const events = [];
  const page = { ...pageWithResponse(() => response(), 35), close: async () => events.push('page.close') };
  await runR2PilotLifecycle({
    state, page,
    run: () => captureR2Upload({ page, workerUrl, triggerUpload: async () => events.push('submit'), state, locatorField: 'initialR2Locator' }).then(() => events.push('response')),
  });
  assert.deepEqual(events, ['submit', 'response', 'page.close']);
});

test('timeout produz estado indeterminado explícito antes do fechamento', async () => {
  const state = createR2PilotState('__E2E__TIMEOUT');
  const events = [];
  const page = { ...pageWithResponse(null), close: async () => events.push('page.close') };
  await assert.rejects(
    runR2PilotLifecycle({
      state, page,
      run: () => captureR2Upload({ page, workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator', timeoutMs: 10 }),
    }),
    error => error.classification === 'indeterminate' && error.reason === 'timeout',
  );
  assert.equal(state.uploadPhase, 'indeterminate');
  assert.deepEqual(events, ['page.close']);
});

test('cleanup usa somente locators exatos conhecidos, nunca prefixo', async () => {
  const state = createR2PilotState('__E2E__CLEANUP');
  state.initialR2Locator = locator;
  state.replacementR2Locator = locator.replace('123e4567-e89b-42d3-a456-426614174000', '223e4567-e89b-42d3-a456-426614174000');
  const deleted = [];
  const results = await cleanupKnownR2Locators({ state, isReferenced: async () => false, deleteExact: async value => deleted.push(value) });
  assert.deepEqual(deleted, [state.initialR2Locator, state.replacementR2Locator]);
  assert.equal(results.every(result => result.action === 'deleted'), true);
  assert.equal(deleted.some(value => value.endsWith('/') || value.includes('*')), false);
});
