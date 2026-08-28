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

function isTargetUpload(response, workerUrl) {
  const expected = new URL('/v1/files/lost-items', `${workerUrl.replace(/\/+$/, '')}/`);
  const actual = new URL(response.url());
  return response.request().method() === 'POST'
    && actual.origin === expected.origin
    && actual.pathname === expected.pathname;
}

function classifyWaitFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout/i.test(message) ? 'timeout' : 'response_unavailable';
}

/**
 * Registers waitForResponse before triggering the UI action. The returned
 * locator is written to state before this function resolves.
 */
export async function captureR2Upload({
  page,
  workerUrl,
  triggerUpload,
  state,
  locatorField,
  timeoutMs = 30_000,
}) {
  if (!['initialR2Locator', 'replacementR2Locator'].includes(locatorField)) {
    throw new TypeError('locatorField must identify an explicit pilot locator');
  }

  state.uploadPhase = 'pending';
  state.lastUpload = { classification: 'pending', status: null, locator: null };

  const responsePromise = page.waitForResponse(
    response => isTargetUpload(response, workerUrl),
    { timeout: timeoutMs },
  );

  let response;
  try {
    [, response] = await Promise.all([triggerUpload(), responsePromise]);
  } catch (error) {
    const reason = classifyWaitFailure(error);
    state.uploadPhase = 'indeterminate';
    state.lastUpload = { classification: 'indeterminate', reason, status: null, locator: null };
    throw new R2UploadHarnessError('R2 upload outcome is indeterminate; preserve unknown objects.', {
      classification: 'indeterminate', reason, cause: error,
    });
  }

  const status = response.status();
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    state.uploadPhase = 'indeterminate';
    state.lastUpload = { classification: 'indeterminate', reason: 'invalid_json', status, locator: null };
    throw new R2UploadHarnessError('R2 upload returned unreadable JSON; outcome is indeterminate.', {
      classification: 'indeterminate', reason: 'invalid_json', status, cause: error,
    });
  }

  if (!response.ok()) {
    const classification = status >= 500 ? 'indeterminate' : 'rejected';
    state.uploadPhase = classification;
    state.lastUpload = { classification, status, locator: null, errorCode: payload?.error ?? null };
    throw new R2UploadHarnessError(`R2 upload failed with HTTP ${status}.`, {
      classification, status, errorCode: payload?.error ?? null,
    });
  }

  const locator = payload?.locator;
  if (typeof locator !== 'string' || !R2_LOCATOR.test(locator)) {
    state.uploadPhase = 'indeterminate';
    state.lastUpload = { classification: 'indeterminate', reason: 'invalid_locator', status, locator: null };
    throw new R2UploadHarnessError('R2 upload response has no valid locator; outcome is indeterminate.', {
      classification: 'indeterminate', reason: 'invalid_locator', status,
    });
  }

  state[locatorField] = locator;
  state.uploadPhase = 'completed';
  state.lastUpload = { classification: 'completed', status, locator };
  return { status, locator, payload };
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
