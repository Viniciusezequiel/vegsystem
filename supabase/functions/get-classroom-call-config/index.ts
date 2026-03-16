import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active rooms with their active issues
    const { data: rooms, error: roomsError } = await supabase
      .from('classroom_call_rooms')
      .select('id, name, campus')
      .eq('is_active', true)
      .order('name');

    if (roomsError) throw roomsError;

    // Fetch all active issues
    const { data: issues, error: issuesError } = await supabase
      .from('classroom_call_room_issues')
      .select('id, room_id, description')
      .eq('is_active', true)
      .order('order_index');

    if (issuesError) throw issuesError;

    // Group issues by room_id
    const roomsWithIssues = (rooms || []).map(room => ({
      ...room,
      issues: (issues || []).filter(i => i.room_id === room.id),
    }));

    return new Response(
      JSON.stringify({ rooms: roomsWithIssues }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
