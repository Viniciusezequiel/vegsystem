import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ignore = fs.readFileSync('.gitignore', 'utf8');
const vercel = fs.readFileSync('vercel.json', 'utf8');
const capacitor = fs.readFileSync(
  'capacitor.config.ts',
  'utf8'
);

test('.env não deve ser versionado novamente', () => {
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
});

test('frontend possui HSTS', () => {
  assert.match(
    vercel,
    /Strict-Transport-Security/
  );

  assert.match(
    vercel,
    /max-age=31536000/
  );
});

test('Capacitor não permite cleartext', () => {
  assert.doesNotMatch(
    capacitor,
    /cleartext:\s*true/
  );

  assert.match(
    capacitor,
    /cleartext:\s*false/
  );
});
