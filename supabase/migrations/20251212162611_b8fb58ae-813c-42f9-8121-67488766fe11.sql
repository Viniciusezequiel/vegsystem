-- Enable realtime for remaining tables (skip those already enabled)
DO $$
BEGIN
  -- Try adding each table, ignore if already exists
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_rooms;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_loans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.external_equipment_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lockers;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locker_loans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_calls;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;