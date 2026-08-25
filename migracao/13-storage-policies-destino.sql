-- Politicas RLS de storage.objects que NAO vieram no dump da migracao.
-- Execute no SQL Editor do projeto sshyjnyvihdheofjzsca.
-- Os buckets continuam PRIVADOS; o acesso e feito por signed URLs.

-- Leitura (necessaria para createSignedUrl)
DROP POLICY IF EXISTS "Internal users can read lost item images" ON storage.objects;
CREATE POLICY "Internal users can read lost item images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lost-items' AND public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal users can read task attachments" ON storage.objects;
CREATE POLICY "Internal users can read task attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments' AND public.is_internal_user(auth.uid()));

-- Upload
DROP POLICY IF EXISTS "Internal users can upload lost item images" ON storage.objects;
CREATE POLICY "Internal users can upload lost item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lost-items' AND public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal users can upload task attachments" ON storage.objects;
CREATE POLICY "Internal users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND public.is_internal_user(auth.uid()));

-- Update / Delete (perfis operacionais)
DROP POLICY IF EXISTS "Internal users can update lost item images" ON storage.objects;
CREATE POLICY "Internal users can update lost item images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'lost-items' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analista')
  OR public.has_role(auth.uid(),'assistente') OR public.has_role(auth.uid(),'supervisor')));

DROP POLICY IF EXISTS "Internal users can delete lost item images" ON storage.objects;
CREATE POLICY "Internal users can delete lost item images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lost-items' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analista')
  OR public.has_role(auth.uid(),'assistente') OR public.has_role(auth.uid(),'supervisor')));

DROP POLICY IF EXISTS "Internal users can delete task attachments" ON storage.objects;
CREATE POLICY "Internal users can delete task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments' AND (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'analista')
  OR public.has_role(auth.uid(),'assistente') OR public.has_role(auth.uid(),'supervisor')));
