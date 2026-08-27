-- VEG System — autorização self-scoped para o R2 Storage Worker
-- Não altera dados. Executar manualmente somente após revisão.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_storage_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid;
  v_roles jsonb;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: autenticação necessária'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    pg_catalog.jsonb_agg(role_name ORDER BY role_name),
    '[]'::jsonb
  )
  INTO v_roles
  FROM (
    SELECT DISTINCT ur.role::text AS role_name
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_user_id
  ) AS own_roles;

  RETURN pg_catalog.jsonb_build_object(
    'internal', pg_catalog.jsonb_array_length(v_roles) > 0,
    'roles', v_roles
  );
END;
$function$;

ALTER FUNCTION public.get_my_storage_access() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_my_storage_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_storage_access() TO authenticated;

COMMENT ON FUNCTION public.get_my_storage_access() IS
  'Retorna somente o acesso de Storage do usuário autenticado em auth.uid().';

COMMIT;
