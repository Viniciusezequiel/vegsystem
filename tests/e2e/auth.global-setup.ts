import fs from 'node:fs';
import { chromium, type FullConfig } from '@playwright/test';
import { ADMIN_STATE, AUTH_DIR, INTERNAL_STATE, newRunId, saveRegistry } from './e2e-registry';

const required = ['E2E_INTERNAL_EMAIL', 'E2E_INTERNAL_PASSWORD', 'E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'] as const;

export default async function globalSetup(config: FullConfig) {
  for (const name of required) {
    if (!process.env[name]) throw new Error(`Variável obrigatória ausente: ${name}`);
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
  saveRegistry({
    runId: newRunId(), rows: {}, objects: {},
    createdRows: {}, removedRows: {}, createdObjects: {}, removedObjects: {},
  });

  const baseURL = String(config.projects[0].use.baseURL);
  const browser = await chromium.launch();
  try {
    for (const account of [
      { email: process.env.E2E_INTERNAL_EMAIL!, password: process.env.E2E_INTERNAL_PASSWORD!, state: INTERNAL_STATE },
      { email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD!, state: ADMIN_STATE },
    ]) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto('/admin-auth');
      await page.locator('#email').fill(account.email);
      await page.locator('#password').fill(account.password);
      await page.getByRole('button', { name: /^Entrar$/ }).click();
      await page.waitForURL(url => url.pathname === '/', { timeout: 20_000 });
      await context.storageState({ path: account.state });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
