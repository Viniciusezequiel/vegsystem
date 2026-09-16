import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) return json({ error: 'supabase_not_configured' }, 500);

    const admin = createClient(url, key);
    const payload = await req.json();

    const messageId = String(payload['message-id'] || payload.messageId || '');
    const eventType = String(payload.event || payload.type || 'unknown');

    if (!messageId) return json({ error: 'missing_message_id' }, 400);

    const { data: communication } = await admin
      .from('ps_event_communications')
      .select('id')
      .eq('provider_message_id', messageId)
      .maybeSingle();

    await admin.from('ps_email_events').insert({
      communication_id: communication?.id || null,
      provider_message_id: messageId,
      event_type: eventType,
      payload,
    });

    return json({ received: true });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
