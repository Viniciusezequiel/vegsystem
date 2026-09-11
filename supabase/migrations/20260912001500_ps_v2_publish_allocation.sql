-- Processo Seletivo 2: publicação segura e idempotente de uma proposta revisada.
-- A função publica somente itens aceitos e preserva vínculos já existentes no evento.

CREATE OR REPLACE FUNCTION public.ps_v2_publish_allocation_run(
  p_event_id uuid,
  p_run_id uuid
)
RETURNS TABLE (
  allocation_run_id uuid,
  target_event_id uuid,
  inserted_count integer,
  existing_count integer,
  accepted_count integer,
  already_published boolean,
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_run public.ps_v2_allocation_runs%ROWTYPE;
  v_accepted_count integer := 0;
  v_inserted_count integer := 0;
  v_existing_count integer := 0;
  v_published_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'ps_v2_publish_admin_required';
  END IF;

  SELECT *
  INTO v_run
  FROM public.ps_v2_allocation_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ps_v2_allocation_run_not_found';
  END IF;

  IF v_run.event_id <> p_event_id THEN
    RAISE EXCEPTION 'ps_v2_allocation_run_event_mismatch';
  END IF;

  -- Serializa publicações do mesmo evento, inclusive quando existem runs diferentes.
  PERFORM pg_advisory_xact_lock(hashtextextended('ps-v2-publish:' || v_run.event_id::text, 0));

  SELECT count(*)::integer
  INTO v_accepted_count
  FROM public.ps_v2_allocation_items item
  WHERE item.run_id = v_run.id
    AND item.status = 'accepted'
    AND item.collaborator_id IS NOT NULL;

  IF v_run.status = 'published' THEN
    SELECT count(*)::integer
    INTO v_existing_count
    FROM public.ps_v2_allocation_items item
    JOIN public.ps_event_collaborators event_link
      ON event_link.event_id = v_run.event_id
     AND event_link.collaborator_id = item.collaborator_id
    WHERE item.run_id = v_run.id
      AND item.status = 'accepted'
      AND item.collaborator_id IS NOT NULL;

    RETURN QUERY
    SELECT v_run.id, v_run.event_id, 0, v_existing_count, v_accepted_count, true, v_run.published_at;
    RETURN;
  END IF;

  IF v_run.status <> 'review' THEN
    RAISE EXCEPTION 'ps_v2_allocation_run_not_in_review';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ps_v2_allocation_items item
    WHERE item.run_id = v_run.id
      AND item.collaborator_id IS NOT NULL
      AND item.status = 'suggested'
  ) THEN
    RAISE EXCEPTION 'ps_v2_allocation_review_incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ps_v2_allocation_items item
    WHERE item.run_id = v_run.id
      AND item.status = 'accepted'
      AND item.collaborator_id IS NULL
  ) THEN
    RAISE EXCEPTION 'ps_v2_accepted_item_without_collaborator';
  END IF;

  IF v_accepted_count = 0 THEN
    RAISE EXCEPTION 'ps_v2_no_accepted_allocations';
  END IF;

  -- O V2 trabalha, nesta fase, com uma pessoa por evento. Não colapsa duplicidades silenciosamente.
  IF EXISTS (
    SELECT item.collaborator_id
    FROM public.ps_v2_allocation_items item
    WHERE item.run_id = v_run.id
      AND item.status = 'accepted'
      AND item.collaborator_id IS NOT NULL
    GROUP BY item.collaborator_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ps_v2_duplicate_collaborator_in_accepted_allocations';
  END IF;

  -- Uma necessidade padrão (event_id NULL) pode ser reutilizada; uma necessidade de outro evento não pode.
  IF EXISTS (
    SELECT 1
    FROM public.ps_v2_allocation_items item
    JOIN public.ps_v2_staff_requirements requirement ON requirement.id = item.requirement_id
    WHERE item.run_id = v_run.id
      AND item.status = 'accepted'
      AND requirement.event_id IS NOT NULL
      AND requirement.event_id <> v_run.event_id
  ) THEN
    RAISE EXCEPTION 'ps_v2_requirement_event_mismatch';
  END IF;

  INSERT INTO public.ps_event_collaborators (
    event_id,
    collaborator_id,
    collaborator_name,
    role_value,
    role_name,
    assigned_role,
    sector,
    unit,
    institution,
    campus,
    building,
    floor,
    room,
    work_schedule,
    cpf,
    identity_doc,
    email,
    phone,
    mobile,
    pay_value,
    pix,
    import_tag
  )
  SELECT
    v_run.event_id,
    collaborator.id,
    collaborator.full_name,
    COALESCE(role.value, public.ps_resolve_role_value(requirement.role_name_snapshot)),
    requirement.role_name_snapshot,
    requirement.role_name_snapshot,
    collaborator.sector,
    collaborator.unit,
    collaborator.institution,
    scoped_location.name,
    scoped_building.name,
    scoped_floor.name,
    COALESCE(environment.name, area.name),
    COALESCE(
      CASE
        WHEN requirement.start_time IS NOT NULL AND requirement.end_time IS NOT NULL
          THEN to_char(requirement.start_time, 'HH24:MI') || ' às ' || to_char(requirement.end_time, 'HH24:MI')
        WHEN requirement.start_time IS NOT NULL THEN 'A partir de ' || to_char(requirement.start_time, 'HH24:MI')
        WHEN requirement.end_time IS NOT NULL THEN 'Até ' || to_char(requirement.end_time, 'HH24:MI')
        ELSE NULL
      END,
      collaborator.journey
    ),
    collaborator.cpf,
    collaborator.identity_doc,
    collaborator.email,
    collaborator.phone,
    collaborator.mobile,
    COALESCE(role.pay_value, 0),
    collaborator.pix,
    'ps-v2-publish:' || v_run.id::text
  FROM public.ps_v2_allocation_items item
  JOIN public.ps_v2_staff_requirements requirement ON requirement.id = item.requirement_id
  JOIN public.ps_collaborators collaborator ON collaborator.id = item.collaborator_id
  LEFT JOIN public.ps_roles role ON role.id = requirement.role_id
  LEFT JOIN public.ps_v2_areas area ON area.id = requirement.area_id
  LEFT JOIN public.ps_v2_environments environment ON environment.id = requirement.environment_id
  LEFT JOIN public.ps_v2_floors scoped_floor
    ON scoped_floor.id = COALESCE(requirement.floor_id, area.floor_id, environment.floor_id)
  LEFT JOIN public.ps_v2_buildings scoped_building
    ON scoped_building.id = COALESCE(requirement.building_id, scoped_floor.building_id)
  LEFT JOIN public.ps_v2_locations scoped_location
    ON scoped_location.id = COALESCE(requirement.location_id, scoped_building.location_id)
  WHERE item.run_id = v_run.id
    AND item.status = 'accepted'
    AND item.collaborator_id IS NOT NULL
  ON CONFLICT (event_id, collaborator_id) WHERE collaborator_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  v_existing_count := GREATEST(v_accepted_count - v_inserted_count, 0);
  v_published_at := now();

  UPDATE public.ps_v2_allocation_runs
  SET
    status = 'published',
    published_at = v_published_at,
    summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object(
      'publication', jsonb_build_object(
        'accepted_count', v_accepted_count,
        'inserted_count', v_inserted_count,
        'existing_count', v_existing_count,
        'published_at', v_published_at
      )
    )
  WHERE id = v_run.id;

  -- Mantém o comportamento do módulo atual para coordenadores/subcoordenadores publicados.
  PERFORM 1
  FROM public.ps_admin_sync_imported_evaluators(v_run.event_id, NULL);

  RETURN QUERY
  SELECT v_run.id, v_run.event_id, v_inserted_count, v_existing_count, v_accepted_count, false, v_published_at;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_v2_publish_allocation_run(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_v2_publish_allocation_run(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.ps_v2_publish_allocation_run(uuid, uuid)
IS 'Publica de forma idempotente os itens aceitos de uma revisão V2 na equipe oficial do evento, preservando vínculos já existentes.';
