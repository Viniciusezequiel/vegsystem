import { createSafeFetch } from './safeFetch.mjs';

export const R2_LOST_ITEMS_PREFIX = 'r2/lost-items/';

/** Identifies the file provider without changing the stored locator. */
export function getStorageProvider(locator) {
  if (!locator) return 'none';
  return locator.startsWith(R2_LOST_ITEMS_PREFIX) ? 'r2' : 'supabase';
}

/**
 * In-memory capability resolver. It intentionally has no persistent storage and
 * never places the access token in a URL.
 */
export class R2CapabilityResolver {
  constructor({
    workerUrl,
    getAccessToken,
    fetchImpl,
    now = () => Date.now(),
    refreshMarginMs = 30_000,
    batchWindowMs = 40,
    maxBatchSize = 50,
  }) {
    this.workerUrl = String(workerUrl ?? '').replace(/\/+$/, '');
    this.getAccessToken = getAccessToken;
    this.fetchImpl = createSafeFetch(fetchImpl);
    this.now = now;
    this.refreshMarginMs = refreshMarginMs;
    this.batchWindowMs = batchWindowMs;
    this.maxBatchSize = maxBatchSize;
    this.cache = new Map();
    this.inFlight = new Map();
    this.queue = [];
    this.timer = null;
  }

  resolve(locator) {
    if (getStorageProvider(locator) !== 'r2' || !this.workerUrl) return Promise.resolve(null);

    const cached = this.cache.get(locator);
    if (cached && cached.expiresAt - this.refreshMarginMs > this.now()) {
      return Promise.resolve(cached.url);
    }
    if (cached) this.cache.delete(locator);

    const pending = this.inFlight.get(locator);
    if (pending) return pending;

    const promise = new Promise(resolve => {
      this.queue.push({ locator, resolve });
      this.schedule();
    }).finally(() => this.inFlight.delete(locator));
    this.inFlight.set(locator, promise);
    return promise;
  }

  resolveMany(locators) {
    return Promise.all(locators.map(locator => this.resolve(locator)));
  }

  clear() {
    this.cache.clear();
  }

  schedule() {
    if (this.queue.length >= this.maxBatchSize) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, this.batchWindowMs);
    }
  }

  async flush() {
    const batch = this.queue.splice(0, this.maxBatchSize);
    if (!batch.length) return;
    if (this.queue.length) this.schedule();

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        batch.forEach(item => item.resolve(null));
        return;
      }

      const response = await this.fetchImpl(`${this.workerUrl}/v1/files/resolve`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ locators: batch.map(item => item.locator) }),
      });
      if (!response.ok) {
        batch.forEach(item => item.resolve(null));
        return;
      }

      const payload = await response.json();
      const resolved = new Map();
      for (const file of Array.isArray(payload?.files) ? payload.files : []) {
        if (
          getStorageProvider(file?.locator) === 'r2'
          && typeof file?.url === 'string'
          && Number.isFinite(file?.expires_at)
        ) {
          resolved.set(file.locator, {
            url: file.url,
            expiresAt: file.expires_at * 1000,
          });
        }
      }

      for (const item of batch) {
        const entry = resolved.get(item.locator) ?? null;
        if (entry) this.cache.set(item.locator, entry);
        item.resolve(entry?.url ?? null);
      }
    } catch {
      batch.forEach(item => item.resolve(null));
    }
  }
}
