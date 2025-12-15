-- Create storage bucket for lost items images
INSERT INTO storage.buckets (id, name, public)
VALUES ('lost-items', 'lost-items', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload lost item images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lost-items');

-- Allow public read access to lost item images
CREATE POLICY "Anyone can view lost item images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lost-items');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update lost item images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lost-items');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete lost item images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lost-items');