-- Evita refetch do histórico completo de comunicações a cada mudança de status.
-- O Realtime passa a carregar somente a linha alterada, que o cliente aplica no cache.
CREATE OR REPLACE FUNCTION public.ps_event_communications_realtime_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'event_id', NEW.event_id,
      'job_id', NEW.id,
      'row', jsonb_build_object(
        'id', NEW.id,
        'batch_id', NEW.batch_id,
        'event_id', NEW.event_id,
        'event_collaborator_id', NEW.event_collaborator_id,
        'communication_type', NEW.communication_type,
        'logical_recipient', NEW.logical_recipient,
        'actual_recipient', NEW.actual_recipient,
        'subject', NEW.subject,
        'status', NEW.status,
        'provider', NEW.provider,
        'provider_message_id', NEW.provider_message_id,
        'delivery_status', NEW.delivery_status,
        'delivered_at', NEW.delivered_at,
        'opened_at', NEW.opened_at,
        'clicked_at', NEW.clicked_at,
        'provider_last_event', NEW.provider_last_event,
        'provider_last_event_at', NEW.provider_last_event_at,
        'attempt_count', NEW.attempt_count,
        'requested_at', NEW.requested_at,
        'sent_at', NEW.sent_at,
        'failed_at', NEW.failed_at,
        'last_error', NEW.last_error,
        'created_at', NEW.created_at
      )
    ),
    'communications_changed',
    'ps:event:' || NEW.event_id,
    false
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS ps_event_communications_realtime_broadcast
ON public.ps_event_communications;

CREATE TRIGGER ps_event_communications_realtime_broadcast
AFTER INSERT OR UPDATE OF
  status,
  attempt_count,
  sent_at,
  failed_at,
  last_error,
  actual_recipient,
  provider,
  provider_message_id,
  delivery_status,
  delivered_at,
  opened_at,
  clicked_at,
  provider_last_event,
  provider_last_event_at
ON public.ps_event_communications
FOR EACH ROW
EXECUTE FUNCTION public.ps_event_communications_realtime_broadcast();

REVOKE ALL
ON FUNCTION public.ps_event_communications_realtime_broadcast()
FROM PUBLIC, anon, authenticated;
