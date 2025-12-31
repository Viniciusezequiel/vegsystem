-- Set REPLICA IDENTITY FULL for better change tracking on lost_items
ALTER TABLE public.lost_items REPLICA IDENTITY FULL;