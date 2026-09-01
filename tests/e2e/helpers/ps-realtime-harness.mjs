export const REALISTIC_PS_CLIENTS = 10;

export async function subscribePsRealtimeClients({ clients, eventId, timeoutMs = 15_000 }) {
  if (!eventId || !Array.isArray(clients) || clients.length === 0) throw new Error('invalid_realtime_fixture');
  const counters = { participants: 0, evaluations: 0 };
  const channels = [];
  for (const [index, client] of clients.entries()) {
    const channel = client.channel(`ps-e2e-${eventId}-${index}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ps_event_collaborators', filter: `event_id=eq.${eventId}`,
      }, () => { counters.participants += 1; })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ps_evaluations', filter: `event_id=eq.${eventId}`,
      }, () => { counters.evaluations += 1; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`realtime_subscribe_timeout_${index}`)), timeoutMs);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
        if (status === 'CHANNEL_ERROR') { clearTimeout(timer); reject(new Error(`realtime_subscribe_error_${index}`)); }
      });
    });
    channels.push({ client, channel });
  }
  return {
    counters,
    close: () => Promise.all(channels.map(({ client, channel }) => client.removeChannel(channel))),
  };
}

export async function racePsParticipantState({ clients, link }) {
  if (clients.length < 2 || !link?.id || !link?.updated_at) throw new Error('invalid_presence_race_fixture');
  const results = await Promise.all([
    clients[0].rpc('ps_set_event_participant_state', {
      p_link_id: link.id, p_expected_updated_at: link.updated_at,
      p_present: true, p_absent: false, p_departed_at: null,
    }),
    clients[1].rpc('ps_set_event_participant_state', {
      p_link_id: link.id, p_expected_updated_at: link.updated_at,
      p_present: false, p_absent: true, p_departed_at: null,
    }),
  ]);
  if (results.some(result => result.error)) throw new Error('presence_race_transport_error');
  const winners = results.filter(result => result.data?.[0]?.success).length;
  const conflicts = results.filter(result => result.data?.[0]?.conflict).length;
  if (winners !== 1 || conflicts !== 1) throw new Error('presence_race_not_deterministic');
  return { winners, conflicts };
}
