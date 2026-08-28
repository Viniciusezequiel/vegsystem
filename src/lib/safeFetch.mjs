/**
 * Returns a fetch callable that never inherits the caller object's receiver.
 * Native browser fetch is bound to globalThis; injected test implementations
 * remain plain calls so mocks keep their existing semantics.
 */
export function createSafeFetch(fetchImpl) {
  const callable = fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (typeof callable !== 'function') throw new TypeError('fetch implementation is required');
  return (...args) => callable(...args);
}
