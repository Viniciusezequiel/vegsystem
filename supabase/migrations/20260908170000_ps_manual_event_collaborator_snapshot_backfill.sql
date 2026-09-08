WITH candidate_links AS (
  SELECT e.id AS event_collaborator_id,
         e.collaborator_id,
         c.email,
         c.phone,
         c.mobile,
         c.unit,
         c.sector,
         c.institution,
         c.cpf,
         c.identity_doc,
         c.pix
  FROM public.ps_event_collaborators e
  INNER JOIN public.ps_collaborators c
    ON c.id = e.collaborator_id
  WHERE e.collaborator_id IS NOT NULL
)
UPDATE public.ps_event_collaborators e
SET
  email = COALESCE(e.email, c.email),
  phone = COALESCE(e.phone, c.phone),
  mobile = COALESCE(e.mobile, c.mobile),
  unit = COALESCE(e.unit, c.unit),
  sector = COALESCE(e.sector, c.sector),
  institution = COALESCE(e.institution, c.institution),
  cpf = COALESCE(e.cpf, c.cpf),
  identity_doc = COALESCE(e.identity_doc, c.identity_doc),
  pix = COALESCE(e.pix, c.pix)
FROM public.ps_collaborators c
WHERE e.collaborator_id = c.id
  AND e.collaborator_id IS NOT NULL
  AND (
    e.email IS NULL OR e.phone IS NULL OR e.mobile IS NULL OR e.unit IS NULL OR
    e.sector IS NULL OR e.institution IS NULL OR e.cpf IS NULL OR e.identity_doc IS NULL OR e.pix IS NULL
  );

COMMENT ON TABLE public.ps_event_collaborators IS
  'Snapshot do fiscal no evento. Campos de cadastro-base são hidratados apenas quando nulos para preservar dados locais específicos do evento.';
