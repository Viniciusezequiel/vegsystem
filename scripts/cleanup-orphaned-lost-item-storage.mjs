import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes('--apply');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Defina VITE_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeReferencedPath(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('r2/')) return null;

  const match = trimmed.match(/\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/?]+)\/(.+?)(?:\?|$)/);
  if (match && match[1] === 'lost-items') return decodeURIComponent(match[2]).replace(/^\/+/, '');

  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, '');
}

async function loadReferencedPaths() {
  const refs = new Set();

  for (const table of ['lost_items', 'lost_items_archive']) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select('image_url')
        .not('image_url', 'is', null)
        .range(offset, offset + 999);

      if (error) throw error;

      for (const row of data || []) {
        const path = normalizeReferencedPath(row.image_url);
        if (path) refs.add(path);
      }

      if (!data || data.length < 1000) break;
    }
  }

  return refs;
}

async function listAllObjects() {
  const objects = [];

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from('lost-items')
      .list('', {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) throw error;
    objects.push(...(data || []));

    if (!data || data.length < 1000) break;
  }

  return objects;
}

const refs = await loadReferencedPaths();
const objects = await listAllObjects();
const orphaned = objects.filter((object) => !refs.has(object.name));
const orphanedBytes = orphaned.reduce((sum, object) => sum + Number(object.metadata?.size || 0), 0);

console.log(JSON.stringify({
  bucket: 'lost-items',
  referenced_supabase_objects: refs.size,
  storage_objects: objects.length,
  orphaned_objects: orphaned.length,
  orphaned_bytes: orphanedBytes,
  orphaned_mb: Number((orphanedBytes / 1024 / 1024).toFixed(2)),
  mode: apply ? 'APPLY' : 'DRY_RUN',
}, null, 2));

if (!orphaned.length) {
  console.log('Nenhum objeto órfão encontrado.');
  process.exit(0);
}

console.log('\nPrimeiros objetos órfãos:');
for (const object of orphaned.slice(0, 20)) {
  console.log(`- ${object.name} (${object.metadata?.size || 0} bytes)`);
}

if (!apply) {
  console.log('\nNenhuma exclusão realizada. Use --apply para remover somente os objetos não referenciados.');
  process.exit(0);
}

for (let i = 0; i < orphaned.length; i += 1000) {
  const batch = orphaned.slice(i, i + 1000).map((object) => object.name);
  const { error } = await supabase.storage.from('lost-items').remove(batch);
  if (error) throw error;
  console.log(`Removidos ${Math.min(i + batch.length, orphaned.length)}/${orphaned.length}`);
}

console.log('Limpeza concluída pelo Storage API.');
