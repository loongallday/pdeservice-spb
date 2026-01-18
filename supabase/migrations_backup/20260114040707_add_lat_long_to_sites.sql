-- Add latitude and longitude columns to main_sites table
ALTER TABLE public.main_sites
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.main_sites.latitude IS 'ละติจูดของสถานที่ (WGS84)';
COMMENT ON COLUMN public.main_sites.longitude IS 'ลองจิจูดของสถานที่ (WGS84)';
