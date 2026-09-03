-- =====================================================================
-- SECURITY: DEFAULT DENY PARA NOVOS OBJETOS DO SCHEMA PUBLIC
--
-- Objetivo:
-- tabelas, funções e sequences novas NÃO devem herdar acesso automático
-- para anon ou authenticated.
--
-- Isso não modifica objetos existentes.
-- Permissões necessárias devem ser concedidas explicitamente na migration
-- que cria cada objeto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- FUNÇÕES
-- ---------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON FUNCTIONS
FROM PUBLIC;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON FUNCTIONS
FROM anon;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON FUNCTIONS
FROM authenticated;


-- ---------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON TABLES
FROM PUBLIC;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON TABLES
FROM anon;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON TABLES
FROM authenticated;


-- ---------------------------------------------------------------------
-- SEQUENCES
-- ---------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON SEQUENCES
FROM PUBLIC;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON SEQUENCES
FROM anon;

ALTER DEFAULT PRIVILEGES
FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON SEQUENCES
FROM authenticated;


-- ---------------------------------------------------------------------
-- SCHEMA
-- ---------------------------------------------------------------------

REVOKE CREATE
ON SCHEMA public
FROM PUBLIC, anon, authenticated;

-- service_role permanece deliberadamente fora desses REVOKEs.
-- RPCs/tabelas destinadas a anon/authenticated deverão possuir GRANT
-- explícito na migration correspondente.
