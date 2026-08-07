DROP POLICY IF EXISTS "ps_events public read" ON public.ps_events;
DROP POLICY IF EXISTS "ps_roles public read" ON public.ps_roles;
REVOKE SELECT ON public.ps_events FROM anon;
REVOKE SELECT ON public.ps_roles FROM anon;

DROP POLICY IF EXISTS "Authenticated users can upload lost item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;

CREATE POLICY "Internal users can upload lost item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lost-items' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND public.is_internal_user(auth.uid()));