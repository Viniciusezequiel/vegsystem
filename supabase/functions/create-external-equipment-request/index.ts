import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per email

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
function validateEquipmentRequestInput(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!data.equipment_name || typeof data.equipment_name !== 'string' || data.equipment_name.length < 1 || data.equipment_name.length > 200) {
    errors.push('equipment_name must be between 1 and 200 characters');
  }

  if (typeof data.quantity_requested !== 'number' || data.quantity_requested < 1 || data.quantity_requested > 100) {
    errors.push('quantity_requested must be between 1 and 100');
  }

  if (!data.requester_name || typeof data.requester_name !== 'string' || data.requester_name.length < 2 || data.requester_name.length > 100) {
    errors.push('requester_name must be between 2 and 100 characters');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.requester_email || !emailRegex.test(data.requester_email)) {
    errors.push('valid requester_email is required');
  }

  const phoneRegex = /^[\d\s\-\(\)\+]{8,20}$/;
  if (!data.requester_phone || !phoneRegex.test(data.requester_phone)) {
    errors.push('valid requester_phone is required (8-20 characters)');
  }

  if (!data.purpose || typeof data.purpose !== 'string' || data.purpose.length < 10 || data.purpose.length > 1000) {
    errors.push('purpose must be between 10 and 1000 characters');
  }

  if (!data.requested_date) {
    errors.push('requested_date is required');
  } else {
    const requestedDate = new Date(data.requested_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(requestedDate.getTime())) {
      errors.push('Invalid requested_date format');
    } else if (requestedDate < today) {
      errors.push('requested_date must be today or in the future');
    }
  }

  if (!data.expected_return_date) {
    errors.push('expected_return_date is required');
  } else {
    const returnDate = new Date(data.expected_return_date);
    const requestedDate = new Date(data.requested_date);

    if (isNaN(returnDate.getTime())) {
      errors.push('Invalid expected_return_date format');
    } else if (returnDate < requestedDate) {
      errors.push('expected_return_date must be on or after requested_date');
    }
  }

  // Optional fields validation
  if (data.equipment_id && typeof data.equipment_id !== 'string') {
    errors.push('equipment_id must be a string if provided');
  }

  if (data.requester_organization && (typeof data.requester_organization !== 'string' || data.requester_organization.length > 200)) {
    errors.push('requester_organization must be less than 200 characters');
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
    console.log('Received external equipment request:', JSON.stringify({
      equipment_name: body.equipment_name,
      requester_email: body.requester_email,
      quantity_requested: body.quantity_requested,
    }));

    // Validate input
    const validation = validateEquipmentRequestInput(body);
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

    // If equipment_id is provided, verify the equipment exists
    if (body.equipment_id) {
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select('id, name, available_quantity')
        .eq('id', body.equipment_id)
        .single();

      if (equipmentError || !equipmentData) {
        console.log('Equipment not found:', body.equipment_id);
        return new Response(
          JSON.stringify({ error: 'Equipment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if requested quantity is available
      if (body.quantity_requested > equipmentData.available_quantity) {
        return new Response(
          JSON.stringify({ error: 'Requested quantity exceeds available quantity' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create the request
    const { data: request, error: insertError } = await supabase
      .from('external_equipment_requests')
      .insert({
        equipment_id: body.equipment_id || null,
        equipment_name: body.equipment_name,
        quantity_requested: body.quantity_requested,
        requester_name: body.requester_name.trim(),
        requester_email: body.requester_email.toLowerCase().trim(),
        requester_phone: body.requester_phone.trim(),
        requester_organization: body.requester_organization?.trim() || null,
        purpose: body.purpose.trim(),
        requested_date: body.requested_date,
        expected_return_date: body.expected_return_date,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('Equipment request created successfully:', request.id);

    return new Response(
      JSON.stringify({ success: true, request }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating external equipment request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
