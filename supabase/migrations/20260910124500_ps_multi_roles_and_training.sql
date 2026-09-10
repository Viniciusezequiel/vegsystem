-- Processo Seletivo: múltiplos cargos/pagamentos e treinamentos por cargo.
-- Change set preparado isoladamente; não aplicado automaticamente.

CREATE TABLE IF NOT EXISTS public.ps_event_collaborator_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  role_value text,
  role_name text NOT NULL,
  journey_key text,
  work_schedule text,
  pay_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (pay_value >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('legacy','manual','import','attendance_adjustment')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_event_collaborator_assignments_journey_check CHECK (journey_key IS NULL OR journey_key IN ('4h','6h','7h','8h','9h','integral'))
);
CREATE INDEX IF NOT EXISTS ps_event_collaborator_assignments_event_idx ON public.ps_event_collaborator_assignments(event_id,event_collaborator_id);
CREATE INDEX IF NOT EXISTS ps_event_collaborator_assignments_role_idx ON public.ps_event_collaborator_assignments(event_id,role_value);
CREATE INDEX IF NOT EXISTS ps_event_collaborator_assignments_link_idx ON public.ps_event_collaborator_assignments(event_collaborator_id);
CREATE UNIQUE INDEX IF NOT EXISTS ps_event_collaborator_assignments_one_primary_idx ON public.ps_event_collaborator_assignments(event_collaborator_id) WHERE is_primary=true;

CREATE OR REPLACE FUNCTION public.ps_resolve_role_value(p_role_name text)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  WITH input AS (
    SELECT lower(trim(coalesce(p_role_name,''))) raw,
      trim(both '_' from regexp_replace(translate(lower(trim(coalesce(p_role_name,''))),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]+','_','g')) slug
  )
  SELECT r.value FROM public.ps_roles r,input i
  WHERE lower(trim(r.name))=i.raw OR lower(trim(r.value))=i.slug OR lower(trim(r.value))=regexp_replace(i.slug,'_a$','')
    OR (r.value='subcoordenador' AND i.slug IN ('sucoordenador','sucoordenador_a','subcoordenador_a'))
  ORDER BY CASE WHEN lower(trim(r.name))=i.raw THEN 0 WHEN lower(trim(r.value))=i.slug THEN 1 ELSE 2 END,r."order" NULLS LAST,r.name LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.ps_resolve_role_value(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ps_resolve_role_value(text) TO authenticated,service_role;

INSERT INTO public.ps_event_collaborator_assignments(event_id,event_collaborator_id,role_value,role_name,work_schedule,pay_value,is_primary,source)
SELECT ec.event_id,ec.id,
  COALESCE(public.ps_resolve_role_value(ec.role_value),public.ps_resolve_role_value(COALESCE(ec.role_name,ec.assigned_role,'')),NULLIF(trim(ec.role_value),'')),
  COALESCE(NULLIF(trim(ec.role_name),''),NULLIF(trim(ec.assigned_role),''),'Função não informada'),ec.work_schedule,COALESCE(ec.pay_value,0),true,'legacy'
FROM public.ps_event_collaborators ec
WHERE NOT EXISTS (SELECT 1 FROM public.ps_event_collaborator_assignments a WHERE a.event_collaborator_id=ec.id);

CREATE OR REPLACE FUNCTION public.ps_validate_event_collaborator_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_event_id uuid;
BEGIN
  SELECT event_id INTO v_event_id FROM public.ps_event_collaborators WHERE id=NEW.event_collaborator_id;
  IF v_event_id IS NULL OR v_event_id<>NEW.event_id THEN RAISE EXCEPTION 'event_assignment_scope_mismatch'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ps_validate_event_collaborator_assignment_trg ON public.ps_event_collaborator_assignments;
CREATE TRIGGER ps_validate_event_collaborator_assignment_trg BEFORE INSERT OR UPDATE OF event_id,event_collaborator_id ON public.ps_event_collaborator_assignments FOR EACH ROW EXECUTE FUNCTION public.ps_validate_event_collaborator_assignment();
DROP TRIGGER IF EXISTS ps_event_collaborator_assignments_updated ON public.ps_event_collaborator_assignments;
CREATE TRIGGER ps_event_collaborator_assignments_updated BEFORE UPDATE ON public.ps_event_collaborator_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ps_sync_primary_assignment_to_event_collaborator()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_assignment public.ps_event_collaborator_assignments%rowtype; v_link_id uuid;
BEGIN
  v_link_id:=CASE WHEN TG_OP='DELETE' THEN OLD.event_collaborator_id ELSE NEW.event_collaborator_id END;
  SELECT * INTO v_assignment FROM public.ps_event_collaborator_assignments WHERE event_collaborator_id=v_link_id ORDER BY is_primary DESC,created_at,id LIMIT 1;
  IF FOUND THEN
    IF NOT v_assignment.is_primary THEN
      IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.is_primary=true AND NEW.is_primary=false) THEN
        UPDATE public.ps_event_collaborator_assignments SET is_primary=true WHERE id=v_assignment.id;
        v_assignment.is_primary:=true;
      ELSE
        IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END IF;
    END IF;
    UPDATE public.ps_event_collaborators SET role_value=v_assignment.role_value,role_name=v_assignment.role_name,
      work_schedule=COALESCE(v_assignment.work_schedule,work_schedule),pay_value=v_assignment.pay_value WHERE id=v_link_id;
  ELSE
    UPDATE public.ps_event_collaborators SET role_value=NULL,role_name=NULL,pay_value=0 WHERE id=v_link_id;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ps_sync_primary_assignment_to_event_collaborator_trg ON public.ps_event_collaborator_assignments;
CREATE TRIGGER ps_sync_primary_assignment_to_event_collaborator_trg AFTER INSERT OR UPDATE OR DELETE ON public.ps_event_collaborator_assignments FOR EACH ROW EXECUTE FUNCTION public.ps_sync_primary_assignment_to_event_collaborator();

CREATE OR REPLACE FUNCTION public.ps_sync_legacy_event_collaborator_to_primary_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_role_value text; v_role_name text; v_primary_id uuid;
BEGIN
  IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
  v_role_name:=COALESCE(NULLIF(trim(NEW.role_name),''),NULLIF(trim(NEW.assigned_role),''),'Função não informada');
  v_role_value:=COALESCE(public.ps_resolve_role_value(NEW.role_value),public.ps_resolve_role_value(v_role_name),NULLIF(trim(NEW.role_value),''));
  SELECT id INTO v_primary_id FROM public.ps_event_collaborator_assignments WHERE event_collaborator_id=NEW.id AND is_primary=true LIMIT 1;
  IF v_primary_id IS NULL THEN
    INSERT INTO public.ps_event_collaborator_assignments(event_id,event_collaborator_id,role_value,role_name,work_schedule,pay_value,is_primary,source)
    VALUES(NEW.event_id,NEW.id,v_role_value,v_role_name,NEW.work_schedule,COALESCE(NEW.pay_value,0),true,CASE WHEN NEW.import_tag IS NOT NULL THEN 'import' ELSE 'manual' END);
    IF TG_OP='INSERT' AND NEW.replacement_for_event_collaborator_id IS NOT NULL THEN
      INSERT INTO public.ps_event_collaborator_assignments(event_id,event_collaborator_id,role_value,role_name,journey_key,work_schedule,pay_value,is_primary,source,notes)
      SELECT NEW.event_id,NEW.id,old_a.role_value,old_a.role_name,old_a.journey_key,old_a.work_schedule,old_a.pay_value,false,'manual',old_a.notes
      FROM public.ps_event_collaborator_assignments old_a WHERE old_a.event_collaborator_id=NEW.replacement_for_event_collaborator_id AND old_a.is_primary=false;
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    UPDATE public.ps_event_collaborator_assignments SET role_value=v_role_value,role_name=v_role_name,work_schedule=NEW.work_schedule,
      pay_value=COALESCE(NEW.pay_value,0),source=CASE WHEN source='legacy' AND NEW.import_tag IS NOT NULL THEN 'import' ELSE source END WHERE id=v_primary_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ps_sync_legacy_event_collaborator_assignment_trg ON public.ps_event_collaborators;
CREATE TRIGGER ps_sync_legacy_event_collaborator_assignment_trg AFTER INSERT OR UPDATE OF role_value,role_name,assigned_role,pay_value,work_schedule ON public.ps_event_collaborators FOR EACH ROW EXECUTE FUNCTION public.ps_sync_legacy_event_collaborator_to_primary_assignment();
REVOKE ALL ON FUNCTION public.ps_sync_legacy_event_collaborator_to_primary_assignment() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ps_admin_replace_event_collaborator_assignments(p_event_collaborator_id uuid,p_assignments jsonb)
RETURNS TABLE(assignments_count integer,total_pay numeric)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_link public.ps_event_collaborators%rowtype; v_item jsonb; v_count integer:=0; v_total numeric:=0; v_role_name text; v_pay numeric; v_primary_id uuid; v_old_secondary_ids uuid[]:='{}'; v_first boolean:=true;
BEGIN
  SELECT * INTO v_link FROM public.ps_event_collaborators WHERE id=p_event_collaborator_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_collaborator_not_found'; END IF;
  IF jsonb_typeof(COALESCE(p_assignments,'[]'::jsonb))<>'array' OR jsonb_array_length(COALESCE(p_assignments,'[]'::jsonb))=0 THEN RAISE EXCEPTION 'assignment_required'; END IF;
  SELECT id INTO v_primary_id FROM public.ps_event_collaborator_assignments WHERE event_collaborator_id=p_event_collaborator_id AND is_primary=true ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  SELECT COALESCE(array_agg(id),'{}'::uuid[]) INTO v_old_secondary_ids FROM public.ps_event_collaborator_assignments WHERE event_collaborator_id=p_event_collaborator_id AND (v_primary_id IS NULL OR id<>v_primary_id);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_assignments) LOOP
    v_role_name:=NULLIF(trim(v_item->>'role_name'),''); IF v_role_name IS NULL THEN RAISE EXCEPTION 'assignment_role_required'; END IF;
    BEGIN v_pay:=COALESCE((v_item->>'pay_value')::numeric,0); EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_assignment_pay_value'; END;
    IF v_pay<0 THEN RAISE EXCEPTION 'invalid_assignment_pay_value'; END IF;
    IF v_first AND v_primary_id IS NOT NULL THEN
      UPDATE public.ps_event_collaborator_assignments SET role_value=NULLIF(trim(v_item->>'role_value'),''),role_name=v_role_name,journey_key=NULLIF(trim(v_item->>'journey_key'),''),work_schedule=NULLIF(trim(v_item->>'work_schedule'),''),pay_value=v_pay,is_primary=true,source=CASE WHEN v_item->>'source' IN ('legacy','manual','import','attendance_adjustment') THEN v_item->>'source' ELSE 'manual' END,notes=NULLIF(trim(v_item->>'notes'),'') WHERE id=v_primary_id;
    ELSE
      INSERT INTO public.ps_event_collaborator_assignments(event_id,event_collaborator_id,role_value,role_name,journey_key,work_schedule,pay_value,is_primary,source,notes)
      VALUES(v_link.event_id,p_event_collaborator_id,NULLIF(trim(v_item->>'role_value'),''),v_role_name,NULLIF(trim(v_item->>'journey_key'),''),NULLIF(trim(v_item->>'work_schedule'),''),v_pay,v_first,CASE WHEN v_item->>'source' IN ('legacy','manual','import','attendance_adjustment') THEN v_item->>'source' ELSE 'manual' END,NULLIF(trim(v_item->>'notes'),''));
    END IF;
    v_count:=v_count+1; v_total:=v_total+v_pay; v_first:=false;
  END LOOP;
  IF cardinality(v_old_secondary_ids)>0 THEN DELETE FROM public.ps_event_collaborator_assignments WHERE id=ANY(v_old_secondary_ids); END IF;
  RETURN QUERY SELECT v_count,v_total;
END; $$;
REVOKE ALL ON FUNCTION public.ps_admin_replace_event_collaborator_assignments(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_replace_event_collaborator_assignments(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.ps_admin_update_event_collaborator_details(p_event_collaborator_id uuid,p_patch jsonb,p_assignments jsonb)
RETURNS TABLE(link_id uuid,assignments_count integer,total_pay numeric)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_link public.ps_event_collaborators%rowtype; v_count integer; v_total numeric; v_pix text;
BEGIN
  SELECT * INTO v_link FROM public.ps_event_collaborators WHERE id=p_event_collaborator_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_collaborator_not_found'; END IF;
  IF jsonb_typeof(COALESCE(p_patch,'{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'invalid_event_collaborator_patch'; END IF;
  v_pix:=NULLIF(trim(p_patch->>'pix'),'');
  UPDATE public.ps_event_collaborators SET collaborator_name=COALESCE(NULLIF(trim(p_patch->>'collaborator_name'),''),collaborator_name),building=NULLIF(trim(p_patch->>'building'),''),floor=NULLIF(trim(p_patch->>'floor'),''),room=NULLIF(trim(p_patch->>'room'),''),campus=NULLIF(trim(p_patch->>'campus'),''),sector=NULLIF(trim(p_patch->>'sector'),''),email=NULLIF(trim(p_patch->>'email'),''),phone=NULLIF(trim(p_patch->>'phone'),''),pix=v_pix,deposit_info=NULLIF(trim(p_patch->>'deposit_info'),'') WHERE id=p_event_collaborator_id;
  IF v_link.collaborator_id IS NOT NULL AND v_pix IS NOT NULL THEN UPDATE public.ps_collaborators SET pix=v_pix WHERE id=v_link.collaborator_id; END IF;
  SELECT r.assignments_count,r.total_pay INTO v_count,v_total FROM public.ps_admin_replace_event_collaborator_assignments(p_event_collaborator_id,p_assignments) r;
  RETURN QUERY SELECT p_event_collaborator_id,v_count,v_total;
END; $$;
REVOKE ALL ON FUNCTION public.ps_admin_update_event_collaborator_details(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_update_event_collaborator_details(uuid,jsonb,jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS public.ps_event_training_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,name text NOT NULL,description text,required boolean NOT NULL DEFAULT true,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT ps_event_training_groups_name_check CHECK(length(trim(name)) BETWEEN 2 AND 160));
CREATE INDEX IF NOT EXISTS ps_event_training_groups_event_idx ON public.ps_event_training_groups(event_id,active);
CREATE TABLE IF NOT EXISTS public.ps_event_training_group_roles(training_group_id uuid NOT NULL REFERENCES public.ps_event_training_groups(id) ON DELETE CASCADE,role_value text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(training_group_id,role_value));
CREATE TABLE IF NOT EXISTS public.ps_event_training_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),training_group_id uuid NOT NULL REFERENCES public.ps_event_training_groups(id) ON DELETE CASCADE,event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,starts_at timestamptz NOT NULL,ends_at timestamptz,campus text NOT NULL,location text,room text,capacity integer CHECK(capacity IS NULL OR capacity>0),active boolean NOT NULL DEFAULT true,notes text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT ps_event_training_sessions_time_check CHECK(ends_at IS NULL OR ends_at>starts_at));
CREATE INDEX IF NOT EXISTS ps_event_training_sessions_group_idx ON public.ps_event_training_sessions(training_group_id,starts_at);
CREATE INDEX IF NOT EXISTS ps_event_training_sessions_event_idx ON public.ps_event_training_sessions(event_id,active,starts_at);
CREATE TABLE IF NOT EXISTS public.ps_event_training_choices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,training_group_id uuid NOT NULL REFERENCES public.ps_event_training_groups(id) ON DELETE CASCADE,training_session_id uuid NOT NULL REFERENCES public.ps_event_training_sessions(id) ON DELETE RESTRICT,selected_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(event_collaborator_id,training_group_id));
CREATE INDEX IF NOT EXISTS ps_event_training_choices_event_idx ON public.ps_event_training_choices(event_id,training_group_id);
CREATE INDEX IF NOT EXISTS ps_event_training_choices_session_idx ON public.ps_event_training_choices(training_session_id);
CREATE INDEX IF NOT EXISTS ps_event_training_choices_group_idx ON public.ps_event_training_choices(training_group_id);

CREATE OR REPLACE FUNCTION public.ps_validate_training_scope() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_group_event uuid; v_session_event uuid; v_session_group uuid; v_link_event uuid;
BEGIN
 SELECT event_id INTO v_group_event FROM public.ps_event_training_groups WHERE id=NEW.training_group_id;
 SELECT event_id,training_group_id INTO v_session_event,v_session_group FROM public.ps_event_training_sessions WHERE id=NEW.training_session_id;
 SELECT event_id INTO v_link_event FROM public.ps_event_collaborators WHERE id=NEW.event_collaborator_id;
 IF v_group_event IS NULL OR v_session_event IS NULL OR v_link_event IS NULL OR NEW.event_id<>v_group_event OR NEW.event_id<>v_session_event OR NEW.event_id<>v_link_event OR v_session_group<>NEW.training_group_id THEN RAISE EXCEPTION 'training_scope_mismatch'; END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.ps_validate_event_training_session_scope() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$ DECLARE v_group_event uuid; BEGIN SELECT event_id INTO v_group_event FROM public.ps_event_training_groups WHERE id=NEW.training_group_id; IF v_group_event IS NULL OR v_group_event<>NEW.event_id THEN RAISE EXCEPTION 'training_session_scope_mismatch'; END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS ps_validate_training_session_scope_trg ON public.ps_event_training_sessions;
CREATE TRIGGER ps_validate_training_session_scope_trg BEFORE INSERT OR UPDATE OF event_id,training_group_id ON public.ps_event_training_sessions FOR EACH ROW EXECUTE FUNCTION public.ps_validate_event_training_session_scope();
DROP TRIGGER IF EXISTS ps_validate_training_choice_scope_trg ON public.ps_event_training_choices;
CREATE TRIGGER ps_validate_training_choice_scope_trg BEFORE INSERT OR UPDATE OF event_id,event_collaborator_id,training_group_id,training_session_id ON public.ps_event_training_choices FOR EACH ROW EXECUTE FUNCTION public.ps_validate_training_scope();
DROP TRIGGER IF EXISTS ps_event_training_groups_updated ON public.ps_event_training_groups;
CREATE TRIGGER ps_event_training_groups_updated BEFORE UPDATE ON public.ps_event_training_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS ps_event_training_sessions_updated ON public.ps_event_training_sessions;
CREATE TRIGGER ps_event_training_sessions_updated BEFORE UPDATE ON public.ps_event_training_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS ps_event_training_choices_updated ON public.ps_event_training_choices;
CREATE TRIGGER ps_event_training_choices_updated BEFORE UPDATE ON public.ps_event_training_choices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.ps_public_get_event_collaborator_confirmation_v2(p_event_id uuid,p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_link public.ps_event_collaborators%rowtype; v_event public.ps_events%rowtype; v_payload jsonb;
BEGIN
 SELECT ec.* INTO v_link FROM public.ps_event_collaborators ec WHERE ec.event_id=p_event_id AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_event FROM public.ps_events WHERE id=p_event_id;
 SELECT jsonb_build_object('link_id',v_link.id,'event_name',v_event.name,'event_date',v_event.date,'collaborator_name',v_link.collaborator_name,'unit',v_link.unit,'room',v_link.room,'participation_status',v_link.participation_status,
 'token_state',CASE WHEN v_link.public_confirmation_token_expires_at<=now() THEN 'expired' WHEN v_link.public_confirmation_token_revoked_at IS NOT NULL THEN 'used' ELSE 'valid' END,
 'assignments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'role_value',a.role_value,'role_name',a.role_name,'journey_key',a.journey_key,'work_schedule',a.work_schedule,'is_primary',a.is_primary) ORDER BY a.is_primary DESC,a.created_at) FROM public.ps_event_collaborator_assignments a WHERE a.event_collaborator_id=v_link.id),'[]'::jsonb),
 'training_groups',COALESCE((SELECT jsonb_agg(group_row.payload ORDER BY group_row.name) FROM (
   SELECT tg.name,jsonb_build_object('id',tg.id,'name',tg.name,'description',tg.description,'required',tg.required,
    'options',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ts.id,'starts_at',ts.starts_at,'ends_at',ts.ends_at,'campus',ts.campus,'location',ts.location,'room',ts.room,'capacity',ts.capacity,'selected_count',(SELECT count(*) FROM public.ps_event_training_choices tc WHERE tc.training_session_id=ts.id),'available',ts.active AND (ts.capacity IS NULL OR (SELECT count(*) FROM public.ps_event_training_choices tc WHERE tc.training_session_id=ts.id)<ts.capacity)) ORDER BY ts.starts_at) FROM public.ps_event_training_sessions ts WHERE ts.training_group_id=tg.id AND ts.active=true),'[]'::jsonb),
    'selected_session_id',(SELECT tc.training_session_id FROM public.ps_event_training_choices tc JOIN public.ps_event_training_sessions selected_ts ON selected_ts.id=tc.training_session_id AND selected_ts.active=true WHERE tc.event_collaborator_id=v_link.id AND tc.training_group_id=tg.id)) payload
   FROM public.ps_event_training_groups tg WHERE tg.event_id=p_event_id AND tg.active=true AND EXISTS(SELECT 1 FROM public.ps_event_training_group_roles tgr JOIN public.ps_event_collaborator_assignments a ON a.event_collaborator_id=v_link.id AND a.role_value=tgr.role_value WHERE tgr.training_group_id=tg.id)
 ) group_row),'[]'::jsonb)) INTO v_payload;
 RETURN v_payload;
END; $$;

CREATE OR REPLACE FUNCTION public.ps_public_get_event_collaborator_confirmation_v2(p_event_id uuid,p_token text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.ps_public_get_event_collaborator_confirmation_v2(p_event_id,p_token); $$;

CREATE OR REPLACE FUNCTION private.ps_public_set_event_collaborator_confirmation_v2(p_event_id uuid,p_token text,p_status text,p_decline_reason text DEFAULT NULL,p_training_choices jsonb DEFAULT '[]'::jsonb)
RETURNS TABLE(success boolean,participation_status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_link_id uuid; v_status text; v_choice jsonb; v_group_id uuid; v_session_id uuid; v_capacity integer; v_taken integer;
BEGIN
 IF p_status NOT IN ('confirmed','declined') THEN RAISE EXCEPTION 'invalid_confirmation_status'; END IF;
 IF p_status='declined' AND nullif(trim(p_decline_reason),'') IS NULL THEN RAISE EXCEPTION 'decline_reason_required'; END IF;
 IF jsonb_typeof(COALESCE(p_training_choices,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'invalid_training_selection'; END IF;
 SELECT ec.id INTO v_link_id FROM public.ps_event_collaborators ec WHERE ec.event_id=p_event_id AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND ec.public_confirmation_token_revoked_at IS NULL AND ec.public_confirmation_token_expires_at>now() AND ec.participation_status='pending_confirmation' FOR UPDATE;
 IF v_link_id IS NULL THEN
  SELECT ec.participation_status INTO v_status FROM public.ps_event_collaborators ec WHERE ec.event_id=p_event_id AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND ec.public_confirmation_token_expires_at>now() AND ec.public_confirmation_token_revoked_at IS NOT NULL AND ec.participation_status=p_status;
  RETURN QUERY SELECT v_status IS NOT NULL,v_status; RETURN;
 END IF;
 IF p_status='confirmed' THEN
  FOR v_choice IN SELECT value FROM jsonb_array_elements(COALESCE(p_training_choices,'[]'::jsonb)) LOOP
   BEGIN v_group_id:=(v_choice->>'training_group_id')::uuid; v_session_id:=(v_choice->>'training_session_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_training_selection'; END;
   IF NOT EXISTS(SELECT 1 FROM public.ps_event_training_groups tg JOIN public.ps_event_training_group_roles tgr ON tgr.training_group_id=tg.id JOIN public.ps_event_collaborator_assignments a ON a.event_collaborator_id=v_link_id AND a.role_value=tgr.role_value WHERE tg.id=v_group_id AND tg.event_id=p_event_id AND tg.active=true) THEN RAISE EXCEPTION 'invalid_training_selection'; END IF;
   SELECT ts.capacity INTO v_capacity FROM public.ps_event_training_sessions ts WHERE ts.id=v_session_id AND ts.event_id=p_event_id AND ts.training_group_id=v_group_id AND ts.active=true FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'invalid_training_selection'; END IF;
   SELECT count(*) INTO v_taken FROM public.ps_event_training_choices tc WHERE tc.training_session_id=v_session_id AND NOT(tc.event_collaborator_id=v_link_id AND tc.training_group_id=v_group_id);
   IF v_capacity IS NOT NULL AND v_taken>=v_capacity THEN RAISE EXCEPTION 'training_session_full'; END IF;
   INSERT INTO public.ps_event_training_choices(event_id,event_collaborator_id,training_group_id,training_session_id,selected_at) VALUES(p_event_id,v_link_id,v_group_id,v_session_id,now()) ON CONFLICT(event_collaborator_id,training_group_id) DO UPDATE SET training_session_id=EXCLUDED.training_session_id,selected_at=now(),updated_at=now();
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.ps_event_training_groups tg WHERE tg.event_id=p_event_id AND tg.active=true AND tg.required=true
    AND EXISTS(SELECT 1 FROM public.ps_event_training_group_roles tgr JOIN public.ps_event_collaborator_assignments a ON a.event_collaborator_id=v_link_id AND a.role_value=tgr.role_value WHERE tgr.training_group_id=tg.id)
    AND NOT EXISTS(SELECT 1 FROM public.ps_event_training_choices tc JOIN public.ps_event_training_sessions ts ON ts.id=tc.training_session_id WHERE tc.event_collaborator_id=v_link_id AND tc.training_group_id=tg.id AND ts.event_id=p_event_id AND ts.training_group_id=tg.id AND ts.active=true)) THEN RAISE EXCEPTION 'training_selection_required'; END IF;
 END IF;
 UPDATE public.ps_event_collaborators SET participation_status=p_status,confirmed_at=CASE WHEN p_status='confirmed' THEN now() ELSE NULL END,declined_at=CASE WHEN p_status='declined' THEN now() ELSE NULL END,decline_reason=CASE WHEN p_status='declined' THEN trim(p_decline_reason) ELSE NULL END,public_confirmation_token_revoked_at=now() WHERE id=v_link_id RETURNING public.ps_event_collaborators.participation_status INTO v_status;
 RETURN QUERY SELECT true,v_status;
END; $$;

CREATE OR REPLACE FUNCTION public.ps_public_set_event_collaborator_confirmation_v2(p_event_id uuid,p_token text,p_status text,p_decline_reason text DEFAULT NULL,p_training_choices jsonb DEFAULT '[]'::jsonb)
RETURNS TABLE(success boolean,participation_status text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM private.ps_public_set_event_collaborator_confirmation_v2(p_event_id,p_token,p_status,p_decline_reason,p_training_choices); $$;
CREATE OR REPLACE FUNCTION public.ps_public_set_event_collaborator_confirmation(p_event_id uuid,p_token text,p_status text,p_decline_reason text DEFAULT NULL)
RETURNS TABLE(success boolean,participation_status text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM public.ps_public_set_event_collaborator_confirmation_v2(p_event_id,p_token,p_status,p_decline_reason,'[]'::jsonb); $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_event_collaborator_assignments TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_event_training_groups TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_event_training_group_roles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_event_training_sessions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_event_training_choices TO authenticated;
GRANT ALL ON public.ps_event_collaborator_assignments TO service_role;
GRANT ALL ON public.ps_event_training_groups TO service_role;
GRANT ALL ON public.ps_event_training_group_roles TO service_role;
GRANT ALL ON public.ps_event_training_sessions TO service_role;
GRANT ALL ON public.ps_event_training_choices TO service_role;
ALTER TABLE public.ps_event_collaborator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_training_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_training_group_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_training_choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_event_collaborator_assignments internal manage" ON public.ps_event_collaborator_assignments FOR ALL TO authenticated USING((select public.is_internal_user(auth.uid()))) WITH CHECK((select public.is_internal_user(auth.uid())));
CREATE POLICY "ps_event_training_groups internal manage" ON public.ps_event_training_groups FOR ALL TO authenticated USING((select public.is_internal_user(auth.uid()))) WITH CHECK((select public.is_internal_user(auth.uid())));
CREATE POLICY "ps_event_training_group_roles internal manage" ON public.ps_event_training_group_roles FOR ALL TO authenticated USING((select public.is_internal_user(auth.uid()))) WITH CHECK((select public.is_internal_user(auth.uid())));
CREATE POLICY "ps_event_training_sessions internal manage" ON public.ps_event_training_sessions FOR ALL TO authenticated USING((select public.is_internal_user(auth.uid()))) WITH CHECK((select public.is_internal_user(auth.uid())));
CREATE POLICY "ps_event_training_choices internal manage" ON public.ps_event_training_choices FOR ALL TO authenticated USING((select public.is_internal_user(auth.uid()))) WITH CHECK((select public.is_internal_user(auth.uid())));
GRANT USAGE ON SCHEMA private TO anon,authenticated;
REVOKE ALL ON FUNCTION private.ps_public_get_event_collaborator_confirmation_v2(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.ps_public_get_event_collaborator_confirmation_v2(uuid,text) TO anon,authenticated;
REVOKE ALL ON FUNCTION private.ps_public_set_event_collaborator_confirmation_v2(uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.ps_public_set_event_collaborator_confirmation_v2(uuid,text,text,text,jsonb) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.ps_public_get_event_collaborator_confirmation_v2(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_get_event_collaborator_confirmation_v2(uuid,text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.ps_public_set_event_collaborator_confirmation_v2(uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_set_event_collaborator_confirmation_v2(uuid,text,text,text,jsonb) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.ps_public_set_event_collaborator_confirmation(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_set_event_collaborator_confirmation(uuid,text,text,text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.ps_validate_event_collaborator_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_sync_primary_assignment_to_event_collaborator() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_validate_event_training_session_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_validate_training_scope() FROM PUBLIC;
