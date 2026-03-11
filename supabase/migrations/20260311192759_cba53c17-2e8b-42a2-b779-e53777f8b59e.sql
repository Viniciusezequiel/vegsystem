-- Enforce task creator integrity at database level
CREATE OR REPLACE FUNCTION public.enforce_task_creator_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_email text;
BEGIN
  -- Keep creator immutable after creation
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    RETURN NEW;
  END IF;

  -- On insert, bind creator to authenticated user when available
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();

    SELECT p.full_name, p.email
      INTO v_full_name, v_email
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    ORDER BY p.created_at DESC
    LIMIT 1;

    NEW.created_by_name := COALESCE(v_full_name, v_email, NEW.created_by_name, 'Sistema');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_creator_fields ON public.tasks;
CREATE TRIGGER trg_enforce_task_creator_fields
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_creator_fields();