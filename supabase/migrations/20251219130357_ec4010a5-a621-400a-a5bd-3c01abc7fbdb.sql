-- Allow deletion of lost_items based on the app's permission system (instead of admin-only)

DROP POLICY IF EXISTS "Only admins can delete lost items" ON public.lost_items;

CREATE POLICY "Authorized users can delete lost items"
ON public.lost_items
FOR DELETE
USING (
  public.has_permission(auth.uid(), 'lostAndFound', 'delete')
);
