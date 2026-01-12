-- Add latitude/longitude columns to ref_districts for route optimization
-- Coordinates are district centroids (approximate)

ALTER TABLE ref_districts
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

-- Add index for geographic queries
CREATE INDEX IF NOT EXISTS idx_districts_coordinates ON ref_districts(latitude, longitude) WHERE latitude IS NOT NULL;

-- Populate coordinates for commonly used districts
-- Office location: 13.7309715, 100.7318956 (Pace Design, Samut Prakan)

-- Bangkok Districts
UPDATE ref_districts SET latitude = 13.7466, longitude = 100.5347 WHERE id = 1007; -- ปทุมวัน
UPDATE ref_districts SET latitude = 13.7163, longitude = 100.7058 WHERE id = 1033; -- คลองเตย
UPDATE ref_districts SET latitude = 13.7650, longitude = 100.5744 WHERE id = 1017; -- ห้วยขวาง
UPDATE ref_districts SET latitude = 13.7286, longitude = 100.5214 WHERE id = 1004; -- บางรัก
UPDATE ref_districts SET latitude = 13.7183, longitude = 100.5283 WHERE id = 1028; -- สาทร
UPDATE ref_districts SET latitude = 13.7559, longitude = 100.5590 WHERE id = 1039; -- วัฒนา
UPDATE ref_districts SET latitude = 13.8183, longitude = 100.5544 WHERE id = 1030; -- จตุจักร
UPDATE ref_districts SET latitude = 13.7289, longitude = 100.7780 WHERE id = 1011; -- ลาดกระบัง
UPDATE ref_districts SET latitude = 13.6944, longitude = 100.5450 WHERE id = 1012; -- ยานนาวา
UPDATE ref_districts SET latitude = 13.7779, longitude = 100.5447 WHERE id = 1014; -- พญาไท
UPDATE ref_districts SET latitude = 13.7594, longitude = 100.5386 WHERE id = 1037; -- ราชเทวี
UPDATE ref_districts SET latitude = 13.6661, longitude = 100.6478 WHERE id = 1047; -- บางนา
UPDATE ref_districts SET latitude = 13.6943, longitude = 100.6438 WHERE id = 1032; -- ประเวศ
UPDATE ref_districts SET latitude = 13.7606, longitude = 100.6436 WHERE id = 1006; -- บางกะปิ
UPDATE ref_districts SET latitude = 13.7694, longitude = 100.6058 WHERE id = 1015; -- ดินแดง
UPDATE ref_districts SET latitude = 13.8003, longitude = 100.6036 WHERE id = 1022; -- ลาดพร้าว
UPDATE ref_districts SET latitude = 13.7203, longitude = 100.4972 WHERE id = 1023; -- บางคอแหลม
UPDATE ref_districts SET latitude = 13.8494, longitude = 100.5717 WHERE id = 1027; -- ดอนเมือง
UPDATE ref_districts SET latitude = 13.8100, longitude = 100.5000 WHERE id = 1035; -- บางซื่อ
UPDATE ref_districts SET latitude = 13.6797, longitude = 100.6144 WHERE id = 1044; -- สวนหลวง
UPDATE ref_districts SET latitude = 13.7936, longitude = 100.5872 WHERE id = 1021; -- วังทองหลาง

-- Samut Prakan Districts
UPDATE ref_districts SET latitude = 13.6067, longitude = 100.6025 WHERE id = 1103; -- บางพลี
UPDATE ref_districts SET latitude = 13.5994, longitude = 100.5961 WHERE id = 1101; -- เมืองสมุทรปราการ
UPDATE ref_districts SET latitude = 13.6467, longitude = 100.6614 WHERE id = 1106; -- บางเสาธง
UPDATE ref_districts SET latitude = 13.5311, longitude = 100.5275 WHERE id = 1102; -- พระประแดง
UPDATE ref_districts SET latitude = 13.5206, longitude = 100.4233 WHERE id = 1104; -- พระสมุทรเจดีย์

-- Chonburi Districts
UPDATE ref_districts SET latitude = 13.1247, longitude = 101.1531 WHERE id = 2007; -- ศรีราชา
UPDATE ref_districts SET latitude = 13.3622, longitude = 100.9847 WHERE id = 2001; -- เมืองชลบุรี
UPDATE ref_districts SET latitude = 13.2342, longitude = 101.0644 WHERE id = 2005; -- พานทอง
UPDATE ref_districts SET latitude = 12.9236, longitude = 100.8825 WHERE id = 2004; -- บางละมุง
UPDATE ref_districts SET latitude = 13.0453, longitude = 101.2053 WHERE id = 2010; -- บ่อทอง
UPDATE ref_districts SET latitude = 13.2983, longitude = 101.1575 WHERE id = 2009; -- เกาะจันทร์

-- Rayong Districts
UPDATE ref_districts SET latitude = 12.8578, longitude = 101.3239 WHERE id = 2106; -- ปลวกแดง
UPDATE ref_districts SET latitude = 12.6814, longitude = 101.2778 WHERE id = 2101; -- เมืองระยอง
UPDATE ref_districts SET latitude = 12.7583, longitude = 101.5653 WHERE id = 2103; -- แกลง
UPDATE ref_districts SET latitude = 12.8342, longitude = 101.1564 WHERE id = 2107; -- นิคมพัฒนา

-- Pathum Thani Districts
UPDATE ref_districts SET latitude = 14.0653, longitude = 100.6147 WHERE id = 1302; -- คลองหลวง
UPDATE ref_districts SET latitude = 14.0167, longitude = 100.5311 WHERE id = 1301; -- เมืองปทุมธานี
UPDATE ref_districts SET latitude = 13.9506, longitude = 100.6206 WHERE id = 1306; -- ลำลูกกา
UPDATE ref_districts SET latitude = 13.9889, longitude = 100.6944 WHERE id = 1304; -- ธัญบุรี
UPDATE ref_districts SET latitude = 14.1222, longitude = 100.6833 WHERE id = 1303; -- หนองเสือ

-- Nonthaburi Districts
UPDATE ref_districts SET latitude = 13.8622, longitude = 100.5144 WHERE id = 1201; -- เมืองนนทบุรี
UPDATE ref_districts SET latitude = 13.9178, longitude = 100.4269 WHERE id = 1202; -- บางกรวย
UPDATE ref_districts SET latitude = 13.8458, longitude = 100.4411 WHERE id = 1203; -- บางใหญ่
UPDATE ref_districts SET latitude = 13.8967, longitude = 100.5472 WHERE id = 1204; -- บางบัวทอง
UPDATE ref_districts SET latitude = 13.8506, longitude = 100.4747 WHERE id = 1205; -- ไทรน้อย
UPDATE ref_districts SET latitude = 13.9003, longitude = 100.5175 WHERE id = 1206; -- ปากเกร็ด

-- Ayutthaya Districts
UPDATE ref_districts SET latitude = 14.1658, longitude = 100.5553 WHERE id = 1414; -- อุทัย
UPDATE ref_districts SET latitude = 14.2350, longitude = 100.5756 WHERE id = 1406; -- บางปะอิน
UPDATE ref_districts SET latitude = 14.3472, longitude = 100.5689 WHERE id = 1401; -- พระนครศรีอยุธยา
UPDATE ref_districts SET latitude = 14.1500, longitude = 100.6708 WHERE id = 1408; -- วังน้อย
UPDATE ref_districts SET latitude = 14.0861, longitude = 100.4878 WHERE id = 1407; -- บางปะหัน

-- Samut Sakhon Districts
UPDATE ref_districts SET latitude = 13.5472, longitude = 100.2742 WHERE id = 7401; -- เมืองสมุทรสาคร
UPDATE ref_districts SET latitude = 13.5556, longitude = 100.1833 WHERE id = 7402; -- กระทุ่มแบน
UPDATE ref_districts SET latitude = 13.4833, longitude = 100.3167 WHERE id = 7403; -- บ้านแพ้ว

-- Chachoengsao Districts
UPDATE ref_districts SET latitude = 13.5436, longitude = 101.0331 WHERE id = 2404; -- บางปะกง
UPDATE ref_districts SET latitude = 13.6894, longitude = 101.0706 WHERE id = 2401; -- เมืองฉะเชิงเทรา

-- Prachinburi Districts
UPDATE ref_districts SET latitude = 13.9922, longitude = 101.4831 WHERE id = 2508; -- ศรีมหาโพธิ
UPDATE ref_districts SET latitude = 14.0506, longitude = 101.3722 WHERE id = 2501; -- เมืองปราจีนบุรี

-- Saraburi Districts
UPDATE ref_districts SET latitude = 14.3317, longitude = 100.9167 WHERE id = 1903; -- หนองแค
UPDATE ref_districts SET latitude = 14.5289, longitude = 100.9103 WHERE id = 1901; -- เมืองสระบุรี

COMMENT ON COLUMN ref_districts.latitude IS 'District centroid latitude (WGS84)';
COMMENT ON COLUMN ref_districts.longitude IS 'District centroid longitude (WGS84)';
