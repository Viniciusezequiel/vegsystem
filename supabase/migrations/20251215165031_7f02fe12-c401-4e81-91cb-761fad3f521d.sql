-- Make the lost-items bucket private
UPDATE storage.buckets SET public = false WHERE id = 'lost-items';

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can view lost item images" ON storage.objects;

-- Create policy for authenticated users only to view images
CREATE POLICY "Authenticated users can view lost item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'lost-items' AND auth.uid() IS NOT NULL);

-- Keep existing INSERT policy for internal users (already exists)