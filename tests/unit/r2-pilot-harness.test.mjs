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
const replacementLocator = 'r2/lost-items/2026/08/223e4567-e89b-42d3-a456-426614174000-fedcba9876543210.webp';

function uploadRequest() {
  return { url: () => `${workerUrl}/v1/files/lost-items`, method: () => 'POST' };
}

function response({ status = 201, body = { locator }, request = uploadRequest() } = {}) {
  return {
    url: () => `${workerUrl}/v1/files/lost-items`,
    request: () => request,
    status: () => status,
    ok: () => status >= 200 && status < 300,
    json: async () => body,
  };
}

function pageWithResponse(factory, { requestDelay = 0, responseDelay = 0, emitResponse = true } = {}) {
  let settled = false;
  let scheduled = false;
  const listeners = { request: new Set(), response: new Set() };
  const schedule = () => {
    if (scheduled || !factory || listeners.request.size === 0 || listeners.response.size === 0) return;
    scheduled = true;
    const request = uploadRequest();
    setTimeout(() => {
      for (const listener of listeners.request) listener(request);
      if (!emitResponse) return;
      setTimeout(() => {
        settled = true;
        const result = factory(request);
        for (const listener of listeners.response) listener(result);
      }, responseDelay);
    }, requestDelay);
  };
  return {
    get settled() { return settled; },
    on(event, listener) {
      listeners[event].add(listener);
      schedule();
    },
    off(event, listener) { listeners[event].delete(listener); },
  };
}

test('POST rápido tem resposta e locator capturados', async () => {
  const state = createR2PilotState('__E2E__FAST');
  const result = await captureR2Upload({ page: pageWithResponse(request => response({ request })), workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator' });
  assert.equal(result.status, 201);
  assert.equal(state.initialR2Locator, locator);
  assert.equal(state.uploadPhase, 'completed');
});

test('POST lento mantém o harness aguardando', async () => {
  const state = createR2PilotState('__E2E__SLOW');
  const page = pageWithResponse(request => response({ request }), { responseDelay: 40 });
  let resolved = false;
  const pending = captureR2Upload({ page, workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator', timeoutMs: 200 }).then(() => { resolved = true; });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(resolved, false);
  assert.equal(state.uploadPhase, 'pending');
  await pending;
  assert.equal(page.settled, true);
});

test('cadastro e replace capturam somente os respectivos POSTs', async () => {
  const state = createR2PilotState('__E2E__SEQUENTIAL');
  const listeners = { request: new Set(), response: new Set() };
  const page = {
    on(event, listener) { listeners[event].add(listener); },
    off(event, listener) { listeners[event].delete(listener); },
    emit(event, value) { for (const listener of listeners[event]) listener(value); },
  };

  await captureR2Upload({
    page, workerUrl, state, locatorField: 'initialR2Locator',
    triggerUpload: async () => {
      const request = uploadRequest();
      page.emit('request', request);
      page.emit('response', response({ body: { locator }, request }));
    },
  });

  let replaceResolved = false;
  const replace = captureR2Upload({
    page, workerUrl, state, locatorField: 'replacementR2Locator', timeoutMs: 200,
    triggerUpload: async () => {
      const request = uploadRequest();
      page.emit('request', request);
      setTimeout(() => page.emit('response', response({ body: { locator: replacementLocator }, request })), 30);
    },
  }).then(result => { replaceResolved = true; return result; });

  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(replaceResolved, false);
  assert.equal(state.replacementR2Locator, null);
  const result = await replace;
  assert.equal(result.locator, replacementLocator);
  assert.equal(state.initialR2Locator, locator);
  assert.equal(state.replacementR2Locator, replacementLocator);
  assert.equal(listeners.request.size, 0);
  assert.equal(listeners.response.size, 0);
});

test('response é correlacionada à identidade da request observada', async () => {
  const state = createR2PilotState('__E2E__EXACT_REQUEST');
  const listeners = { request: new Set(), response: new Set() };
  const page = {
    on(event, listener) { listeners[event].add(listener); },
    off(event, listener) { listeners[event].delete(listener); },
    emit(event, value) { for (const listener of listeners[event]) listener(value); },
  };
  const observed = uploadRequest();
  const unrelated = uploadRequest();
  let settled = false;
  const pending = captureR2Upload({
    page, workerUrl, state, locatorField: 'replacementR2Locator', responseTimeoutMs: 100,
    triggerUpload: async () => {
      page.emit('request', observed);
      page.emit('response', response({ request: unrelated, body: { locator } }));
      setTimeout(() => page.emit('response', response({ request: observed, body: { locator: replacementLocator } })), 20);
    },
  }).then(result => { settled = true; return result; });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(settled, false);
  assert.equal((await pending).locator, replacementLocator);
});

test('POST 500 é capturado como rejeição conhecida', async () => {
  const state = createR2PilotState('__E2E__500');
  await assert.rejects(
    captureR2Upload({ page: pageWithResponse(request => response({ status: 500, body: { error: 'internal_error' }, request })), workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator' }),
    error => error.status === 500 && error.classification === 'rejected',
  );
  assert.equal(state.lastUpload.status, 500);
});

test('resposta válida registra locator antes de resolver', async () => {
  const state = createR2PilotState('__E2E__STATE');
  await captureR2Upload({ page: pageWithResponse(request => response({ request })), workerUrl, triggerUpload: async () => {}, state, locatorField: 'replacementR2Locator' });
  assert.equal(state.replacementR2Locator, locator);
  assert.equal(state.lastUpload.locator, locator);
});

test('resposta com locator inválido aborta como indeterminada', async () => {
  const state = createR2PilotState('__E2E__INVALID');
  await assert.rejects(
    captureR2Upload({ page: pageWithResponse(request => response({ body: { locator: 'lost-items/prefixo' }, request })), workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator' }),
    error => error.reason === 'invalid_locator' && error.classification === 'indeterminate',
  );
  assert.equal(state.initialR2Locator, null);
});

test('lifecycle não fecha page antes da resposta lenta', async () => {
  const state = createR2PilotState('__E2E__LIFECYCLE');
  const events = [];
  const page = { ...pageWithResponse(request => response({ request }), { responseDelay: 35 }), close: async () => events.push('page.close') };
  const context = { close: async () => events.push('context.close') };
  const browser = { close: async () => events.push('browser.close') };
  await runR2PilotLifecycle({
    state, page, context, browser,
    run: () => captureR2Upload({ page, workerUrl, triggerUpload: async () => events.push('submit'), state, locatorField: 'initialR2Locator' }).then(() => events.push('response')),
  });
  assert.deepEqual(events, ['submit', 'response', 'page.close', 'context.close', 'browser.close']);
});

test('POST nunca iniciado produz pre_request_timeout antes do fechamento', async () => {
  const state = createR2PilotState('__E2E__TIMEOUT');
  const events = [];
  const page = { ...pageWithResponse(null), close: async () => events.push('page.close') };
  await assert.rejects(
    runR2PilotLifecycle({
      state, page,
      run: () => captureR2Upload({ page, workerUrl, triggerUpload: async () => {}, state, locatorField: 'initialR2Locator', preRequestTimeoutMs: 10, responseTimeoutMs: 10 }),
    }),
    error => error.classification === 'pre_request_timeout' && error.reason === 'post_not_observed',
  );
  assert.equal(state.uploadPhase, 'pre_request_timeout');
  assert.deepEqual(events, ['page.close']);
});

test('POST iniciado sem resposta produz response_indeterminate', async () => {
  const state = createR2PilotState('__E2E__RESPONSE_TIMEOUT');
  const page = pageWithResponse(request => response({ request }), { emitResponse: false });
  await assert.rejects(
    captureR2Upload({ page, workerUrl, triggerUpload: async () => {}, state, locatorField: 'replacementR2Locator', preRequestTimeoutMs: 100, responseTimeoutMs: 10 }),
    error => error.classification === 'response_indeterminate' && error.reason === 'response_timeout',
  );
  assert.equal(state.uploadPhase, 'indeterminate');
  assert.equal(state.lastUpload.telemetry.upload_request_started !== null, true);
  assert.equal(state.lastUpload.telemetry.upload_response_received, null);
});

test('otimização lenta não consome o timeout específico da resposta', async () => {
  const state = createR2PilotState('__E2E__SLOW_OPTIMIZATION');
  const page = pageWithResponse(request => response({ request }), { requestDelay: 60, responseDelay: 2 });
  const result = await captureR2Upload({
    page, workerUrl, triggerUpload: async () => {}, state, locatorField: 'replacementR2Locator',
    preRequestTimeoutMs: 100, responseTimeoutMs: 20,
  });
  assert.equal(result.status, 201);
  assert.equal(result.telemetry.optimization_to_request_ms >= 50, true);
  assert.equal(result.telemetry.request_to_response_ms < 20, true);
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
