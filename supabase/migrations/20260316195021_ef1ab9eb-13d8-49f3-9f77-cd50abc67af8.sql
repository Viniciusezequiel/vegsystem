
-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Allow authenticated users to view task attachments
CREATE POLICY "Anyone can view task attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments');

-- Add attachment_urls column to task_comments for file references
ALTER TABLE public.task_comments ADD COLUMN attachment_urls text[] DEFAULT NULL;
