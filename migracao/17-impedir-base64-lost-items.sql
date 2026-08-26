-- Impede que imagens inline (data:/Base64) voltem a ser gravadas nas tabelas
-- de Achados e Perdidos. Este script não apaga nem modifica registros.
--
-- Execute somente depois de revisar o diagnóstico exibido pelo primeiro SELECT.

BEGIN;

-- Diagnóstico obrigatório: ambos os resultados devem ser zero.
SELECT 'lost_items' AS tabela, count(*) AS image_url_data
FROM public.lost_items
WHERE image_url ~* '^\s*data:'
UNION ALL
SELECT 'lost_items_archive', count(*)
FROM public.lost_items_archive
WHERE image_url ~* '^\s*data:';

DO $validation$
DECLARE
  active_count bigint;
  archive_count bigint;
BEGIN
  SELECT count(*) INTO active_count
  FROM public.lost_items
  WHERE image_url ~* '^\s*data:';

  SELECT count(*) INTO archive_count
  FROM public.lost_items_archive
  WHERE image_url ~* '^\s*data:';

  IF active_count <> 0 OR archive_count <> 0 THEN
    RAISE EXCEPTION
      'Constraints não aplicadas: lost_items possui % e lost_items_archive possui % image_url data:',
      active_count, archive_count;
  END IF;
END
$validation$;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lost_items'::regclass
      AND conname = 'lost_items_image_url_not_data'
  ) THEN
    ALTER TABLE public.lost_items
      ADD CONSTRAINT lost_items_image_url_not_data
      CHECK (image_url IS NULL OR image_url !~* '^\s*data:') NOT VALID;
  END IF;
END
$constraint$;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lost_items_archive'::regclass
      AND conname = 'lost_items_archive_image_url_not_data'
  ) THEN
    ALTER TABLE public.lost_items_archive
      ADD CONSTRAINT lost_items_archive_image_url_not_data
      CHECK (image_url IS NULL OR image_url !~* '^\s*data:') NOT VALID;
  END IF;
END
$constraint$;

ALTER TABLE public.lost_items
  VALIDATE CONSTRAINT lost_items_image_url_not_data;

ALTER TABLE public.lost_items_archive
  VALIDATE CONSTRAINT lost_items_archive_image_url_not_data;

COMMIT;
