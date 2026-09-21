-- Processo Seletivo: links públicos de confirmação sem expiração.
-- O link permanece válido enquanto não for revogado pela confirmação ou substituição.

UPDATE public.ps_event_collaborators
SET public_confirmation_token_expires_at = NULL
WHERE public_confirmation_token_hash IS NOT NULL
  AND public_confirmation_token_revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.ps_request_event_collaborator_confirmation(
  p_link_id uuid, p_rotate boolean DEFAULT false, p_ttl interval DEFAULT interval '72 hours'
) RETURNS TABLE(token text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions, pg_temp AS $$
DECLARE v_token text; v_current_token text; v_status text;
BEGIN
  SELECT public_confirmation_token_hash, participation_status INTO v_current_token, v_status
  FROM public.ps_event_collaborators WHERE id=p_link_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_collaborator_not_found'; END IF;
  IF v_status='replaced' THEN RAISE EXCEPTION 'replaced_collaborator_cannot_be_reactivated'; END IF;
  IF v_status='confirmed' THEN RAISE EXCEPTION 'collaborator_already_confirmed'; END IF;
  IF NOT p_rotate AND v_current_token IS NOT NULL THEN RAISE EXCEPTION 'active_confirmation_token_exists'; END IF;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.ps_event_collaborators
  SET participation_status='pending_confirmation', confirmation_requested_at=now(),
      confirmed_at=NULL, declined_at=NULL, decline_reason=NULL,
      public_confirmation_token_hash=encode(extensions.digest(v_token,'sha256'),'hex'),
      public_confirmation_token_expires_at=NULL, public_confirmation_token_revoked_at=NULL
  WHERE id=p_link_id;
  RETURN QUERY SELECT v_token, NULL::timestamptz;
END $$;

CREATE OR REPLACE FUNCTION public.ps_prepare_confirmation_communication(p_link_id uuid)
RETURNS TABLE(token text, token_version integer, expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public,extensions,pg_temp AS $$
DECLARE v_token text; v_version integer;
BEGIN
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  UPDATE public.ps_event_collaborators
  SET participation_status='pending_confirmation', confirmation_requested_at=now(),
      confirmed_at=NULL, declined_at=NULL, decline_reason=NULL,
      confirmation_token_version=confirmation_token_version+1,
      public_confirmation_token_hash=encode(extensions.digest(v_token,'sha256'),'hex'),
      public_confirmation_token_expires_at=NULL, public_confirmation_token_revoked_at=NULL
  WHERE id=p_link_id AND participation_status<>'replaced'
  RETURNING confirmation_token_version INTO v_version;
  IF v_version IS NULL THEN RAISE EXCEPTION 'invalid_confirmation_recipient'; END IF;
  RETURN QUERY SELECT v_token,v_version,NULL::timestamptz;
END $$;

CREATE OR REPLACE FUNCTION public.ps_public_get_event_collaborator_confirmation(p_event_id uuid,p_token text)
RETURNS TABLE(link_id uuid,event_name text,event_date date,collaborator_name text,role_name text,unit text,room text,participation_status text,token_state text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
  SELECT ec.id,e.name,e.date,ec.collaborator_name,coalesce(ec.role_name,ec.assigned_role),ec.unit,ec.room,ec.participation_status,
    CASE WHEN ec.public_confirmation_token_revoked_at IS NOT NULL THEN 'used' ELSE 'valid' END
  FROM public.ps_event_collaborators ec JOIN public.ps_events e ON e.id=ec.event_id
  WHERE ec.event_id=p_event_id AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
$$;

CREATE OR REPLACE FUNCTION private.ps_public_get_event_collaborator_confirmation_v2(p_event_id uuid,p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_link public.ps_event_collaborators%rowtype; v_event public.ps_events%rowtype; v_payload jsonb;
BEGIN
 SELECT ec.* INTO v_link FROM public.ps_event_collaborators ec
 WHERE ec.event_id=p_event_id AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_event FROM public.ps_events WHERE id=p_event_id;
 SELECT jsonb_build_object(
  'link_id',v_link.id,'event_name',v_event.name,'event_date',v_event.date,
  'collaborator_name',v_link.collaborator_name,'unit',v_link.unit,'room',v_link.room,
  'participation_status',v_link.participation_status,
  'token_state',CASE WHEN v_link.public_confirmation_token_revoked_at IS NOT NULL THEN 'used' ELSE 'valid' END,
  'assignments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'role_value',a.role_value,'role_name',a.role_name,'journey_key',a.journey_key,'work_schedule',a.work_schedule,'is_primary',a.is_primary) ORDER BY a.is_primary DESC,a.created_at) FROM public.ps_event_collaborator_assignments a WHERE a.event_collaborator_id=v_link.id),'[]'::jsonb),
  'training_groups',COALESCE((SELECT jsonb_agg(group_row.payload ORDER BY group_row.name) FROM (
   SELECT tg.name,jsonb_build_object('id',tg.id,'name',tg.name,'description',tg.description,'required',tg.required,
    'options',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ts.id,'starts_at',ts.starts_at,'ends_at',ts.ends_at,'campus',ts.campus,'location',ts.location,'room',ts.room,'capacity',ts.capacity,'selected_count',(SELECT count(*) FROM public.ps_event_training_choices tc WHERE tc.training_session_id=ts.id),'available',ts.active AND (ts.capacity IS NULL OR (SELECT count(*) FROM public.ps_event_training_choices tc WHERE tc.training_session_id=ts.id)<ts.capacity)) ORDER BY ts.starts_at) FROM public.ps_event_training_sessions ts WHERE ts.training_group_id=tg.id AND ts.active=true),'[]'::jsonb),
    'selected_session_id',(SELECT tc.training_session_id FROM public.ps_event_training_choices tc JOIN public.ps_event_training_sessions selected_ts ON selected_ts.id=tc.training_session_id AND selected_ts.active=true WHERE tc.event_collaborator_id=v_link.id AND tc.training_group_id=tg.id)) payload
   FROM public.ps_event_training_groups tg WHERE tg.event_id=p_event_id AND tg.active=true
   AND EXISTS(SELECT 1 FROM public.ps_event_training_group_roles tgr JOIN public.ps_event_collaborator_assignments a ON a.event_collaborator_id=v_link.id AND a.role_value=tgr.role_value WHERE tgr.training_group_id=tg.id)
  ) group_row),'[]'::jsonb)
 ) INTO v_payload;
 RETURN v_payload;
END $$;

CREATE OR REPLACE FUNCTION private.ps_public_set_event_collaborator_confirmation_v2(
 p_event_id uuid,p_token text,p_status text,p_decline_reason text DEFAULT NULL,p_training_choices jsonb DEFAULT '[]'::jsonb
) RETURNS TABLE(success boolean,participation_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_link_id uuid; v_status text; v_choice jsonb; v_group_id uuid; v_session_id uuid; v_capacity integer; v_taken integer;
BEGIN
 IF p_status NOT IN ('confirmed','declined') THEN RAISE EXCEPTION 'invalid_confirmation_status'; END IF;
 IF p_status='declined' AND nullif(trim(p_decline_reason),'') IS NULL THEN RAISE EXCEPTION 'decline_reason_required'; END IF;
 IF jsonb_typeof(COALESCE(p_training_choices,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'invalid_training_selection'; END IF;
 SELECT ec.id INTO v_link_id FROM public.ps_event_collaborators ec
 WHERE ec.event_id=p_event_id AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
   AND ec.public_confirmation_token_revoked_at IS NULL AND ec.participation_status='pending_confirmation' FOR UPDATE;
 IF v_link_id IS NULL THEN
  SELECT ec.participation_status INTO v_status FROM public.ps_event_collaborators ec
  WHERE ec.event_id=p_event_id AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    AND ec.public_confirmation_token_revoked_at IS NOT NULL AND ec.participation_status=p_status;
  RETURN QUERY SELECT v_status IS NOT NULL,v_status; RETURN;
 END IF;
 IF p_status='confirmed' THEN
  FOR v_choice IN SELECT value FROM jsonb_array_elements(COALESCE(p_training_choices,'[]'::jsonb)) LOOP
   BEGIN v_group_id:=(v_choice->>'training_group_id')::uuid; v_session_id:=(v_choice->>'training_session_id')::uuid;
   EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_training_selection'; END;
   IF NOT EXISTS(SELECT 1 FROM public.ps_event_training_groups tg JOIN public.ps_event_training_group_roles tgr ON tgr.training_group_id=tg.id JOIN public.ps_event_collaborator_assignments a ON a.event_collaborator_id=v_link_id AND a.role_value=tgr.role_value WHERE tg.id=v_group_id AND tg.event_id=p_event_id AND tg.active=true) THEN RAISE EXCEPTION 'invalid_training_selection'; END IF;
   SELECT ts.capacity INTO v_capacity FROM public.ps_event_training_sessions ts WHERE ts.id=v_session_id AND ts.event_id=p_event_id AND ts.training_group_id=v_group_id AND ts.active=true FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_training_selection'; END IF;
   SELECT count(*) INTO v_taken FROM public.ps_event_training_choices tc WHERE tc.training_session_id=v_session_id AND NOT(tc.event_collaborator_id=v_link_id AND tc.training_group_id=v_group_id);
   IF v_capacity IS NOT NULL AND v_taken>=v_capacity THEN RAISE EXCEPTION 'training_session_full'; END IF;
   INSERT INTO public.ps_event_training_choices(event_id,event_collaborator_id,training_group_id,training_session_id,selected_at)
   VALUES(p_event_id,v_link_id,v_group_id,v_session_id,now())
   ON CONFLICT(event_collaborator_id,training_group_id) DO UPDATE SET training_session_id=EXCLUDED.training_session_id,selected_at=now(),updated_at=now();
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.ps_event_training_groups tg WHERE tg.event_id=p_event_id AND tg.active=true AND tg.required=true
    AND EXISTS(SELECT 1 FROM public.ps_event_training_group_roles tgr JOIN public.ps_event_collaborator_assignments a ON a.event_collaborator_id=v_link_id AND a.role_value=tgr.role_value WHERE tgr.training_group_id=tg.id)
    AND NOT EXISTS(SELECT 1 FROM public.ps_event_training_choices tc JOIN public.ps_event_training_sessions ts ON ts.id=tc.training_session_id WHERE tc.event_collaborator_id=v_link_id AND tc.training_group_id=tg.id AND ts.event_id=p_event_id AND ts.training_group_id=tg.id AND ts.active=true))
  THEN RAISE EXCEPTION 'training_selection_required'; END IF;
 END IF;
 UPDATE public.ps_event_collaborators SET participation_status=p_status,
  confirmed_at=CASE WHEN p_status='confirmed' THEN now() ELSE NULL END,
  declined_at=CASE WHEN p_status='declined' THEN now() ELSE NULL END,
  decline_reason=CASE WHEN p_status='declined' THEN trim(p_decline_reason) ELSE NULL END,
  public_confirmation_token_revoked_at=now()
 WHERE id=v_link_id RETURNING participation_status INTO v_status;
 RETURN QUERY SELECT true,v_status;
END $$;
