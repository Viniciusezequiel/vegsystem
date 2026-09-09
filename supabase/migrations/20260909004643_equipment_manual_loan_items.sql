BEGIN;
ALTER TABLE public.equipment_loans
  ALTER COLUMN equipment_id DROP NOT NULL,
  ADD COLUMN manual_item_name text NULL,
  ADD CONSTRAINT equipment_loans_item_required CHECK (
    equipment_id IS NOT NULL OR nullif(trim(manual_item_name), '') IS NOT NULL
  );
COMMIT;
