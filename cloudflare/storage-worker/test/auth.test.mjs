import test from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken, validateClaims } from '../src/auth.mjs';

const env = { SUPABASE_URL: 'https://project.supabase.co' };

test('bearer estrito', () => {
  assert.equal(bearerToken(new Request('https://worker.test')), null);
  assert.equal(bearerToken(new Request('https://worker.test', { headers: { authorization: 'Bearer abc.def.ghi' } })), 'abc.def.ghi');
  assert.equal(bearerToken(new Request('https://worker.test', { headers: { authorization: 'Basic abc' } })), null);
});

test('claims exigem issuer, audience, role, sub, session e expiração', () => {
  const valid = { iss: 'https://project.supabase.co/auth/v1', aud: 'authenticated', role: 'authenticated', sub: 'u1', session_id: 's1', exp: 2000 };
  assert.equal(validateClaims(valid, env, 1000).sub, 'u1');
  for (const change of [
    { role: 'anon' }, { aud: 'anon' }, { iss: 'https://evil.test' }, { sub: '' }, { session_id: '' }, { exp: 999 },
  ]) assert.throws(() => validateClaims({ ...valid, ...change }, env, 1000));
});
