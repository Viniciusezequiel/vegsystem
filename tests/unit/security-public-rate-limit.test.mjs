import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902450000_security_public_rate_limit.sql',
    import.meta.url
  ),
  'utf8'
);

const edge = fs.readFileSync(
  new URL(
    '../../supabase/functions/create-classroom-call/index.ts',
    import.meta.url
  ),
  'utf8'
);

test('rate limit público é persistente e protegido', () => {
  assert.match(
    migration,
    /public_api_rate_limits/
  );

  assert.match(
    migration,
    /consume_public_api_rate_limit/
  );

  assert.match(
    migration,
    /FOR UPDATE/
  );

  assert.match(
    migration,
    /REVOKE ALL[\s\S]*anon[\s\S]*authenticated/i
  );

  assert.match(
    migration,
    /TO service_role/
  );
});

test('edge function não depende de contador em memória', () => {
  assert.doesNotMatch(
    edge,
    /new Map/
  );

  assert.doesNotMatch(
    edge,
    /rateLimitMap/
  );

  assert.match(
    edge,
    /consume_public_api_rate_limit/
  );

  assert.match(
    edge,
    /SHA-256/
  );
});

test('endpoint retorna HTTP 429 quando limite é excedido', () => {
  assert.match(
    edge,
    /status:\s*429/
  );

  assert.match(
    edge,
    /Retry-After/
  );
});
