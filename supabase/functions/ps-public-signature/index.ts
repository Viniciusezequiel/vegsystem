import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'apikey, content-type, x-client-info, x-ps-link-id, x-ps-action, x-ps-responsible-id, x-ps-reason-b64',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });

const locatorPattern =
  /^r2\/signatures\/process-selection\/\d{4}\/(?:0[1-9]|1[0-2])\/[0-9a-f-]{36}-[0-9a-f]{16}\.png$/;

const pngMagic = [137, 80, 78, 71, 13, 10, 26, 10];

function decodeReason(value: string) {
  try {
    const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes).trim();
  } catch {
    return '';
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors });

  if (request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405);

  const linkId = request.headers.get('x-ps-link-id') ?? '';
  const action = request.headers.get('x-ps-action') ?? 'attendance';

  if (!/^[0-9a-f-]{36}$/i.test(linkId))
    return json({ error: 'invalid_participant' }, 400);

  if (!['attendance', 'absence'].includes(action))
    return json({ error: 'invalid_action' }, 400);

  const contentType =
    (request.headers.get('content-type') ?? '')
      .split(';', 1)[0]
      .toLowerCase();

  const declared = Number(request.headers.get('content-length'));

  if (contentType !== 'image/png')
    return json({ error: 'unsupported_media_type' }, 415);

  if (Number.isFinite(declared) && declared > 512 * 1024)
    return json({ error: 'file_too_large' }, 413);

  const bytes = new Uint8Array(await request.arrayBuffer());

  if (
    bytes.length < pngMagic.length ||
    bytes.length > 512 * 1024 ||
    !pngMagic.every((value, index) => bytes[index] === value)
  ) {
    return json({ error: 'invalid_png' }, 415);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const workerUrl =
    Deno.env.get('STORAGE_WORKER_URL')?.replace(/\/+$/, '') ?? '';
  const secret = Deno.env.get('PS_SIGNATURE_INTERNAL_SECRET') ?? '';

  if (!url || !serviceKey || !workerUrl || secret.length < 32)
    return json({ error: 'configuration_unavailable' }, 503);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const upload = await fetch(
    `${workerUrl}/v1/internal/signatures/process-selection`,
    {
      method: 'POST',
      headers: {
        'x-ps-signature-secret': secret,
        'content-type': 'image/png',
      },
      body: bytes,
    }
  );

  const receipt = await upload.json().catch(() => null);

  if (
    upload.status !== 201 ||
    !locatorPattern.test(receipt?.locator ?? '') ||
    receipt?.size !== bytes.length ||
    receipt?.content_type !== 'image/png'
  ) {
    return json({ error: 'signature_upload_failed' }, 502);
  }

  const locator = receipt.locator as string;

  const cleanup = async () => {
    await fetch(
      `${workerUrl}/v1/internal/signatures/process-selection`,
      {
        method: 'DELETE',
        headers: {
          'x-ps-signature-secret': secret,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ locator }),
      }
    ).catch(() => null);
  };

  // ======================================================
  // AUSÊNCIA
  // ======================================================
  if (action === 'absence') {
    const responsibleId =
      request.headers.get('x-ps-responsible-id') ?? '';

    const reason = decodeReason(
      request.headers.get('x-ps-reason-b64') ?? ''
    );

    if (!/^[0-9a-f-]{36}$/i.test(responsibleId)) {
      await cleanup();
      return json({ error: 'invalid_responsible' }, 400);
    }

    if (reason.length < 3 || reason.length > 500) {
      await cleanup();
      return json({ error: 'invalid_absence_reason' }, 400);
    }

    const { data: participant, error: participantError } =
      await admin
        .from('ps_event_collaborators')
        .select(
          'id,event_id,signed_at,absent,collaborator_name,ps_events!inner(hidden_from_evaluation)'
        )
        .eq('id', linkId)
        .in('participation_status', [
          'pending_confirmation',
          'confirmed',
        ])
        .is('signed_at', null)
        .eq('ps_events.hidden_from_evaluation', false)
        .maybeSingle();

    if (
      participantError ||
      !participant ||
      participant.absent
    ) {
      await cleanup();
      return json({ error: 'participant_unavailable' }, 403);
    }

    const { data: responsible, error: responsibleError } =
      await admin
        .from('ps_event_collaborators')
        .select(
          'id,event_id,collaborator_name,role_name,assigned_role,role_value,absent'
        )
        .eq('id', responsibleId)
        .eq('event_id', participant.event_id)
        .in('participation_status', [
          'pending_confirmation',
          'confirmed',
        ])
        .maybeSingle();

    const responsibleRole = [
      responsible?.role_name,
      responsible?.assigned_role,
      responsible?.role_value,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      responsibleError ||
      !responsible ||
      responsible.absent ||
      !responsibleRole.includes('coord')
    ) {
      await cleanup();
      return json({ error: 'responsible_not_allowed' }, 403);
    }

    const { error: absenceError } = await admin
      .from('ps_attendance_absences')
      .upsert(
        {
          event_id: participant.event_id,
          event_collaborator_id: participant.id,
          responsible_event_collaborator_id: responsible.id,
          responsible_name: responsible.collaborator_name,
          reason,
          signature_url: locator,
        },
        {
          onConflict: 'event_id,event_collaborator_id',
        }
      );

    if (absenceError) {
      await cleanup();
      return json({ error: 'absence_not_persisted' }, 409);
    }

    const { data: updated, error: updateError } = await admin
      .from('ps_event_collaborators')
      .update({
        absent: true,
        present: false,
        departed_at: null,
      })
      .eq('id', participant.id)
      .is('signed_at', null)
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      await admin
        .from('ps_attendance_absences')
        .delete()
        .eq('event_collaborator_id', participant.id)
        .eq('signature_url', locator);

      await cleanup();

      return json({ error: 'absence_not_persisted' }, 409);
    }

    return json({ locator, absence: true }, 201);
  }

  // ======================================================
  // PRESENÇA NORMAL
  // ======================================================
  const { data: participant, error: participantError } =
    await admin
      .from('ps_event_collaborators')
      .select(
        'id,event_id,signed_at,attendance_pix_confirmed_at,ps_events!inner(hidden_from_evaluation)'
      )
      .eq('id', linkId)
      .in('participation_status', [
        'pending_confirmation',
        'confirmed',
      ])
      .is('signed_at', null)
      .eq('ps_events.hidden_from_evaluation', false)
      .maybeSingle();

  if (participantError || !participant) {
    await cleanup();
    return json({ error: 'participant_unavailable' }, 403);
  }

  if (!participant.attendance_pix_confirmed_at) {
    await cleanup();
    return json(
      { error: 'attendance_details_not_confirmed' },
      409
    );
  }

  const { error: persistError } = await admin.rpc(
    'ps_public_sign_attendance',
    {
      p_link_id: linkId,
      p_signature: locator,
    }
  );

  const { data: confirmed } = await admin
    .from('ps_event_collaborators')
    .select('signature_url')
    .eq('id', linkId)
    .maybeSingle();

  if (
    !persistError &&
    confirmed?.signature_url === locator
  ) {
    return json({ locator }, 201);
  }

  const { count, error: countError } = await admin
    .from('ps_event_collaborators')
    .select('id', { count: 'exact', head: true })
    .eq('signature_url', locator);

  if (countError)
    return json(
      { error: 'persistence_indeterminate', preserved: true },
      503
    );

  if ((count ?? 0) === 0) {
    await cleanup();
  }

  return json(
    {
      error: persistError
        ? 'attendance_not_persisted'
        : 'persistence_indeterminate',
    },
    persistError ? 409 : 503
  );
});
