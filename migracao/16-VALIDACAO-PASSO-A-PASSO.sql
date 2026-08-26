-- =====================================================================
-- 16 - VALIDAÇÃO PASSO A PASSO (rodar no SQL Editor do DESTINO)
-- Use este arquivo junto com migracao/15-ENCERRAMENTO-MIGRACAO.md
-- Nenhuma consulta aqui altera dados: são todas SELECT.
-- =====================================================================


-- =====================================================================
-- BLOCO A — VALIDAÇÃO APÓS O SCRIPT 14
-- =====================================================================

-- A1. Policy de Uber Corporativo recriada.
--     ESPERADO: 4 linhas; entre elas "Internal staff can create uber requests"
--     com cmd = INSERT e with_check contendo is_internal_user(auth.uid()).
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'uber_requests'
ORDER BY cmd, policyname;


-- A2. anon NÃO pode mais tocar nas 4 tabelas sensíveis.
--     ESPERADO: 0 linhas.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'anon'
  AND table_name IN ('classroom_calls','ps_evaluations',
                     'ps_event_collaborators','uber_requests',
                     '_grants_backup_virada')
ORDER BY 1, 2;


-- A3. Catálogos públicos do /chamado-sala continuam legíveis por anon.
--     ESPERADO: 3 linhas, todas com SELECT.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
  AND table_name IN ('classroom_call_rooms','classroom_call_room_issues',
                     'classroom_call_responses')
ORDER BY 1, 2;


-- A4. EXECUTE para anon: somente as 7 RPCs públicas.
--     ESPERADO exatamente:
--       create_public_classroom_call, create_public_uber_request,
--       get_public_classroom_call_status, get_public_reservations,
--       ps_public_event_roster, ps_public_sign_attendance,
--       ps_public_submit_evaluation
SELECT p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY 1;


-- A5. Rotinas privilegiadas NÃO podem mais ser chamadas por anon/authenticated.
--     ESPERADO: todas as colunas anon/auth com valor false.
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('expire_old_lost_items','get_linked_rooms',
                    'update_updated_at_column','enforce_task_creator_fields')
ORDER BY 1;


-- A6. Helpers de autorização continuam disponíveis para usuários logados.
--     ESPERADO: auth = true em todas as linhas (senão o app quebra).
SELECT p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('has_role','is_admin','is_admin_or_analista',
                    'is_internal_user','has_permission',
                    'check_reservation_conflict','find_available_rooms')
ORDER BY 1;


-- A7. Toda SECURITY DEFINER com owner postgres e search_path fixo.
--     ESPERADO: 0 linhas.
SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND (pg_get_userbyid(p.proowner) <> 'postgres'
       OR coalesce(array_to_string(p.proconfig, ','), '') NOT LIKE '%search_path%');


-- A8. RLS ligada em todas as tabelas de negócio.
--     ESPERADO: 0 linhas (ou apenas _grants_backup_virada, que é interna).
SELECT c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY 1;


-- A9. Comparação final com o snapshot da origem (nenhum GRANT perdido).
--     ESPERADO: 0 linhas.
SELECT b.table_name, b.grantee, b.privilege_type
FROM public._grants_backup_virada b
LEFT JOIN information_schema.role_table_grants g
  ON g.table_schema = 'public' AND g.table_name = b.table_name
 AND g.grantee = b.grantee AND g.privilege_type = b.privilege_type
WHERE g.table_name IS NULL
  AND b.table_name <> '_grants_backup_virada'
  AND NOT (b.grantee = 'anon' AND b.table_name IN
        ('classroom_calls','ps_evaluations','ps_event_collaborators','uber_requests'));


-- =====================================================================
-- BLOCO B — VALIDAÇÃO APÓS O SCRIPT 05b (cron)
-- =====================================================================

-- B1. Os 3 jobs existem e estão ATIVOS no destino.
--     ESPERADO: 3 linhas, active = true.
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('expire-lost-items-daily',
                  'process-recurring-tasks-daily',
                  'process-recurring-tasks-hourly')
ORDER BY jobid;


-- B2. Segredos do Vault presentes (usados pelos jobs).
--     ESPERADO: 2 linhas.
SELECT name FROM vault.decrypted_secrets
WHERE name IN ('cron_service_role_key','recurring_tasks_cron_secret');


-- B3. Primeiras execuções (rodar ~1 h depois da ativação).
--     ESPERADO: status = 'succeeded'.
SELECT jobid, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;


-- B4. Sanidade de dados após o cron rodar:
--     itens vencidos foram marcados e nenhuma demanda recorrente duplicou.
SELECT status, count(*) FROM public.lost_items GROUP BY 1 ORDER BY 1;

SELECT title, due_date, count(*)
FROM public.tasks
WHERE created_at > now() - interval '2 days'
GROUP BY 1, 2
HAVING count(*) > 1;   -- ESPERADO: 0 linhas (sem clones duplicados)

-- Marcação de execução das recorrentes (deve avançar a cada dia processado):
SELECT id, title, recurrence_type, recurrence_days, recurrence_last_run_date
FROM public.tasks
WHERE recurrence_type IS NOT NULL
ORDER BY recurrence_last_run_date DESC NULLS LAST
LIMIT 20;
