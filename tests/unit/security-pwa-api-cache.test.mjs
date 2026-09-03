import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vite = fs.readFileSync(
  new URL('../../vite.config.ts', import.meta.url),
  'utf8'
);

const main = fs.readFileSync(
  new URL('../../src/main.tsx', import.meta.url),
  'utf8'
);

test('PWA não mantém cache persistente da API Supabase', () => {
  assert.doesNotMatch(
    vite,
    /cacheName:\s*["']supabase-api["']/
  );

  assert.doesNotMatch(
    vite,
    /supabase.*NetworkFirst/is
  );
});

test('cache legado é removido dos navegadores existentes', () => {
  assert.match(
    main,
    /caches\.delete\(["']supabase-api["']\)/
  );
});
