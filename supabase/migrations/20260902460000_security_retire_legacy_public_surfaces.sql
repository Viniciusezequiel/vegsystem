-- Hardening de permissões do schema public.
-- Não altera os fluxos atuais da aplicação.

-- =========================================================
-- SCHEMA
-- =========================================================

-- Usuários da aplicação nunca precisam criar tabelas,
-- funções ou outros objetos dentro do schema public.
REVOKE CREATE
ON SCHEMA public
FROM PUBLIC, anon, authenticated;


-- Novas funções criadas por migrations não devem ganhar
-- EXECUTE para PUBLIC automaticamente.
--
-- Cada RPC deve declarar explicitamente quem pode executá-la.
ALTER DEFAULT PRIVILEGES
IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;


-- =========================================================
-- ROSTER ANTIGO DO PROCESSO SELETIVO
-- =========================================================

-- RPC substituída por ps_public_search_event_roster(uuid,text).
-- Mantemos somente service_role para compatibilidade administrativa.
REVOKE ALL
ON FUNCTION public.ps_public_event_roster(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ps_public_event_roster(uuid)
TO service_role;


-- =========================================================
-- RETIFICAÇÃO LEGADA
-- =========================================================

-- O fluxo atual usa o sistema autenticado de revisão/retificação.
-- Não existe necessidade de INSERT anônimo direto nesta tabela.
DROP POLICY IF EXISTS
  "ps_retif public insert"
ON public.ps_evaluation_retifications;

DROP POLICY IF EXISTS
  "ps_retif public insert validated"
ON public.ps_evaluation_retifications;

REVOKE ALL
ON TABLE public.ps_evaluation_retifications
FROM anon;

-- authenticated continua submetido à policy interna existente.
