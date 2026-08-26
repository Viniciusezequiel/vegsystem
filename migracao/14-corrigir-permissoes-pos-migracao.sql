-- =====================================================================
-- 14 - CORREÇÃO DE PERMISSÕES PÓS-MIGRAÇÃO (destino: sshyjnyvihdheofjzsca)
-- Gerado em 2026-08-26. NÃO EXECUTADO AUTOMATICAMENTE.
--
-- Referência principal: snapshot public._grants_backup_virada (privilégios
-- da ORIGEM antes da janela somente-leitura) + ACLs reais lidas de pg_class /
-- pg_proc na origem + sondagem funcional do destino (REST/PostgREST).
--
-- Diagnóstico resumido:
--   * Os GRANTs de tabela NÃO estão faltando no destino: anon e authenticated
--     possuem SELECT/INSERT/UPDATE/DELETE em todas as 58 tabelas (os erros
--     observados são 42501 "row-level security", nunca "permission denied").
--   * O destino está MAIS PERMISSIVO que a origem em dois pontos:
--       (a) anon recebeu privilégios em tabelas onde a origem já os havia
--           removido (classroom_calls, ps_evaluations, ps_event_collaborators,
--           uber_requests);
--       (b) todas as funções SECURITY DEFINER ficaram com EXECUTE para PUBLIC
--           (default do PostgreSQL), inclusive rotinas privilegiadas.
--   * Portanto este script RESTAURA PARIDADE (majoritariamente REVOKE) e não
--     concede nada além do que existia na origem.
--
-- Idempotente: pode ser executado mais de uma vez.
-- Executar como owner do schema (postgres) no SQL Editor do destino.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. USAGE no schema public (paridade com a origem; normalmente já existe)
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
REVOKE CREATE ON SCHEMA public FROM anon, authenticated;   -- origem: sem CREATE

-- ---------------------------------------------------------------------
-- 2. anon: remover privilégios que a ORIGEM não concedia
--    (tabelas sem nenhuma entrada para anon no ACL da origem)
-- ---------------------------------------------------------------------
REVOKE ALL ON TABLE public.classroom_calls        FROM anon;
REVOKE ALL ON TABLE public.ps_evaluations         FROM anon;
REVOKE ALL ON TABLE public.ps_event_collaborators FROM anon;
REVOKE ALL ON TABLE public.uber_requests          FROM anon;

-- Tabela auxiliar de migração: nunca deve ser exposta pela Data API
REVOKE ALL ON TABLE public._grants_backup_virada FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. anon/authenticated nas demais 51 tabelas: MANTER como está
--    (origem concedia SELECT+INSERT+UPDATE+DELETE; o acesso real é filtrado
--     pelas policies RLS já migradas). Nada a alterar — bloco documental.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 4. Sequences
--    Auditoria: a única sequence do schema public é
--    _grants_backup_virada_id_seq (artefato de migração). Nenhuma tabela de
--    negócio usa nextval() — todas as PKs são uuid com gen_random_uuid().
--    Portanto NÃO há GRANT de sequence a conceder para anon/authenticated.
-- ---------------------------------------------------------------------
REVOKE ALL ON SEQUENCE public._grants_backup_virada_id_seq FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Funções: revogar EXECUTE de PUBLIC e conceder por papel,
--    reproduzindo exatamente o ACL da origem (pg_proc.proacl).
-- ---------------------------------------------------------------------

-- 5.1 Revogar o default do PostgreSQL (EXECUTE para PUBLIC) em TODAS as
--     funções do schema public.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 5.2 Funções internas de trigger / rotinas privilegiadas: service_role apenas
REVOKE ALL ON FUNCTION public.update_updated_at_column()        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_task_creator_fields()     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_old_lost_items()           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_linked_rooms(uuid)            FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.expire_old_lost_items()        TO service_role;
GRANT EXECUTE ON FUNCTION public.get_linked_rooms(uuid)         TO service_role;
-- (funções de trigger não precisam de EXECUTE explícito; rodam como o owner)

-- 5.3 Helpers de autorização usados pelas policies e pelo app: authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)                        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_analista(uuid)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text)      TO authenticated, service_role;

-- 5.4 Reservas: apenas authenticated (ambas as assinaturas sobrecarregadas)
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, public.campus_enum)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, public.campus_enum, boolean)
  TO authenticated, service_role;

-- 5.5 Superfícies públicas (rotas externas) — únicas com EXECUTE para anon
GRANT EXECUTE ON FUNCTION public.create_public_classroom_call(text, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_classroom_call_status(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_public_uber_request(text, text, text, date, time without time zone, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(timestamptz, timestamptz)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ps_public_event_roster(uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(uuid, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb)
  TO anon, authenticated, service_role;

-- 5.6 Owner confiável + search_path fixo em todas as SECURITY DEFINER
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           pg_get_userbyid(p.proowner) AS owner,
           coalesce(array_to_string(p.proconfig, ','), '') AS cfg
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    IF r.owner <> 'postgres' THEN
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', r.sig);
    END IF;
    IF r.cfg NOT LIKE '%search_path%' THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 6. /chamado-sala (rota pública, sem autenticação)
--    Garantias:
--      * criação SOMENTE via RPC SECURITY DEFINER create_public_classroom_call
--        (validação de entrada e truncamento já implementados na função);
--      * consulta de status SOMENTE via get_public_classroom_call_status
--        (retorna 4 campos, restrita a chamados das últimas 6 horas);
--      * anon SEM SELECT/UPDATE/DELETE direto em classroom_calls (item 2);
--      * catálogos públicos de leitura permanecem acessíveis a anon.
-- ---------------------------------------------------------------------
GRANT SELECT ON TABLE public.classroom_call_rooms       TO anon;
GRANT SELECT ON TABLE public.classroom_call_room_issues TO anon;
GRANT SELECT ON TABLE public.classroom_call_responses   TO anon;

-- Verificação (deve retornar 0 linhas):
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_schema='public' AND table_name='classroom_calls' AND grantee='anon';

-- ---------------------------------------------------------------------
-- 7. service_role: privilégios necessários às Edge Functions / cron
--    Sem GRANT ALL indiscriminado — apenas DML nas tabelas efetivamente
--    utilizadas pelas 12 Edge Functions e rotinas agendadas.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.tasks,
  public.task_team_members,
  public.task_history,
  public.task_comments,
  public.profiles,
  public.user_roles,
  public.activity_logs,
  public.lost_items,
  public.lost_items_archive,
  public.classroom_calls,
  public.reservations,
  public.reservation_logs,
  public.external_users,
  public.uber_requests,
  public.ps_events,
  public.ps_event_collaborators,
  public.ps_evaluations,
  public.app_settings
TO service_role;

-- ---------------------------------------------------------------------
-- 8. Storage: NENHUMA alteração.
--    Auditoria funcional confirmou que buckets lost-items e task-attachments
--    permanecem privados e que usuários autenticados conseguem listar/assinar
--    objetos (script 13 aplicado). Não alterar ownership nem conceder
--    privilégios amplos no schema storage.
-- ---------------------------------------------------------------------

COMMIT;

-- =====================================================================
-- VERIFICAÇÕES PÓS-APLICAÇÃO
-- =====================================================================
-- a) Privilégios de anon que restaram (esperado: sem classroom_calls,
--    ps_evaluations, ps_event_collaborators e uber_requests):
--   SELECT table_name, string_agg(privilege_type, ',') FROM information_schema.role_table_grants
--   WHERE table_schema='public' AND grantee='anon' GROUP BY 1 ORDER BY 1;
--
-- b) EXECUTE para anon (esperado: só as 7 RPCs públicas):
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE');
--
-- c) Comparação com o snapshot da origem:
--   SELECT b.table_name, b.grantee, b.privilege_type
--   FROM public._grants_backup_virada b
--   LEFT JOIN information_schema.role_table_grants g
--     ON g.table_schema='public' AND g.table_name=b.table_name
--    AND g.grantee=b.grantee AND g.privilege_type=b.privilege_type
--   WHERE g.table_name IS NULL AND b.table_name <> '_grants_backup_virada';
