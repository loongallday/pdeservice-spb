-- Add cover image URL to employees
-- Similar to profile_image_url, for employee profile cover/banner image

-- Add cover_image_url column to main_employees
ALTER TABLE main_employees
ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Add comment
COMMENT ON COLUMN main_employees.cover_image_url IS 'URL to the employee cover/banner image stored in Supabase Storage (employee-images bucket)';

-- Update v_employees view to include cover_image_url
DROP VIEW IF EXISTS v_employees;
CREATE OR REPLACE VIEW v_employees AS
SELECT
  e.id,
  e.code,
  e.name,
  e.nickname,
  e.email,
  e.is_active,
  e.auth_user_id,
  e.profile_image_url,
  e.cover_image_url,
  e.supervisor_id,
  e.created_at,
  e.updated_at,
  e.role_id,
  r.code AS role_code,
  r.name_th AS role_name_th,
  r.name_en AS role_name_en,
  r.level AS role_level,
  r.department_id,
  d.code AS department_code,
  d.name_th AS department_name_th,
  d.name_en AS department_name_en
FROM main_employees e
LEFT JOIN main_org_roles r ON e.role_id = r.id
LEFT JOIN main_org_departments d ON r.department_id = d.id;

-- Grant access to the view
GRANT SELECT ON v_employees TO authenticated;
GRANT SELECT ON v_employees TO service_role;

-- Create storage bucket for employee images (profile and cover)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-images',
  'employee-images',
  true,  -- Public bucket for easy access
  5242880,  -- 5MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload employee images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-images');

-- Policy: Allow anyone to read/download images (public bucket)
CREATE POLICY "Anyone can read employee images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'employee-images');

-- Policy: Allow authenticated users to update their own images
CREATE POLICY "Authenticated users can update employee images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-images');

-- Policy: Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete employee images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-images');
