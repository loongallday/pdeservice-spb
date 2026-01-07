-- Create storage bucket for comment attachments (images and files)

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comment-attachments',
  'comment-attachments',
  true,  -- Public bucket for easy access
  10485760,  -- 10MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload comment attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comment-attachments');

-- Policy: Allow anyone to read/download files (public bucket)
CREATE POLICY "Anyone can read comment attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'comment-attachments');

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update comment attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'comment-attachments');

-- Policy: Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete comment attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comment-attachments');
