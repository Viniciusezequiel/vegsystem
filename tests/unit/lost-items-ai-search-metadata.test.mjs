import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../../supabase/migrations/20260908190000_lost_items_ai_search_metadata.sql', import.meta.url),
  'utf8'
);

test('migration adiciona search_metadata e preserva algoritmo smart search', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS search_metadata text/i);
  assert.match(migration, /concat_ws\([\s\S]*li\.search_metadata/);
  assert.match(migration, /strong_matches AS \(/);
  assert.match(migration, /fuzzy_matches AS \(/);
  assert.match(migration, /strict_word_similarity/);
  assert.doesNotMatch(migration, /concat_ws\([\s\S]*li\.found_location\s*\)/);
  assert.match(migration, /terço.*terco|terco.*terço|terço\/terco|terco\/terço/i);
  assert.doesNotMatch(migration, /térmica/i);
});
