import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260916000000_ps_email_tracking_events.sql'), 'utf8');
const webhook = fs.readFileSync(path.join(root, 'supabase/functions/ps-email-webhook/index.ts'), 'utf8');
const communication = fs.readFileSync(path.join(root, 'src/components/processo-seletivo/PsEventCommunicationTab.tsx'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'src/hooks/useProcessoSeletivo.ts'), 'utf8');

test('rastreamento persiste estados da Brevo sem expor escrita ao frontend', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS delivery_status/);
  assert.match(migration, /ps_record_email_provider_event/);
  assert.match(migration, /delivered_at/);
  assert.match(migration, /opened_at/);
  assert.match(migration, /clicked_at/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /GRANT SELECT ON public\.ps_email_events TO authenticated/);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE|ALL).*ps_email_events TO authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.ps_record_email_provider_event[\s\S]*FROM PUBLIC, anon, authenticated/);
});

test('webhook da Brevo exige segredo e configura eventos de entrega e abertura', () => {
  assert.match(webhook, /RECURRING_TASKS_CRON_SECRET/);
  assert.match(webhook, /auth !== `Bearer \$\{webhookSecret\}`/);
  assert.match(webhook, /uniqueOpened/);
  assert.match(webhook, /hardBounce/);
  assert.match(webhook, /\/smtp\/statistics\/events\?days=30/);
  assert.match(webhook, /ps_record_email_provider_event/);
  assert.doesNotMatch(webhook, /BREVO_API_KEY.*json\(/);
});

test('comunicação mostra status real e sincroniza sem armazenar chave no navegador', () => {
  for (const label of ['Entregue', 'Aberto', 'Clicou no link', 'E-mail rejeitado', 'Bloqueado']) {
    assert.match(communication, new RegExp(label));
  }
  assert.doesNotMatch(communication, /PsEmailTrackingDashboard/);
  assert.match(communication, /Atualizar status/);
  assert.match(hook, /functions\.invoke\('ps-email-webhook'/);
  assert.doesNotMatch(`${communication}\n${hook}`, /VITE_.*BREVO/i);
});
