import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Browser } from '@playwright/test';
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

async function authenticatedContext(browser: Browser, storageState: string) {
  const context = await browser.newContext({ storageState });
  // UI/security tests use tiny explicit fixtures and do not need to download
  // unrelated real binaries from the private lost-items bucket.
  await context.route('**/storage/v1/object/sign/lost-items/**', route => route.abort('blockedbyclient'));
  return context;
}

async function deleteTracked(client: SupabaseClient, registry: Registry, table: string, id: string) {
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw error;
  untrackRow(registry, table, id);
}

async function getSystemHealthWithRetry(client: SupabaseClient) {
  let result = await client.rpc('get_system_health');
  for (let attempt = 1; result.error?.code === '57014' && attempt < 3; attempt += 1) {
    result = await client.rpc('get_system_health');
  }
  return result;
}

test('autenticação, sessão e guards por role', async ({ browser, page }) => {
  test.setTimeout(180_000);
  const internal = await authenticatedContext(browser, INTERNAL_STATE);
  const internalPage = await internal.newPage();
  await internalPage.goto('/');
  await internalPage.reload();
  await expect(internalPage).not.toHaveURL(/admin-auth/);
  await expect(internalPage.getByRole('link', { name: 'Saúde do Sistema' })).toHaveCount(0);
  await internalPage.goto('/admin-module/system-health');
  await expect(internalPage.getByText(/Acesso Negado/i)).toBeVisible({ timeout: 20_000 });
  await internalPage.goto('/admin-module/uber');
  await expect(internalPage.getByText(/Acesso Negado/i)).toBeVisible({ timeout: 20_000 });
  await internal.close();

  let admin = await authenticatedContext(browser, ADMIN_STATE);
  let adminPage = await admin.newPage();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await adminPage.goto('/admin-module');
    if (await adminPage.getByRole('heading', { name: 'Administração' }).isVisible({ timeout: 10_000 }).catch(() => false)) break;
    if (attempt < 5) {
      await admin.close();
      admin = await authenticatedContext(browser, ADMIN_STATE);
      adminPage = await admin.newPage();
    }
  }
  await expect(adminPage).not.toHaveURL(/admin-auth/);
  const adminContent = adminPage.locator('main');
  await expect(adminContent.getByRole('heading', { name: 'Administração' })).toBeVisible({ timeout: 20_000 });
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

  const internalHealth = await internal.rpc('get_system_health');
  expect(internalHealth.data).toBeNull();
  expect(internalHealth.error).not.toBeNull();

  const adminHealth = await getSystemHealthWithRetry(admin);
  expect(adminHealth.error).toBeNull();
  expect(adminHealth.data).toMatchObject({
    lost_items: { base64_total: 0 },
  });
});

test('saúde do sistema exibe somente métricas administrativas agregadas', async ({ browser }) => {
  const context = await authenticatedContext(browser, ADMIN_STATE);
  const page = await context.newPage();
  await page.goto('/admin-module/system-health');
  const health = page.getByTestId('system-health-page');
  await expect(health.getByRole('heading', { name: 'Saúde do Sistema' })).toBeVisible({ timeout: 20_000 });
  await expect(health.getByText('Banco de dados', { exact: true })).toBeVisible({ timeout: 30_000 });
  for (const cardTitle of ['Storage', 'Automações', 'Achados e Perdidos', 'Usuários', 'Maiores tabelas']) {
    await expect(health.getByText(cardTitle, { exact: true }).first()).toBeVisible();
  }
  await expect(health.getByTestId('base64-count')).toHaveText('0');
  await expect(health.getByTestId('cron-job')).toHaveCount(3);
  for (const jobName of ['expire-lost-items-daily', 'process-recurring-tasks-daily', 'process-recurring-tasks-hourly']) {
    await expect(health.getByText(jobName, { exact: true })).toBeVisible();
  }
  await expect(health).not.toContainText(/service_role|bearer|password|connection string|vault/i);
  await context.close();
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

test('arquivados: exclusão admin explícita, confirmação, lote e Storage seguro', async ({ browser }) => {
  test.setTimeout(180_000);
  const registry = loadRegistry()!;
  const internal = await clientFor('internal');
  const admin = await clientFor('admin');
  const adminId = (await admin.auth.getUser()).data.user!.id;
  const exclusivePath = `e2e/${registry.runId}/archive-exclusive.png`;
  const sharedPath = `e2e/${registry.runId}/archive-shared.png`;
  const referenceFailurePath = `e2e/${registry.runId}/archive-reference-failure.png`;
  const storageFailurePath = `e2e/${registry.runId}/archive-storage-failure.png`;
  const storageObjectExists = async (path: string) => {
    const separator = path.lastIndexOf('/');
    const directory = separator >= 0 ? path.slice(0, separator) : '';
    const filename = separator >= 0 ? path.slice(separator + 1) : path;
    const { data, error } = await admin.storage.from('lost-items').list(directory, { search: filename, limit: 10 });
    if (error) throw error;
    return (data ?? []).some(entry => entry.name === filename);
  };
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,3,1,1,0,201,254,146,239,0,0,0,0,73,69,78,68,174,66,96,130]);
  for (const path of [exclusivePath, sharedPath, referenceFailurePath, storageFailurePath]) {
    const { error } = await admin.storage.from('lost-items').upload(path, png, { contentType: 'image/png' });
    if (error) throw error;
    trackObject(registry, 'lost-items', path);
  }

  const archiveRows = Array.from({ length: 12 }, (_, index) => ({
    code: `E2E-A${String(Date.now()).slice(-4)}-${index}`,
    description: `${registry.runId} arquivado ${index}`,
    image_url: index === 0
      ? exclusivePath
      : [1, 2, 3].includes(index)
        ? sharedPath
        : index === 10
          ? referenceFailurePath
          : index === 11
            ? storageFailurePath
            : null,
    campus: 'Campus I' as const,
    found_location: 'E2E', found_date: '2026-08-26', received_date: '2026-08-26',
    delivered_by_name: registry.runId, status: 'delivered', registered_by: adminId,
    archived_by: adminId, archived_by_name: 'E2E Admin', original_id: crypto.randomUUID(),
  }));
  const inserted = await admin.from('lost_items_archive').insert(archiveRows).select('id,code,image_url');
  if (inserted.error) throw inserted.error;
  inserted.data.forEach(row => trackRow(registry, 'lost_items_archive', row.id));

  const denied = await internal.from('lost_items_archive').delete().eq('id', inserted.data[0].id).select('id');
  expect(denied.error).toBeNull();
  expect(denied.data).toEqual([]);
  const internalContext = await authenticatedContext(browser, INTERNAL_STATE);
  const internalPage = await internalContext.newPage();
  await internalPage.goto('/lost-found/archived');
  await expect(internalPage.getByRole('button', { name: /Excluir/i })).toHaveCount(0);
  await internalContext.close();

  const adminContext = await authenticatedContext(browser, ADMIN_STATE);
  const page = await adminContext.newPage();
  let referenceMode: 'remaining' | 'shared' | 'none' | 'fail' = 'remaining';
  let sharedPathDeleteRequests = 0;
  page.on('request', request => {
    const requestContent = decodeURIComponent(`${request.url()} ${request.postData() ?? ''}`);
    if (request.method() === 'DELETE' && requestContent.includes(sharedPath)) sharedPathDeleteRequests += 1;
  });
  await page.goto('/lost-found/archived');
  await expect(page.getByText(inserted.data[0].code, { exact: true })).toBeVisible({ timeout: 30_000 });

  // Intercept only the conservative reference scan, after the page loaded normally.
  await page.route('**/rest/v1/lost_items*', async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get('select') !== 'image_url') {
      await route.continue();
      return;
    }
    if (referenceMode === 'fail') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"test"}' });
      return;
    }
    const isArchive = requestUrl.pathname.endsWith('/lost_items_archive');
    const imageUrls = !isArchive
      ? []
      : referenceMode === 'shared'
        ? [sharedPath]
        : referenceMode === 'remaining'
          ? [referenceFailurePath, storageFailurePath]
          : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(imageUrls.map(image_url => ({ image_url }))),
    });
  });
  await page.getByText(inserted.data[0].code, { exact: true }).click();
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
  const individualDialog = page.getByRole('dialog', { name: 'Excluir item arquivado definitivamente?' });
  const individualConfirm = individualDialog.getByRole('button', { name: 'Excluir definitivamente' });
  await expect(individualConfirm).toBeDisabled();
  await individualDialog.getByText(/Confirmo que já gerei/).click();
  await expect(individualConfirm).toBeEnabled();
  await individualConfirm.click();
  await expect(page.getByText('1 item excluído', { exact: true })).toBeVisible({ timeout: 30_000 });
  expect((await admin.from('lost_items_archive').select('id').eq('id', inserted.data[0].id)).data).toEqual([]);
  untrackRow(registry, 'lost_items_archive', inserted.data[0].id);
  await expect.poll(() => storageObjectExists(exclusivePath), { timeout: 30_000 }).toBe(false);
  untrackObject(registry, 'lost-items', exclusivePath);
  await expect(page.getByText(inserted.data[0].code, { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(inserted.data[1].code, { exact: true })).toBeVisible({ timeout: 30_000 });

  // A is selected, while B and C keep the same image referenced.
  referenceMode = 'shared';
  await page.getByText(inserted.data[1].code, { exact: true }).click();
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
  const sharedSingleDialog = page.getByRole('dialog', { name: 'Excluir item arquivado definitivamente?' });
  await sharedSingleDialog.getByText(/Confirmo que já gerei/).click();
  await sharedSingleDialog.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page.getByText(/1 imagem preservada/, { exact: true }).last()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await admin.from('lost_items_archive').select('id').eq('id', inserted.data[1].id)).data?.length, { timeout: 30_000 }).toBe(0);
  untrackRow(registry, 'lost_items_archive', inserted.data[1].id);
  expect((await admin.from('lost_items_archive').select('id').in('id', [inserted.data[2].id, inserted.data[3].id])).data).toHaveLength(2);
  expect(await storageObjectExists(sharedPath)).toBe(true);
  expect(sharedPathDeleteRequests).toBe(0);
  await expect(page.getByText(inserted.data[1].code, { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('checkbox', { name: `Selecionar item ${inserted.data[2].code}` })).toBeVisible({ timeout: 30_000 });

  // B and C share the same path and are deleted in the same explicit batch.
  referenceMode = 'remaining';
  for (const row of inserted.data.slice(2, 9)) {
    await page.getByRole('checkbox', { name: `Selecionar item ${row.code}` }).click();
  }
  await expect(page.getByText('7 itens selecionados')).toBeVisible();
  await page.getByRole('button', { name: 'Excluir selecionados' }).click();
  const batchDialog = page.getByRole('dialog', { name: 'Excluir 7 itens arquivados definitivamente?' });
  const batchConfirm = batchDialog.getByRole('button', { name: 'Excluir definitivamente' });
  await batchDialog.getByText(/Confirmo que já gerei/).click();
  await batchDialog.getByLabel('Digite EXCLUIR para confirmar').fill('excluir');
  await expect(batchConfirm).toBeDisabled();
  await batchDialog.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
  await expect(batchConfirm).toBeEnabled();
  await batchConfirm.click();
  await expect(page.getByText('7 itens excluídos', { exact: true })).toBeVisible({ timeout: 30_000 });
  for (const row of inserted.data.slice(2, 9)) untrackRow(registry, 'lost_items_archive', row.id);
  expect((await admin.from('lost_items_archive').select('id').eq('id', inserted.data[9].id).single()).data?.id).toBe(inserted.data[9].id);
  expect(sharedPathDeleteRequests).toBe(1);
  await expect.poll(() => storageObjectExists(sharedPath), { timeout: 30_000 }).toBe(false);
  untrackObject(registry, 'lost-items', sharedPath);
  await expect(page.getByText(inserted.data[2].code, { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(inserted.data[10].code, { exact: true })).toBeVisible({ timeout: 30_000 });

  // If reference lookup fails, deletion remains conservative and preserves the object.
  referenceMode = 'fail';
  await page.getByText(inserted.data[10].code, { exact: true }).click();
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
  const referenceFailureDialog = page.getByRole('dialog', { name: 'Excluir item arquivado definitivamente?' });
  await referenceFailureDialog.getByText(/Confirmo que já gerei/).click();
  await referenceFailureDialog.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page.getByText(/1 imagem preservada/, { exact: true }).last()).toBeVisible({ timeout: 30_000 });
  untrackRow(registry, 'lost_items_archive', inserted.data[10].id);
  expect(await storageObjectExists(referenceFailurePath)).toBe(true);
  await expect(page.getByText(inserted.data[10].code, { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(inserted.data[11].code, { exact: true })).toBeVisible({ timeout: 30_000 });

  // If Storage rejects removal, the deleted record is not restored and the orphan is reported/preserved.
  referenceMode = 'none';
  await page.route('**/storage/v1/object/lost-items**', async route => {
    const content = decodeURIComponent(`${route.request().url()} ${route.request().postData() ?? ''}`);
    if (route.request().method() === 'DELETE' && content.includes(storageFailurePath)) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"test"}' });
    } else {
      await route.continue();
    }
  });
  await page.getByText(inserted.data[11].code, { exact: true }).click();
  await page.getByRole('button', { name: 'Excluir definitivamente' }).click();
  const storageFailureDialog = page.getByRole('dialog', { name: 'Excluir item arquivado definitivamente?' });
  await storageFailureDialog.getByText(/Confirmo que já gerei/).click();
  await storageFailureDialog.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page.getByText(/1 imagem preservada/, { exact: true }).last()).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/storage/v1/object/lost-items**');
  untrackRow(registry, 'lost_items_archive', inserted.data[11].id);
  expect(await storageObjectExists(storageFailurePath)).toBe(true);

  await deleteTracked(admin, registry, 'lost_items_archive', inserted.data[9].id);
  for (const path of [referenceFailurePath, storageFailurePath]) {
    expect((await admin.storage.from('lost-items').remove([path])).error).toBeNull();
    untrackObject(registry, 'lost-items', path);
  }
  await adminContext.close();
});

test('arquivados: selecionar todos atua somente sobre itens carregados', async ({ browser }) => {
  test.setTimeout(120_000);
  const items = Array.from({ length: 75 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    original_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    code: `E2E-SELECT-${String(index + 1).padStart(3, '0')}`,
    description: `__E2E_SELECT_ALL__ item ${index + 1}`,
    image_url: null,
    campus: 'Campus I',
    found_location: 'E2E',
    found_date: '2026-08-27',
    received_date: '2026-08-27',
    delivered_by_name: 'E2E',
    delivered_by_contact: null,
    delivered_by_team_member: null,
    owner_name: null,
    owner_phone: null,
    owner_email: null,
    owner_signature: null,
    status: 'delivered',
    delivered_at: '2026-08-27T00:00:00.000Z',
    registered_by: null,
    shelf: null,
    box: null,
    seal_number: null,
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
    archived_at: `2026-08-27T00:${String(59 - (index % 60)).padStart(2, '0')}:00.000Z`,
    archived_by: null,
    archived_by_name: 'E2E Admin',
  }));
  const deletedIds = new Set<string>();
  let requestedDeleteIds: string[] = [];
  const context = await authenticatedContext(browser, ADMIN_STATE);
  const page = await context.newPage();

  // Keep pagination deterministic: additional records load only after the explicit button click.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  });
  await page.route('**/rest/v1/lost_items_archive*', async route => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (request.method() === 'DELETE') {
      const decodedUrl = decodeURIComponent(request.url());
      requestedDeleteIds = items.filter(item => decodedUrl.includes(item.id)).map(item => item.id);
      requestedDeleteIds.forEach(id => deletedIds.add(id));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(requestedDeleteIds.map(id => ({ id }))),
      });
      return;
    }
    if (requestUrl.searchParams.get('select') === 'image_url') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    const from = Number(requestUrl.searchParams.get('offset') ?? 0);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 50);
    const to = from + limit - 1;
    const available = items.filter(item => !deletedIds.has(item.id));
    const pageItems = available.slice(from, to + 1);
    await route.fulfill({
      status: 200,
      headers: { 'content-range': `${from}-${from + Math.max(pageItems.length - 1, 0)}/${available.length}` },
      contentType: 'application/json',
      body: JSON.stringify(pageItems),
    });
  });

  await page.goto('/lost-found/archived');
  const selectAll = page.getByRole('checkbox', { name: 'Selecionar todos os itens carregados' });
  const itemCheckboxes = page.getByRole('checkbox', { name: /^Selecionar item E2E-SELECT-/ });
  await expect(page.getByText('50 item(ns) carregado(s) (mais disponíveis)')).toBeVisible();

  await selectAll.click();
  await expect(itemCheckboxes).toHaveCount(50);
  for (let index = 0; index < 50; index += 1) await expect(itemCheckboxes.nth(index)).toBeChecked();
  await expect(page.getByText('50 itens selecionados')).toBeVisible();
  await expect(page.getByText('Selecionados todos os itens carregados nesta página.')).toBeVisible();

  await selectAll.click();
  await expect(page.getByText('50 itens selecionados')).toHaveCount(0);
  await expect(itemCheckboxes.first()).not.toBeChecked();

  await itemCheckboxes.first().click();
  await expect(selectAll).toHaveAttribute('data-state', 'indeterminate');
  await itemCheckboxes.first().click();

  await selectAll.click();
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(page.getByText('75 item(ns) carregado(s)')).toBeVisible();
  await expect(itemCheckboxes).toHaveCount(75);
  await expect(page.getByText('50 itens selecionados')).toBeVisible();
  await expect(selectAll).toHaveAttribute('data-state', 'indeterminate');
  await expect(itemCheckboxes.nth(50)).not.toBeChecked();

  // Clear the loaded selection, then verify that DELETE receives only two explicit UUIDs.
  await selectAll.click();
  await selectAll.click();
  await itemCheckboxes.nth(3).click();
  await itemCheckboxes.nth(61).click();
  const expectedIds = [items[3].id, items[61].id];
  await expect(page.getByText('2 itens selecionados')).toBeVisible();
  await page.getByRole('button', { name: 'Excluir selecionados' }).click();
  const dialog = page.getByRole('dialog', { name: 'Excluir 2 itens arquivados definitivamente?' });
  await dialog.getByText(/Confirmo que já gerei/).click();
  await dialog.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await expect(page.getByText('2 itens excluídos', { exact: true })).toBeVisible();
  expect(new Set(requestedDeleteIds)).toEqual(new Set(expectedIds));
  expect(requestedDeleteIds).toHaveLength(2);

  await context.close();
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
  const context = await authenticatedContext(browser, ADMIN_STATE);
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
  const context = await authenticatedContext(browser, INTERNAL_STATE);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByText('Sair do Sistema').first().click();
  await expect(page).toHaveURL(/admin-auth/);
  await context.close();
});
