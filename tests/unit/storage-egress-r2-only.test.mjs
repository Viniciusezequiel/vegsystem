import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cache = fs.readFileSync(new URL('../../src/lib/lostItemsCache.ts', import.meta.url), 'utf8');
const signed = fs.readFileSync(new URL('../../src/hooks/useSignedImageUrl.ts', import.meta.url), 'utf8');
const storage = fs.readFileSync(new URL('../../src/lib/lostItemStorage.ts', import.meta.url), 'utf8');
const realtime = fs.readFileSync(new URL('../../src/hooks/useRealtimeSubscription.ts', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../../src/components/layout/MainLayout.tsx', import.meta.url), 'utf8');
const lazyItemImage = fs.readFileSync(new URL('../../src/components/items/LazyItemImage.tsx', import.meta.url), 'utf8');
const virtualizedItems = fs.readFileSync(new URL('../../src/components/items/VirtualizedItemsList.tsx', import.meta.url), 'utf8');

test('cache de achados invalida legado e persiste somente locator R2', () => {
  assert.match(cache, /CACHE_VERSION = 4/);
  assert.match(cache, /validateR2LostItemLocator/);
  assert.match(cache, /sanitizeLostItemsCache/);
  assert.doesNotMatch(cache, /getDeletableLostItemImagePath\(value\)/);
});

test('imagem de achados nunca pede signed URL do Supabase para caminho legado', () => {
  assert.match(signed, /defaultBucket === 'lost-items'/);
  assert.match(signed, /getStorageProvider\(storedValue\) !== 'r2'/);
  assert.match(signed, /resolveStorageUrl/);
});

test('novos uploads de achados sao R2-only sem fallback silencioso', () => {
  assert.match(storage, /uploadsFlag: 'true'/);
  assert.match(storage, /supabase_lost_items_upload_disabled/);
  assert.doesNotMatch(storage, /storage\.from\('lost-items'\)\.upload/);
});

test('Realtime global e escopado pela rota e preserva chamados em qualquer tela', () => {
  assert.match(realtime, /GLOBAL_REALTIME_TABLES/);
  assert.match(realtime, /'classroom_calls'/);
  assert.match(realtime, /realtimeTablesForPath\(pathname/);
  assert.match(realtime, /pathname\.startsWith\('\/lost-found'\)/);
  assert.match(realtime, /pathname\.startsWith\('\/equipment'\)/);
  assert.doesNotMatch(realtime, /const allTables: TableName\[]/);
  assert.match(layout, /useGlobalRealtimeSubscription\(location\.pathname\)/);
});


test('lista de achados reutiliza locator R2 sem consultar image_url por card', () => {
  assert.match(virtualizedItems, /storedValue=\{item\.image_url\}/);
  assert.match(lazyItemImage, /storedValue === undefined/);
  assert.match(lazyItemImage, /useLostItemImage\(itemId, shouldFetchStoredValue\)/);
  assert.match(lazyItemImage, /isVisible \? effectiveStoredValue : null/);
});
