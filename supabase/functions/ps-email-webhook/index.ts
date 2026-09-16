import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const trackedEvents = [
  'sent', 'delivered', 'opened', 'uniqueOpened', 'click', 'softBounce',
  'hardBounce', 'blocked', 'spam', 'invalid', 'deferred', 'error', 'unsubscribed',
];

function eventDate(payload: Record<string, unknown>) {
  const epoch = Number(payload.ts_event || payload.ts_epoch || payload.ts || 0);
  if (Number.isFinite(epoch) && epoch > 0) return new Date(epoch * 1000).toISOString();
  const parsed = new Date(String(payload.date || ''));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function recordEvent(admin: any, payload: Record<string, unknown>) {
  const messageId = String(payload['message-id'] || payload.messageId || '').trim();
  const eventType = String(payload.event || payload.type || '').trim();
  if (!messageId || !eventType) return false;

  const { data, error } = await admin.rpc('ps_record_email_provider_event', {
    p_provider_message_id: messageId,
    p_event_type: eventType,
    p_event_at: eventDate(payload),
    p_provider_event_id: String(payload.id || payload.ts_event || payload.ts || '') || null,
    p_recipient_email: String(payload.email || '') || null,
    p_payload: payload,
  });
  if (error) throw error;
  return Boolean(data);
}

async function brevoRequest(path: string, apiKey: string, init?: RequestInit) {
  const response = await fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`brevo_${response.status}`);
  return body;
}

async function ensureWebhook(supabaseUrl: string, apiKey: string, webhookSecret: string) {
  const targetUrl = `${supabaseUrl}/functions/v1/ps-email-webhook`;
  const listed = await brevoRequest('/webhooks?type=transactional', apiKey);
  const current = (listed.webhooks || []).find((item: any) => item.url === targetUrl);
  const config = {
    url: targetUrl,
    description: 'VEG System - status dos e-mails do Processo Seletivo',
    events: trackedEvents,
    type: 'transactional',
    batched: false,
    auth: { type: 'bearer', token: webhookSecret },
  };

  if (current?.id) {
    await brevoRequest(`/webhooks/${current.id}`, apiKey, { method: 'PUT', body: JSON.stringify(config) });
    return { id: current.id, created: false };
  }
  const created = await brevoRequest('/webhooks', apiKey, { method: 'POST', body: JSON.stringify(config) });
  return { id: created.id, created: true };
}

async function requireInternalUser(req: Request, admin: any, supabaseUrl: string, anonKey: string) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: claims, error } = await userClient.auth.getClaims(auth.slice(7));
  const userId = claims?.claims?.sub as string | undefined;
  if (error || !userId) return null;
  const { data: internal } = await admin.rpc('is_internal_user', { _user_id: userId });
  return internal ? userId : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const brevoApiKey = Deno.env.get('BREVO_API_KEY') || '';
    const webhookSecret = Deno.env.get('RECURRING_TASKS_CRON_SECRET') || '';
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'supabase_not_configured' }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const payload = await req.json().catch(() => ({}));

    if (payload?.action === 'sync') {
      const userId = await requireInternalUser(req, admin, supabaseUrl, anonKey);
      if (!userId) return json({ error: 'forbidden' }, 403);
      if (!brevoApiKey || !webhookSecret) return json({ error: 'email_tracking_not_configured' }, 503);

      const webhook = await ensureWebhook(supabaseUrl, brevoApiKey, webhookSecret);
      const report = await brevoRequest('/smtp/statistics/events?days=30&limit=5000&sort=desc', brevoApiKey);
      let matched = 0;
      for (const event of report.events || []) {
        if (await recordEvent(admin, event)) matched += 1;
      }
      return json({ ok: true, webhook, inspected: (report.events || []).length, matched });
    }

    const auth = req.headers.get('authorization') || '';
    if (!webhookSecret || auth !== `Bearer ${webhookSecret}`) return json({ error: 'unauthorized' }, 401);
    const events = Array.isArray(payload) ? payload : [payload];
    let matched = 0;
    for (const event of events) {
      if (await recordEvent(admin, event)) matched += 1;
    }
    return json({ received: events.length, matched });
  } catch (error) {
    console.error('ps-email-webhook failed', { message: error instanceof Error ? error.message : 'unknown_error' });
    return json({ error: 'internal_error' }, 500);
  }
});
