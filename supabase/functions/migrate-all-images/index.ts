import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) throw new Error('Invalid data URL');

  const meta = dataUrl.slice(0, commaIndex);
  const b64 = dataUrl.slice(commaIndex + 1);

  const match = meta.match(/^data:(.*?);base64$/);
  if (!match) throw new Error('Invalid base64 data URL');

  const mime = match[1];
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return { mime, bytes };
}

function extFromMime(mime: string) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can run batch migration' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting batch image migration...');

    // Fetch all items with base64 images (only IDs first to avoid timeout)
    const { data: itemsWithBase64, error: fetchError } = await adminClient
      .from('lost_items')
      .select('id')
      .like('image_url', 'data:image/%');

    if (fetchError) {
      console.error('Error fetching items:', fetchError);
      throw fetchError;
    }

    if (!itemsWithBase64 || itemsWithBase64.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No base64 images found to migrate',
        migrated: 0,
        failed: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${itemsWithBase64.length} items with base64 images`);

    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each item one by one
    for (const item of itemsWithBase64) {
      try {
        // Fetch the full image_url for this item
        const { data: fullItem, error: itemError } = await adminClient
          .from('lost_items')
          .select('id, image_url')
          .eq('id', item.id)
          .single();

        if (itemError || !fullItem?.image_url) {
          failed++;
          errors.push(`${item.id}: Failed to fetch`);
          continue;
        }

        const imageUrl = fullItem.image_url as string;
        
        if (!imageUrl.startsWith('data:image/')) {
          // Already a URL, skip
          continue;
        }

        const { mime, bytes } = parseDataUrl(imageUrl);
        const ext = extFromMime(mime);
        const path = `${item.id}.${ext}`;

        const { error: uploadError } = await adminClient.storage
          .from('lost-items')
          .upload(path, bytes, {
            contentType: mime,
            upsert: true,
          });

        if (uploadError) {
          failed++;
          errors.push(`${item.id}: ${uploadError.message}`);
          console.error(`Failed to upload ${item.id}:`, uploadError);
          continue;
        }

        const { data: publicData } = adminClient.storage.from('lost-items').getPublicUrl(path);
        const publicUrl = publicData.publicUrl;

        const { error: updateError } = await adminClient
          .from('lost_items')
          .update({ image_url: publicUrl })
          .eq('id', item.id);

        if (updateError) {
          failed++;
          errors.push(`${item.id}: ${updateError.message}`);
          console.error(`Failed to update ${item.id}:`, updateError);
          continue;
        }

        migrated++;
        console.log(`Migrated ${item.id} -> ${publicUrl}`);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : 'Unknown error';
        errors.push(`${item.id}: ${msg}`);
        console.error(`Error processing ${item.id}:`, e);
      }
    }

    console.log(`Migration complete. Migrated: ${migrated}, Failed: ${failed}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Migration complete`,
      total: itemsWithBase64.length,
      migrated,
      failed,
      errors: errors.slice(0, 10) // Return first 10 errors only
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Batch migration error:', error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
