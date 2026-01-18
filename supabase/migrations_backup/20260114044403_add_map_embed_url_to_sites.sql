-- Add map_embed_url column to main_sites table
ALTER TABLE public.main_sites
ADD COLUMN map_embed_url TEXT;

COMMENT ON COLUMN public.main_sites.map_embed_url IS 'Google Maps embed URL สำหรับแสดงแผนที่ใน iframe';
