import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapability, verifyCapability } from '../src/capability.mjs';

test('capability é vinculada a scope, key e expiração', async () => {
  const secret = '0123456789abcdef0123456789abcdef';
  const now = 2_000_000_000;
  const cap = await createCapability(secret, 'lost-items', 'a.webp', now + 300);
  assert.equal(await verifyCapability(secret, 'lost-items', 'a.webp', String(cap.exp), cap.sig, now), true);
  assert.equal(await verifyCapability(secret, 'lost-items', 'b.webp', String(cap.exp), cap.sig, now), false);
  assert.equal(await verifyCapability(secret, 'lost-items', 'a.webp', String(cap.exp), cap.sig, now + 301), false);
  assert.equal(await verifyCapability(secret, 'lost-items', 'a.webp', String(now + 901), cap.sig, now), false);
  await assert.rejects(() => createCapability('short', 'lost-items', 'a.webp', now + 300));
});
