import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCallRequest {
  room_name: string;
  reason: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateCallRequest = await req.json();

    // Validate required fields
    if (!body.room_name || !body.reason) {
      return new Response(
        JSON.stringify({ error: 'room_name and reason are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input length
    const roomName = body.room_name.trim().slice(0, 100);
    const reason = body.reason.trim().slice(0, 500);

    if (!roomName || !reason) {
      return new Response(
        JSON.stringify({ error: 'room_name and reason cannot be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert the classroom call
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
