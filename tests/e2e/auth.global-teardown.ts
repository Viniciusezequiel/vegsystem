import { createClient } from '@supabase/supabase-js';
import { loadRegistry, saveRegistry, untrackObject, untrackRow } from './e2e-registry';

export default async function globalTeardown() {
  const registry = loadRegistry();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!registry || !url || !key || !email || !password) return;

  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError) throw new Error(`Cleanup sem autenticação admin: ${loginError.message}`);

  const tableOrder = ['task_history', 'task_comments', 'tasks', 'uber_requests', 'reservations', 'equipment_loans', 'lost_items_archive', 'lost_items'];
  const failures: string[] = [];
  for (const table of tableOrder) {
    for (const id of [...(registry.rows[table] ?? [])]) {
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) failures.push(`${table}:${id}:${error.message}`);
      else untrackRow(registry, table, id);
    }
  }
  for (const [bucket, paths] of Object.entries(registry.objects)) {
    for (const objectPath of [...paths]) {
      const { error } = await client.storage.from(bucket).remove([objectPath]);
      if (error) failures.push(`${bucket}:${objectPath}:${error.message}`);
      else untrackObject(registry, bucket, objectPath);
    }
  }
  saveRegistry(registry);
  await client.auth.signOut();
  if (failures.length) throw new Error(`Cleanup incompleto:\n${failures.join('\n')}`);
}
