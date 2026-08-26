import { expect, test } from '@playwright/test';

const protectedRoutes = [
  '/',
  '/lost-found',
  '/equipment',
  '/reservations',
  '/tasks',
  '/classroom-calls',
  '/admin-module',
  '/admin-module/uber',
];

test.describe('produção: rotas públicas', () => {
  for (const route of ['/admin-auth', '/chamado-sala', '/painel-reservas', '/solicitar-uber']) {
    test(`${route} carrega sem erro fatal`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator('body')).not.toBeEmpty();
      expect(errors).toEqual([]);
    });
  }
});

test.describe('produção: proteção anônima', () => {
  for (const route of protectedRoutes) {
    test(`${route} redireciona para login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/admin-auth$/);
    });
  }
});

test('rota inexistente renderiza a página 404 da SPA', async ({ page }) => {
  const response = await page.goto('/auditoria-rota-inexistente');
  expect(response?.status()).toBe(200);
  await expect(page.getByText(/página não encontrada|404/i)).toBeVisible();
});
