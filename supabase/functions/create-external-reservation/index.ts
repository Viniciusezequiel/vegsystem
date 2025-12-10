import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute per email

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count++;
  return false;
}

// Input validation
function validateReservationInput(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.room_id || typeof data.room_id !== 'string') {
    errors.push('room_id is required');
  }

  if (!data.title || typeof data.title !== 'string' || data.title.length < 3 || data.title.length > 200) {
    errors.push('title must be between 3 and 200 characters');
  }

  if (!data.requester_name || typeof data.requester_name !== 'string' || data.requester_name.length < 2 || data.requester_name.length > 100) {
    errors.push('requester_name must be between 2 and 100 characters');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.requester_email || !emailRegex.test(data.requester_email)) {
    errors.push('valid requester_email is required');
  }

  if (!data.start_datetime || !data.end_datetime) {
    errors.push('start_datetime and end_datetime are required');
  } else {
    const start = new Date(data.start_datetime);
    const end = new Date(data.end_datetime);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push('Invalid datetime format');
    } else if (start <= now) {
      errors.push('start_datetime must be in the future');
    } else if (end <= start) {
      errors.push('end_datetime must be after start_datetime');
    }
  }

  if (typeof data.attendees_count !== 'number' || data.attendees_count < 1 || data.attendees_count > 1000) {
    errors.push('attendees_count must be between 1 and 1000');
  }

  // Sanitize optional fields
  if (data.description && (typeof data.description !== 'string' || data.description.length > 1000)) {
    errors.push('description must be less than 1000 characters');
  }

  if (data.requester_phone && (typeof data.requester_phone !== 'string' || data.requester_phone.length > 20)) {
    errors.push('requester_phone must be less than 20 characters');
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received external reservation request:', JSON.stringify({
      room_id: body.room_id,
      title: body.title,
      requester_email: body.requester_email,
    }));

    // Validate input
    const validation = validateReservationInput(body);
    if (!validation.valid) {
      console.log('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (isRateLimited(body.requester_email)) {
      console.log('Rate limit exceeded for:', body.requester_email);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait a minute before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for conflicts
    const { data: hasConflict, error: conflictError } = await supabase
      .rpc('check_reservation_conflict', {
        p_room_id: body.room_id,
        p_start_datetime: body.start_datetime,
        p_end_datetime: body.end_datetime,
      });

    if (conflictError) {
      console.error('Conflict check error:', conflictError);
      throw conflictError;
    }

    if (hasConflict) {
      return new Response(
        JSON.stringify({ error: 'There is already a reservation for this time slot.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch room to check auto_confirm setting
    const { data: roomData, error: roomError } = await supabase
      .from('reservation_rooms')
      .select('auto_confirm, name')
      .eq('id', body.room_id)
      .single();

    if (roomError || !roomData) {
      console.error('Room not found:', roomError);
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // External reservations always start as pending
    const initialStatus = 'pending';

    // Create reservation
    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert({
        room_id: body.room_id,
        title: body.title,
        description: body.description || null,
        requester_name: body.requester_name,
        requester_email: body.requester_email.toLowerCase(),
        requester_phone: body.requester_phone || null,
        attendees_count: body.attendees_count,
        start_datetime: body.start_datetime,
        end_datetime: body.end_datetime,
        is_external: true,
        status: initialStatus,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('Reservation created successfully:', reservation.id);

    // Log the action
    await supabase.from('reservation_logs').insert({
      reservation_id: reservation.id,
      room_id: body.room_id,
      action: 'Reserva externa criada',
      details: `${body.title} - ${body.requester_name} (via formulário externo)`,
      performer_name: body.requester_name,
    });

    return new Response(
      JSON.stringify({ success: true, reservation }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating external reservation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
