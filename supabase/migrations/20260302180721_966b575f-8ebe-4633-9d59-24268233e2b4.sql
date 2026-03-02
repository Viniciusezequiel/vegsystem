-- Change lost items expiration from 90 days to 60 days
CREATE OR REPLACE FUNCTION public.expire_old_lost_items()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.lost_items
    SET status = 'expired', updated_at = now()
    WHERE status = 'available'
      AND received_date < CURRENT_DATE - INTERVAL '60 days';
END;
$$;