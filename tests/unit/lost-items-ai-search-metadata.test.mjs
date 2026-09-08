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
});
const normalizeComparableText = (value) => {
  if (!value) return '';
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
};

const isSemanticContainmentMatch = (candidate, container) => {
  const normalizedCandidate = normalizeComparableText(candidate);
  const normalizedContainer = normalizeComparableText(container);
  if (!normalizedCandidate || !normalizedContainer) return false;
  return normalizedContainer.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedContainer);
};

const deduplicateNormalizedTerms = (values) => {
  const unique = [];
  for (const value of values) {
    const cleaned = String(value ?? '').trim();
    if (!cleaned) continue;
    const normalized = normalizeComparableText(cleaned);
    if (!normalized) continue;
    const isDuplicate = unique.some(existing => {
      const existingNormalized = normalizeComparableText(existing);
      return existingNormalized === normalized || existingNormalized.includes(normalized) || normalized.includes(existingNormalized);
    });
    if (isDuplicate) continue;
    unique.push(cleaned);
  }
  return unique;
};

const buildAutoDescription = (suggestion) => {
  const descriptionText = String(suggestion?.description_suggestion ?? '').trim();
  const parts = [];

  const addUniquePart = (input) => {
    const cleaned = String(input ?? '').trim();
    if (!cleaned) return;
    const normalized = normalizeComparableText(cleaned);
    if (!normalized) return;
    if (descriptionText && isSemanticContainmentMatch(cleaned, descriptionText)) return;
    const duplicate = parts.some(part => {
      const normalizedPart = normalizeComparableText(part);
      return normalizedPart === normalized || normalizedPart.includes(normalized) || normalized.includes(normalizedPart);
    });
    if (duplicate) return;
    parts.push(cleaned);
  };

  if (descriptionText) {
    parts.push(descriptionText);
  }

  addUniquePart(suggestion?.product_name);
  addUniquePart(suggestion?.model_variant);
  addUniquePart(suggestion?.brand);
  addUniquePart(suggestion?.primary_color);
  (suggestion?.visible_specs ?? []).forEach(spec => addUniquePart(spec));
  (suggestion?.distinguishing_features ?? []).forEach(feature => addUniquePart(feature));

  return parts.join(' ').trim();
};

test('description_suggestion já contém produto, marca, cor e specs sem duplicação', () => {
  const suggestion = {
    description_suggestion: 'Suplemento Ômega 3 Neo Química em frasco azul, 60 cápsulas',
    product_name: 'Ômega 3',
    brand: 'Neo Química',
    primary_color: 'azul',
    visible_specs: ['60 cápsulas'],
    distinguishing_features: ['frasco azul'],
  };

  assert.equal(
    buildAutoDescription(suggestion),
    'Suplemento Ômega 3 Neo Química em frasco azul, 60 cápsulas'
  );
});

test('description_suggestion ausente monta descrição útil com produto, marca, cor e specs', () => {
  const suggestion = {
    description_suggestion: '',
    product_name: 'Ômega 3',
    brand: 'Neo Química',
    primary_color: 'azul',
    visible_specs: ['60 cápsulas'],
    distinguishing_features: ['frasco azul'],
  };

  assert.equal(buildAutoDescription(suggestion), 'Ômega 3 Neo Química azul 60 cápsulas');
});

test('Club de Nuit não duplica nome do produto e da marca', () => {
  const suggestion = {
    description_suggestion: 'Club de Nuit Intense Man',
    product_name: 'Club de Nuit Intense Man',
    brand: 'Club de Nuit',
    primary_color: 'preto',
    visible_specs: ['edicao intensa'],
    distinguishing_features: ['frasco elegante'],
  };

  const result = buildAutoDescription(suggestion);
  assert.equal(result.startsWith('Club de Nuit Intense Man'), true);
  assert.doesNotMatch(result, /Club de Nuit Intense Man Club de Nuit|Club de Nuit Club de Nuit/i);
});

test('metadata deduplica termos com acentos e case diferentes', () => {
  assert.deepEqual(deduplicateNormalizedTerms(['Ômega 3', 'omega 3', 'Neo Química', 'neo quimica']), ['Ômega 3', 'Neo Química']);
});
