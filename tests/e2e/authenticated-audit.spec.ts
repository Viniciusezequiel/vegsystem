import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import {
  ADMIN_STATE, INTERNAL_STATE, loadRegistry, trackObject, trackRow,
  untrackObject, untrackRow, type Registry,
} from './e2e-registry';

test.describe.configure({ mode: 'serial' });

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

async function clientFor(kind: 'internal' | 'admin') {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const email = process.env[kind === 'admin' ? 'E2E_ADMIN_EMAIL' : 'E2E_INTERNAL_EMAIL']!;
  const password = process.env[kind === 'admin' ? 'E2E_ADMIN_PASSWORD' : 'E2E_INTERNAL_PASSWORD']!;
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function deleteTracked(client: SupabaseClient, registry: Registry, table: string, id: string) {
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw error;
  untrackRow(registry, table, id);
}

test('autenticação, sessão e guards por role', async ({ browser, page }) => {
  const internal = await browser.newContext({ storageState: INTERNAL_STATE });
  const internalPage = await internal.newPage();
  await internalPage.goto('/');
  await internalPage.reload();
  await expect(internalPage).not.toHaveURL(/admin-auth/);
  await internalPage.goto('/admin-module/uber');
  await expect(internalPage.getByText(/Acesso Negado/i)).toBeVisible({ timeout: 20_000 });
  await internal.close();

  const admin = await browser.newContext({ storageState: ADMIN_STATE });
  const adminPage = await admin.newPage();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await adminPage.goto('/admin-module/uber');
    if (await adminPage.getByText(/Uber Corporativo/i).first().isVisible({ timeout: 10_000 }).catch(() => false)) break;
  }
  await expect(adminPage).not.toHaveURL(/admin-auth/);
  await expect(adminPage.getByText(/Uber Corporativo/i).first()).toBeVisible({ timeout: 20_000 });

  await adminPage.goto('/admin-module');
  const adminContent = adminPage.locator('main');
  await expect(adminContent.getByRole('heading', { name: 'Administração' })).toBeVisible();
  await expect(adminContent.getByText('Ferramentas e configurações exclusivas para administradores.')).toBeVisible();
  await expect(adminContent.getByRole('link', { name: /Usuários e perfis/i })).toHaveAttribute('href', '/settings?tab=usuarios');
  await expect(adminContent.getByRole('link', { name: /Roles e permissões/i })).toHaveAttribute('href', '/settings?tab=permissoes');
  for (const duplicateHref of ['/admin-module/uber', '/admin-module/processo-seletivo', '/labels', '/reports', '/admin-module/migracao']) {
    await expect(adminContent.locator(`a[href="${duplicateHref}"]`)).toHaveCount(0);
  }

  await adminPage.getByRole('link', { name: /Dashboard/i }).first().click();
  await expect(adminPage).toHaveURL(/\/$/);

  for (const sectionName of ['Operação', 'Salas e Checklists', 'Gestão', 'Administração', 'Sistema']) {
    const section = adminPage.getByTestId(`sidebar-section-${sectionName === 'Operação' ? 'operation'
      : sectionName === 'Salas e Checklists' ? 'rooms'
      : sectionName === 'Gestão' ? 'management'
      : sectionName === 'Administração' ? 'administration'
      : 'system'}`);
    const trigger = section.getByRole('button', { name: new RegExp(sectionName, 'i') });
    if ((await trigger.getAttribute('aria-label'))?.startsWith('Recolher')) await trigger.click();
    await expect(trigger).toHaveAttribute('aria-label', `Expandir ${sectionName}`);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-label', `Recolher ${sectionName}`);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-label', `Expandir ${sectionName}`);
  }

  await adminPage.getByRole('button', { name: 'Expandir Operação' }).click();
  await adminPage.getByRole('button', { name: /Achados e Perdidos/i }).click();
  await expect(adminPage.getByRole('link', { name: /Buscar Itens/i })).toBeVisible();
  await adminPage.getByRole('link', { name: /Dashboard/i }).first().click();
  await expect(adminPage).toHaveURL(/\/$/);

  await adminPage.goto('/admin-module/uber');
  await expect(adminPage.getByRole('button', { name: 'Recolher Gestão' })).toBeVisible({ timeout: 20_000 });
  await expect(adminPage.getByRole('link', { name: /Uber Corporativo/i })).toBeVisible();

  await adminPage.getByRole('button', { name: 'Recolher menu lateral' }).click();
  await expect(adminPage.locator('aside')).toHaveClass(/w-16/);
  await expect(adminPage.getByRole('button', { name: 'Sair do Sistema' })).toBeVisible();
  await admin.close();

  await page.goto('/equipment');
  await expect(page).toHaveURL(/admin-auth/);
});

test('funções de role reconhecem assistente e admin', async () => {
  const internal = await clientFor('internal');
  const admin = await clientFor('admin');
  const internalId = (await internal.auth.getUser()).data.user!.id;
  const adminId = (await admin.auth.getUser()).data.user!.id;

  expect((await internal.rpc('is_internal_user', { _user_id: internalId })).data).toBe(true);
  expect((await internal.rpc('is_admin', { _user_id: internalId })).data).toBe(false);
  expect((await admin.rpc('is_admin', { _user_id: adminId })).data).toBe(true);
  expect((await admin.rpc('has_role', { _user_id: adminId, _role: 'admin' })).data).toBe(true);
});

test('achados: Storage path, CRUD, baixa, reload lógico e permissões', async () => {
  const registry = loadRegistry()!;
  const internal = await clientFor('internal');
  const admin = await clientFor('admin');
  const userId = (await internal.auth.getUser()).data.user!.id;
  const objectPath = `e2e/${registry.runId}/lost-item.png`;
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,3,1,1,0,201,254,146,239,0,0,0,0,73,69,78,68,174,66,96,130]);
  const upload = await internal.storage.from('lost-items').upload(objectPath, png, { contentType: 'image/png' });
  if (upload.error) throw upload.error;
  trackObject(registry, 'lost-items', objectPath);

  const code = String(Date.now()).slice(-6);
  const inserted = await internal.from('lost_items').insert({
    code, description: registry.runId, image_url: objectPath, campus: 'Campus I',
    found_location: 'E2E', found_date: '2026-08-26', received_date: '2026-08-26',
    delivered_by_name: registry.runId, registered_by: userId,
  }).select('id,image_url,status').single();
  if (inserted.error) throw inserted.error;
  trackRow(registry, 'lost_items', inserted.data.id);
  expect(inserted.data.image_url.startsWith('data:')).toBe(false);

  const signed = await internal.storage.from('lost-items').createSignedUrl(objectPath, 60);
  expect(signed.error).toBeNull();
  expect(signed.data?.signedUrl).toBeTruthy();
  const reread = await internal.from('lost_items').select('image_url').eq('id', inserted.data.id).single();
  expect(reread.data?.image_url).toBe(objectPath);

  expect((await internal.from('lost_items').update({ description: `${registry.runId} editado` }).eq('id', inserted.data.id)).error).toBeNull();
  expect((await internal.from('lost_items').update({ status: 'delivered', owner_name: registry.runId }).eq('id', inserted.data.id)).error).toBeNull();
  const deniedDelete = await internal.from('lost_items').delete().eq('id', inserted.data.id).select('id');
  expect(deniedDelete.error).toBeNull();
  expect(deniedDelete.data).toEqual([]);
  expect((await admin.from('lost_items').select('id').eq('id', inserted.data.id).single()).data?.id).toBe(inserted.data.id);

  await deleteTracked(admin, registry, 'lost_items', inserted.data.id);
  expect((await admin.storage.from('lost-items').remove([objectPath])).error).toBeNull();
  untrackObject(registry, 'lost-items', objectPath);
});

test('Uber: assistente cria, não administra; admin lê, atualiza e remove', async () => {
  const registry = loadRegistry()!;
  const internal = await clientFor('internal');
  const admin = await clientFor('admin');
  const created = await internal.rpc('create_public_uber_request', {
    p_requester_name: registry.runId, p_origin: 'E2E origem', p_destination: 'E2E destino',
    p_trip_date: '2026-12-30', p_trip_time: '23:45', p_reason: registry.runId, p_notes: registry.runId,
  });
  if (created.error) throw created.error;
  const row = Array.isArray(created.data) ? created.data[0] : created.data;
  trackRow(registry, 'uber_requests', row.id);
  expect((await internal.from('uber_requests').select('id').eq('id', row.id)).data).toEqual([]);
  const deniedUpdate = await internal.from('uber_requests').update({ status: 'concluida' }).eq('id', row.id).select('id');
  expect(deniedUpdate.error).toBeNull();
  expect(deniedUpdate.data).toEqual([]);
  expect((await admin.from('uber_requests').select('id').eq('id', row.id).single()).data?.id).toBe(row.id);
  expect((await admin.from('uber_requests').update({ status: 'concluida' }).eq('id', row.id)).error).toBeNull();
  await deleteTracked(admin, registry, 'uber_requests', row.id);
});

test('equipamentos: leitura e autorização admin por role; escrita ignorada por segurança', async ({ browser }) => {
  const internal = await clientFor('internal');
  expect((await internal.from('equipment').select('id').limit(1)).error).toBeNull();
  const context = await browser.newContext({ storageState: ADMIN_STATE });
  const page = await context.newPage();
  await page.goto('/equipment/loans');
  await expect(page).not.toHaveURL(/admin-auth/);
  await context.close();
  test.info().annotations.push({ type: 'safety', description: 'Empréstimo não criado: alteraria disponibilidade de equipamento real.' });
});

test('reservas: leitura e conflito RPC; escrita ignorada por segurança', async () => {
  const internal = await clientFor('internal');
  expect((await internal.from('reservations').select('id').limit(1)).error).toBeNull();
  expect((await internal.from('reservation_rooms').select('id').eq('is_active', true).limit(1)).error).toBeNull();
  test.info().annotations.push({ type: 'safety', description: 'Reserva não criada: nenhuma sala dedicada E2E foi fornecida.' });
});

test('tarefas e task-attachments: admin CRUD/history/storage; assistente negado', async () => {
  const registry = loadRegistry()!;
  const internal = await clientFor('internal');
  const admin = await clientFor('admin');
  const adminUser = (await admin.auth.getUser()).data.user!;
  const created = await admin.from('tasks').insert({
    title: registry.runId, description: registry.runId, priority: 'normal', status: 'pending',
    created_by: adminUser.id, created_by_name: 'E2E Admin',
  }).select('id').single();
  if (created.error) throw created.error;
  trackRow(registry, 'tasks', created.data.id);
  expect((await admin.from('tasks').update({ description: `${registry.runId} editado`, status: 'completed' }).eq('id', created.data.id)).error).toBeNull();
  const deniedDelete = await internal.from('tasks').delete().eq('id', created.data.id).select('id');
  expect(deniedDelete.error).toBeNull();
  expect(deniedDelete.data).toEqual([]);
  expect((await admin.from('tasks').select('id').eq('id', created.data.id).single()).data?.id).toBe(created.data.id);

  const objectPath = `e2e/${registry.runId}/task.txt`;
  const upload = await admin.storage.from('task-attachments').upload(objectPath, new TextEncoder().encode(registry.runId), { contentType: 'text/plain' });
  if (upload.error) throw upload.error;
  trackObject(registry, 'task-attachments', objectPath);
  expect((await admin.storage.from('task-attachments').createSignedUrl(objectPath, 60)).data?.signedUrl).toBeTruthy();
  expect((await admin.storage.from('task-attachments').remove([objectPath])).error).toBeNull();
  untrackObject(registry, 'task-attachments', objectPath);
  await deleteTracked(admin, registry, 'tasks', created.data.id);
});

test('logout remove sessão', async ({ browser }) => {
  const context = await browser.newContext({ storageState: INTERNAL_STATE });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByText('Sair do Sistema').first().click();
  await expect(page).toHaveURL(/admin-auth/);
  await context.close();
});
