const R2_LOCATOR = /^r2\/lost-items\/[^?#]+\.webp$/i;

export class R2UploadHarnessError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'R2UploadHarnessError';
    Object.assign(this, details);
  }
}

export function createR2PilotState(runId) {
  return {
    runId,
    itemUuid: null,
    initialR2Locator: null,
    replacementR2Locator: null,
    uploadPhase: 'idle',
    lastUpload: null,
  };
}

function isTargetRequest(request, workerUrl) {
  const expected = new URL('/v1/files/lost-items', `${workerUrl.replace(/\/+$/, '')}/`);
  const actual = new URL(request.url());
  return request.method() === 'POST'
    && actual.origin === expected.origin
    && actual.pathname === expected.pathname;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function telemetry(startedAt, requestAt = null, responseAt = null, status = null) {
  return {
    file_selection_started: new Date(startedAt).toISOString(),
    upload_request_started: requestAt ? new Date(requestAt).toISOString() : null,
    upload_response_received: responseAt ? new Date(responseAt).toISOString() : null,
    upload_http_status: status,
    optimization_to_request_ms: requestAt ? requestAt - startedAt : null,
    request_to_response_ms: requestAt && responseAt ? responseAt - requestAt : null,
  };
}

/**
 * Registers request/response listeners before triggering the UI action.
 * The returned locator is written to state before this function resolves.
 */
export async function captureR2Upload({
  page,
  workerUrl,
  triggerUpload,
  state,
  locatorField,
  preRequestTimeoutMs = 120_000,
  responseTimeoutMs,
  timeoutMs,
}) {
  if (!['initialR2Locator', 'replacementR2Locator'].includes(locatorField)) {
    throw new TypeError('locatorField must identify an explicit pilot locator');
  }

  const networkTimeoutMs = responseTimeoutMs ?? timeoutMs ?? 30_000;
  const startedAt = Date.now();
  let requestAt = null;
  let responseAt = null;
  let observedRequest = null;
  let resolveRequest;
  let resolveResponse;
  const requestPromise = new Promise(resolve => { resolveRequest = resolve; });
  const responsePromise = new Promise(resolve => { resolveResponse = resolve; });
  const onRequest = request => {
    if (observedRequest || !isTargetRequest(request, workerUrl)) return;
    observedRequest = request;
    requestAt = Date.now();
    state.lastUpload = {
      classification: 'pending', phase: 'network', status: null, locator: null,
      telemetry: telemetry(startedAt, requestAt),
    };
    resolveRequest(request);
  };
  const onResponse = response => {
    if (!observedRequest || response.request() !== observedRequest) return;
    responseAt = Date.now();
    resolveResponse(response);
  };

  state.uploadPhase = 'pending';
  state.lastUpload = {
    classification: 'pending', phase: 'pre_request', status: null, locator: null,
    telemetry: telemetry(startedAt),
  };
  page.on('request', onRequest);
  page.on('response', onResponse);

  const triggerPromise = Promise.resolve().then(triggerUpload);
  let response;
  try {
    await withTimeout(Promise.race([
      requestPromise,
      triggerPromise.then(() => new Promise(() => {})),
    ]), preRequestTimeoutMs, 'pre_request_timeout');
  } catch (error) {
    page.off('request', onRequest);
    page.off('response', onResponse);
    state.uploadPhase = 'pre_request_timeout';
    state.lastUpload = {
      classification: 'pre_request_timeout', reason: 'post_not_observed', status: null, locator: null,
      telemetry: telemetry(startedAt),
    };
    throw new R2UploadHarnessError('R2 upload POST was not observed after file selection.', {
      classification: 'pre_request_timeout', reason: 'post_not_observed', cause: error,
    });
  }

  try {
    response = await withTimeout(responsePromise, networkTimeoutMs, 'response_timeout');
  } catch (error) {
    state.uploadPhase = 'indeterminate';
    state.lastUpload = {
      classification: 'response_indeterminate', reason: 'response_timeout', status: null, locator: null,
      telemetry: telemetry(startedAt, requestAt),
    };
    throw new R2UploadHarnessError('R2 upload POST started but its response is unknown; preserve unknown objects.', {
      classification: 'response_indeterminate', reason: 'response_timeout', cause: error,
    });
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
  }

  await triggerPromise;

  const status = response.status();
  const completedTelemetry = telemetry(startedAt, requestAt, responseAt, status);
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    state.uploadPhase = 'indeterminate';
    state.lastUpload = { classification: 'indeterminate', reason: 'invalid_json', status, locator: null, telemetry: completedTelemetry };
    throw new R2UploadHarnessError('R2 upload returned unreadable JSON; outcome is indeterminate.', {
      classification: 'indeterminate', reason: 'invalid_json', status, cause: error,
    });
  }

  if (!response.ok()) {
    const classification = 'rejected';
    state.uploadPhase = classification;
    state.lastUpload = { classification, status, locator: null, errorCode: payload?.error ?? null, telemetry: completedTelemetry };
    throw new R2UploadHarnessError(`R2 upload failed with HTTP ${status}.`, {
      classification, status, errorCode: payload?.error ?? null,
    });
  }

  const locator = payload?.locator;
  if (typeof locator !== 'string' || !R2_LOCATOR.test(locator)) {
    state.uploadPhase = 'indeterminate';
    state.lastUpload = { classification: 'indeterminate', reason: 'invalid_locator', status, locator: null, telemetry: completedTelemetry };
    throw new R2UploadHarnessError('R2 upload response has no valid locator; outcome is indeterminate.', {
      classification: 'indeterminate', reason: 'invalid_locator', status,
    });
  }

  state[locatorField] = locator;
  state.uploadPhase = 'completed';
  state.lastUpload = { classification: 'completed', status, locator, telemetry: completedTelemetry };
  return { status, locator, payload, telemetry: completedTelemetry };
}

export async function cleanupKnownR2Locators({ state, isReferenced, deleteExact }) {
  const locators = [...new Set([state.initialR2Locator, state.replacementR2Locator].filter(Boolean))];
  const results = [];
  for (const locator of locators) {
    if (!R2_LOCATOR.test(locator)) {
      results.push({ locator, action: 'preserved', reason: 'invalid_locator' });
      continue;
    }
    let referenced;
    try { referenced = await isReferenced(locator); }
    catch {
      results.push({ locator, action: 'preserved', reason: 'reference_check_failed' });
      continue;
    }
    if (referenced) {
      results.push({ locator, action: 'preserved', reason: 'referenced' });
      continue;
    }
    await deleteExact(locator);
    results.push({ locator, action: 'deleted' });
  }
  return results;
}

export async function runR2PilotLifecycle({ state, page, context, browser, run, cleanup }) {
  try {
    return await run(state);
  } finally {
    if (state.uploadPhase === 'pending') {
      throw new R2UploadHarnessError('Refusing to close pilot resources while an upload response is pending.', {
        classification: 'pending',
      });
    }
    if (cleanup) {
      await cleanupKnownR2Locators({
        state,
        isReferenced: cleanup.isReferenced,
        deleteExact: cleanup.deleteExact,
      });
    }
    await page?.close?.();
    await context?.close?.();
    await browser?.close?.();
  }
}

export const isValidR2PilotLocator = value => typeof value === 'string' && R2_LOCATOR.test(value);
