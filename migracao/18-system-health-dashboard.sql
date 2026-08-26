-- VEG System — Saúde do Sistema
-- Somente leitura: cria uma RPC administrativa agregada, sem alterar dados de negócio.
-- Revisar antes de executar no Supabase definitivo (sshyjnyvihdheofjzsca).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_database jsonb;
  v_counts jsonb;
  v_lost_items jsonb;
  v_storage jsonb;
  v_cron jsonb;
  v_largest_tables jsonb;
  v_users jsonb;
  v_base64_active bigint;
  v_base64_archive bigint;
  v_active_required_crons integer;
  v_failed_required_crons integer;
  v_status text;
  v_issues jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: administrador necessário'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'size_bytes', pg_catalog.pg_database_size(pg_catalog.current_database()),
    'size_pretty', pg_catalog.pg_size_pretty(pg_catalog.pg_database_size(pg_catalog.current_database())),
    'public_tables', (
      SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
    )
  ) INTO v_database;

  SELECT pg_catalog.jsonb_build_object(
    'lost_items', (SELECT pg_catalog.count(*) FROM public.lost_items),
    'lost_items_archive', (SELECT pg_catalog.count(*) FROM public.lost_items_archive),
    'reservations', (SELECT pg_catalog.count(*) FROM public.reservations),
    'equipment', (SELECT pg_catalog.count(*) FROM public.equipment),
    'equipment_loans', (SELECT pg_catalog.count(*) FROM public.equipment_loans),
    'tasks', (SELECT pg_catalog.count(*) FROM public.tasks),
    'classroom_calls', (SELECT pg_catalog.count(*) FROM public.classroom_calls),
    'activity_logs', (SELECT pg_catalog.count(*) FROM public.activity_logs),
    'profiles', (SELECT pg_catalog.count(*) FROM public.profiles)
  ) INTO v_counts;

  SELECT pg_catalog.count(*) FILTER (WHERE image_url LIKE 'data:%')
  INTO v_base64_active
  FROM public.lost_items;

  SELECT pg_catalog.count(*) FILTER (WHERE image_url LIKE 'data:%')
  INTO v_base64_archive
  FROM public.lost_items_archive;

  SELECT pg_catalog.jsonb_build_object(
    'current', (SELECT pg_catalog.count(*) FROM public.lost_items),
    'available', (SELECT pg_catalog.count(*) FROM public.lost_items WHERE status = 'available'),
    'delivered', (SELECT pg_catalog.count(*) FROM public.lost_items WHERE status = 'delivered'),
    'archived', (SELECT pg_catalog.count(*) FROM public.lost_items_archive),
    'base64_active', v_base64_active,
    'base64_archive', v_base64_archive,
    'base64_total', v_base64_active + v_base64_archive
  ) INTO v_lost_items;

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'bucket', bucket_id,
      'objects', object_count,
      'size_bytes', size_bytes,
      'size_pretty', pg_catalog.pg_size_pretty(size_bytes),
      'latest_object_at', latest_object_at
    ) ORDER BY bucket_id
  ), '[]'::jsonb)
  INTO v_storage
  FROM (
    SELECT wanted.bucket_id,
           pg_catalog.count(o.id)::bigint AS object_count,
           COALESCE(pg_catalog.sum(
             CASE
               WHEN o.metadata->>'size' ~ '^[0-9]+$' THEN (o.metadata->>'size')::bigint
               ELSE 0
             END
           ), 0)::bigint AS size_bytes,
           pg_catalog.max(o.created_at) AS latest_object_at
    FROM (VALUES ('lost-items'::text), ('task-attachments'::text)) AS wanted(bucket_id)
    LEFT JOIN storage.objects o ON o.bucket_id = wanted.bucket_id
    GROUP BY wanted.bucket_id
  ) storage_totals;

  WITH required(jobname) AS (
    VALUES
      ('expire-lost-items-daily'::text),
      ('process-recurring-tasks-daily'::text),
      ('process-recurring-tasks-hourly'::text)
  ), cron_health AS (
    SELECT required.jobname,
           job.schedule,
           COALESCE(job.active, false) AS active,
           last_run.start_time AS last_started_at,
           last_run.end_time AS last_finished_at,
           last_run.status AS last_status,
           CASE
             WHEN last_run.status IS NOT NULL AND last_run.status <> 'succeeded'
               THEN 'Falha na última execução; consulte os logs administrativos.'
             ELSE NULL
           END AS recent_error
    FROM required
    LEFT JOIN cron.job job ON job.jobname = required.jobname
    LEFT JOIN LATERAL (
      SELECT details.start_time, details.end_time, details.status
      FROM cron.job_run_details details
      WHERE details.jobid = job.jobid
      ORDER BY details.start_time DESC NULLS LAST
      LIMIT 1
    ) last_run ON true
  )
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(cron_health) ORDER BY jobname), '[]'::jsonb),
         pg_catalog.count(*) FILTER (WHERE active),
         pg_catalog.count(*) FILTER (WHERE last_status IS NOT NULL AND last_status <> 'succeeded')
  INTO v_cron, v_active_required_crons, v_failed_required_crons
  FROM cron_health;

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'table', relation_name,
      'data_bytes', data_bytes,
      'data_pretty', pg_catalog.pg_size_pretty(data_bytes),
      'index_bytes', index_bytes,
      'index_pretty', pg_catalog.pg_size_pretty(index_bytes),
      'total_bytes', total_bytes,
      'total_pretty', pg_catalog.pg_size_pretty(total_bytes)
    ) ORDER BY total_bytes DESC
  ), '[]'::jsonb)
  INTO v_largest_tables
  FROM (
    SELECT c.relname AS relation_name,
           pg_catalog.pg_relation_size(c.oid)::bigint AS data_bytes,
           pg_catalog.pg_indexes_size(c.oid)::bigint AS index_bytes,
           pg_catalog.pg_total_relation_size(c.oid)::bigint AS total_bytes
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY pg_catalog.pg_total_relation_size(c.oid) DESC
    LIMIT 10
  ) largest;

  SELECT pg_catalog.jsonb_build_object(
    'profiles', (SELECT pg_catalog.count(*) FROM public.profiles),
    'active_profiles', (SELECT pg_catalog.count(*) FROM public.profiles WHERE is_active),
    'by_role', COALESCE((
      SELECT pg_catalog.jsonb_object_agg(role_name, role_count ORDER BY role_name)
      FROM (
        SELECT role::text AS role_name, pg_catalog.count(*)::bigint AS role_count
        FROM public.user_roles
        GROUP BY role
      ) role_totals
    ), '{}'::jsonb)
  ) INTO v_users;

  IF v_base64_active + v_base64_archive > 0 THEN
    v_issues := v_issues || pg_catalog.jsonb_build_array('Imagens Base64 detectadas em Achados e Perdidos.');
  END IF;

  IF v_active_required_crons < 3 THEN
    v_issues := v_issues || pg_catalog.jsonb_build_array('Um ou mais crons obrigatórios estão ausentes ou inativos.');
  END IF;

  IF v_failed_required_crons > 0 THEN
    v_issues := v_issues || pg_catalog.jsonb_build_array('Um ou mais crons obrigatórios falharam na última execução.');
  END IF;

  v_status := CASE
    WHEN v_base64_active + v_base64_archive > 0 OR v_active_required_crons < 3 THEN 'critical'
    WHEN v_failed_required_crons > 0 THEN 'warning'
    ELSE 'healthy'
  END;

  RETURN pg_catalog.jsonb_build_object(
    'generated_at', pg_catalog.now(),
    'status', v_status,
    'issues', v_issues,
    'database', v_database,
    'counts', v_counts,
    'lost_items', v_lost_items,
    'storage', v_storage,
    'cron', v_cron,
    'users', v_users,
    'largest_tables', v_largest_tables
  );
END;
$function$;

ALTER FUNCTION public.get_system_health() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_system_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_system_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_system_health() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_system_health() TO authenticated;

COMMENT ON FUNCTION public.get_system_health() IS
  'Retorna somente métricas técnicas agregadas para administradores do VEG System.';

COMMIT;
