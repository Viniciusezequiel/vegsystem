import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCallRequest {
  room_name: string;
  reason: string;
  issue_description?: string;
}

const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const userAgent = req.headers.get('user-agent') || 'unknown';

  const ip =
    forwardedFor?.split(',')[0]?.trim() ||
    realIP?.trim() ||
    'unknown';

  return `${ip}|${userAgent.slice(0, 200)}`;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    );

    const clientHash = await sha256(
      getClientIdentifier(req)
    );

    const { data: rateRows, error: rateError } =
      await supabase.rpc(
        'consume_public_api_rate_limit',
        {
          p_endpoint: 'create-classroom-call',
          p_client_hash: clientHash,
          p_limit: RATE_LIMIT_MAX_REQUESTS,
          p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        }
      );

    if (rateError) {
      console.error('Rate limit error:', rateError);

      return new Response(
        JSON.stringify({
          error: 'Service temporarily unavailable'
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const rateLimitResult = rateRows?.[0];

    if (!rateLimitResult?.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Please try again later.'
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(
              rateLimitResult?.retry_after || 60
            )
          }
        }
      );
    }

    const body: CreateCallRequest = await req.json();

    if (!body.room_name || !body.reason) {
      return new Response(
        JSON.stringify({ error: 'room_name and reason are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roomName = body.room_name.trim().slice(0, 100);
    // Build reason: issue_description + optional extra text
    let reason = '';
    if (body.issue_description) {
      reason = body.issue_description.trim().slice(0, 200);
      if (body.reason.trim()) {
        reason += ' — ' + body.reason.trim().slice(0, 300);
      }
    } else {
      reason = body.reason.trim().slice(0, 500);
    }

    if (!roomName || !reason) {
      return new Response(
        JSON.stringify({ error: 'room_name and reason cannot be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dangerousPattern = /<script|javascript:|on\w+=/i;
    if (dangerousPattern.test(roomName) || dangerousPattern.test(reason)) {
      return new Response(
        JSON.stringify({ error: 'Invalid characters in input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('classroom_calls')
      .insert({
        room_name: roomName,
        reason: reason,
        status: 'pending',
      })
      .select('id, status')
      .single();

    if (error) {
      console.error('Error creating classroom call:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create call' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Classroom call created successfully:', data.id);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
