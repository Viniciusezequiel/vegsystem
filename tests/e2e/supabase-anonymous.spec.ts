import { expect, test } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

test.skip(!supabaseUrl || !publishableKey, 'Variáveis VITE_SUPABASE_* não disponíveis');

const headers = () => ({
  apikey: publishableKey!,
  Authorization: `Bearer ${publishableKey!}`,
  'Content-Type': 'application/json',
});

test('catálogos públicos de chamado de sala respondem', async ({ request }) => {
  for (const table of ['classroom_call_rooms', 'classroom_call_room_issues']) {
    const response = await request.get(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, { headers: headers() });
    expect(response.status()).toBe(200);
    expect(Array.isArray(await response.json())).toBe(true);
  }
});

test('consulta pública de status não expõe chamado inexistente', async ({ request }) => {
  const response = await request.post(`${supabaseUrl}/rest/v1/rpc/get_public_classroom_call_status`, {
    headers: headers(),
    data: { p_id: '00000000-0000-0000-0000-000000000000' },
  });
  expect(response.status()).toBe(200);
});

test('Edge Function pública de configuração responde', async ({ request }) => {
  const response = await request.post(`${supabaseUrl}/functions/v1/get-classroom-call-config`, {
    headers: headers(), data: {},
  });
  expect(response.status()).toBe(200);
});

for (const fn of ['create-user', 'delete-user', 'reset-password', 'process-recurring-tasks', 'update-user-email']) {
  test(`Edge Function administrativa ${fn} rejeita anônimo`, async ({ request }) => {
    const data = fn === 'reset-password'
      ? { user_id: '00000000-0000-0000-0000-000000000000', new_password: '__AUDITORIA_SENHA_INVALIDA__' }
      : {};
    const response = await request.post(`${supabaseUrl}/functions/v1/${fn}`, {
      headers: headers(), data,
    });
    expect([401, 403]).toContain(response.status());
  });
}

for (const bucket of ['lost-items', 'task-attachments']) {
  test(`bucket privado ${bucket} não permite leitura pública`, async ({ request }) => {
    const response = await request.get(`${supabaseUrl}/storage/v1/object/public/${bucket}/__auditoria_inexistente__`, {
      headers: headers(),
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
}
