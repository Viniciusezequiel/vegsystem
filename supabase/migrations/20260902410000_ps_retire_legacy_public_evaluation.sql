-- A avaliação pública antiga foi substituída pelo Portal do Avaliador.
-- Mantemos a função no schema apenas por compatibilidade histórica,
-- mas ela não pode mais ser executada por usuários públicos.

REVOKE ALL
ON FUNCTION public.ps_public_submit_evaluation(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ps_public_submit_evaluation(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
)
TO service_role;
