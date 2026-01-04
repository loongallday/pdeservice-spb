/**
 * Location resolver service - Resolves location codes to display names
 * 
 * Loads location data from JSON files and provides efficient lookup functions.
 * Data is cached in memory for optimal performance.
 */

// Location data types
interface Province {
  id: number;
  name_th: string;
  name_en: string;
  geography_id: number;
}

interface District {
  id: number;
  name_th: string;
  name_en: string;
  province_id: number;
}

interface SubDistrict {
  id: number;
  name_th: string;
  name_en: string;
  district_id: number;
  zip_code: number;
}

// Lookup maps (cached)
let provincesMap: Map<number, Province> | null = null;
let districtsMap: Map<number, District> | null = null;
let subDistrictsMap: Map<number, SubDistrict> | null = null;

// Embedded location data (loaded at runtime)
// These are loaded from the resource files
const PROVINCES_DATA: Province[] = [{"id":1,"name_th":"กรุงเทพมหานคร","name_en":"Bangkok","geography_id":2},{"id":2,"name_th":"สมุทรปราการ","name_en":"Samut Prakan","geography_id":2},{"id":3,"name_th":"นนทบุรี","name_en":"Nonthaburi","geography_id":2},{"id":4,"name_th":"ปทุมธานี","name_en":"Pathum Thani","geography_id":2},{"id":5,"name_th":"พระนครศรีอยุธยา","name_en":"Phra Nakhon Si Ayutthaya","geography_id":2},{"id":6,"name_th":"อ่างทอง","name_en":"Ang Thong","geography_id":2},{"id":7,"name_th":"ลพบุรี","name_en":"Lopburi","geography_id":2},{"id":8,"name_th":"สิงห์บุรี","name_en":"Sing Buri","geography_id":2},{"id":9,"name_th":"ชัยนาท","name_en":"Chai Nat","geography_id":2},{"id":10,"name_th":"สระบุรี","name_en":"Saraburi","geography_id":2},{"id":11,"name_th":"ชลบุรี","name_en":"Chon Buri","geography_id":5},{"id":12,"name_th":"ระยอง","name_en":"Rayong","geography_id":5},{"id":13,"name_th":"จันทบุรี","name_en":"Chanthaburi","geography_id":5},{"id":14,"name_th":"ตราด","name_en":"Trat","geography_id":5},{"id":15,"name_th":"ฉะเชิงเทรา","name_en":"Chachoengsao","geography_id":5},{"id":16,"name_th":"ปราจีนบุรี","name_en":"Prachin Buri","geography_id":5},{"id":17,"name_th":"นครนายก","name_en":"Nakhon Nayok","geography_id":2},{"id":18,"name_th":"สระแก้ว","name_en":"Sa Kaeo","geography_id":5},{"id":19,"name_th":"นครราชสีมา","name_en":"Nakhon Ratchasima","geography_id":3},{"id":20,"name_th":"บุรีรัมย์","name_en":"Buri Ram","geography_id":3},{"id":21,"name_th":"สุรินทร์","name_en":"Surin","geography_id":3},{"id":22,"name_th":"ศรีสะเกษ","name_en":"Si Sa Ket","geography_id":3},{"id":23,"name_th":"อุบลราชธานี","name_en":"Ubon Ratchathani","geography_id":3},{"id":24,"name_th":"ยโสธร","name_en":"Yasothon","geography_id":3},{"id":25,"name_th":"ชัยภูมิ","name_en":"Chaiyaphum","geography_id":3},{"id":26,"name_th":"อำนาจเจริญ","name_en":"Amnat Charoen","geography_id":3},{"id":27,"name_th":"หนองบัวลำภู","name_en":"Nong Bua Lam Phu","geography_id":3},{"id":28,"name_th":"ขอนแก่น","name_en":"Khon Kaen","geography_id":3},{"id":29,"name_th":"อุดรธานี","name_en":"Udon Thani","geography_id":3},{"id":30,"name_th":"เลย","name_en":"Loei","geography_id":3},{"id":31,"name_th":"หนองคาย","name_en":"Nong Khai","geography_id":3},{"id":32,"name_th":"มหาสารคาม","name_en":"Maha Sarakham","geography_id":3},{"id":33,"name_th":"ร้อยเอ็ด","name_en":"Roi Et","geography_id":3},{"id":34,"name_th":"กาฬสินธุ์","name_en":"Kalasin","geography_id":3},{"id":35,"name_th":"สกลนคร","name_en":"Sakon Nakhon","geography_id":3},{"id":36,"name_th":"นครพนม","name_en":"Nakhon Phanom","geography_id":3},{"id":37,"name_th":"มุกดาหาร","name_en":"Mukdahan","geography_id":3},{"id":38,"name_th":"เชียงใหม่","name_en":"Chiang Mai","geography_id":1},{"id":39,"name_th":"ลำพูน","name_en":"Lamphun","geography_id":1},{"id":40,"name_th":"ลำปาง","name_en":"Lampang","geography_id":1},{"id":41,"name_th":"อุตรดิตถ์","name_en":"Uttaradit","geography_id":1},{"id":42,"name_th":"แพร่","name_en":"Phrae","geography_id":1},{"id":43,"name_th":"น่าน","name_en":"Nan","geography_id":1},{"id":44,"name_th":"พะเยา","name_en":"Phayao","geography_id":1},{"id":45,"name_th":"เชียงราย","name_en":"Chiang Rai","geography_id":1},{"id":46,"name_th":"แม่ฮ่องสอน","name_en":"Mae Hong Son","geography_id":1},{"id":47,"name_th":"นครสวรรค์","name_en":"Nakhon Sawan","geography_id":2},{"id":48,"name_th":"อุทัยธานี","name_en":"Uthai Thani","geography_id":2},{"id":49,"name_th":"กำแพงเพชร","name_en":"Kamphaeng Phet","geography_id":2},{"id":50,"name_th":"ตาก","name_en":"Tak","geography_id":4},{"id":51,"name_th":"สุโขทัย","name_en":"Sukhothai","geography_id":2},{"id":52,"name_th":"พิษณุโลก","name_en":"Phitsanulok","geography_id":2},{"id":53,"name_th":"พิจิตร","name_en":"Phichit","geography_id":2},{"id":54,"name_th":"เพชรบูรณ์","name_en":"Phetchabun","geography_id":2},{"id":55,"name_th":"ราชบุรี","name_en":"Ratchaburi","geography_id":4},{"id":56,"name_th":"กาญจนบุรี","name_en":"Kanchanaburi","geography_id":4},{"id":57,"name_th":"สุพรรณบุรี","name_en":"Suphan Buri","geography_id":2},{"id":58,"name_th":"นครปฐม","name_en":"Nakhon Pathom","geography_id":2},{"id":59,"name_th":"สมุทรสาคร","name_en":"Samut Sakhon","geography_id":2},{"id":60,"name_th":"สมุทรสงคราม","name_en":"Samut Songkhram","geography_id":2},{"id":61,"name_th":"เพชรบุรี","name_en":"Phetchaburi","geography_id":4},{"id":62,"name_th":"ประจวบคีรีขันธ์","name_en":"Prachuap Khiri Khan","geography_id":4},{"id":63,"name_th":"นครศรีธรรมราช","name_en":"Nakhon Si Thammarat","geography_id":6},{"id":64,"name_th":"กระบี่","name_en":"Krabi","geography_id":6},{"id":65,"name_th":"พังงา","name_en":"Phangnga","geography_id":6},{"id":66,"name_th":"ภูเก็ต","name_en":"Phuket","geography_id":6},{"id":67,"name_th":"สุราษฎร์ธานี","name_en":"Surat Thani","geography_id":6},{"id":68,"name_th":"ระนอง","name_en":"Ranong","geography_id":6},{"id":69,"name_th":"ชุมพร","name_en":"Chumphon","geography_id":6},{"id":70,"name_th":"สงขลา","name_en":"Songkhla","geography_id":6},{"id":71,"name_th":"สตูล","name_en":"Satun","geography_id":6},{"id":72,"name_th":"ตรัง","name_en":"Trang","geography_id":6},{"id":73,"name_th":"พัทลุง","name_en":"Phatthalung","geography_id":6},{"id":74,"name_th":"ปัตตานี","name_en":"Pattani","geography_id":6},{"id":75,"name_th":"ยะลา","name_en":"Yala","geography_id":6},{"id":76,"name_th":"นราธิวาส","name_en":"Narathiwat","geography_id":6},{"id":77,"name_th":"บึงกาฬ","name_en":"Bueng Kan","geography_id":3}];

// Districts and SubDistricts are loaded dynamically from the database or can be embedded
// For performance, we'll load them from the database when needed

import { createServiceClient } from '../../_shared/supabase.ts';

/**
 * Initialize provinces map (from embedded data)
 */
function initializeProvinces(): void {
  if (provincesMap) return;
  
  provincesMap = new Map();
  for (const province of PROVINCES_DATA) {
    provincesMap.set(province.id, province);
  }
}

/**
 * Load districts from database (cached)
 */
async function loadDistricts(): Promise<Map<number, District>> {
  if (districtsMap) return districtsMap;
  
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ref_districts')
    .select('id, name_th, name_en, province_id');
  
  if (error) {
    console.error('[locationResolver] Error loading districts:', error.message);
    return new Map();
  }
  
  districtsMap = new Map();
  for (const district of (data || [])) {
    districtsMap.set(district.id, district as District);
  }
  
  return districtsMap;
}

/**
 * Load sub-districts from database (cached)
 */
async function loadSubDistricts(): Promise<Map<number, SubDistrict>> {
  if (subDistrictsMap) return subDistrictsMap;
  
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ref_sub_districts')
    .select('id, name_th, name_en, district_id, zip_code');
  
  if (error) {
    console.error('[locationResolver] Error loading sub-districts:', error.message);
    return new Map();
  }
  
  subDistrictsMap = new Map();
  for (const subDistrict of (data || [])) {
    subDistrictsMap.set(subDistrict.id, subDistrict as SubDistrict);
  }
  
  return subDistrictsMap;
}

/**
 * Get province name by code
 */
export function getProvinceName(code: number | null): string | null {
  if (code === null) return null;
  initializeProvinces();
  const province = provincesMap?.get(code);
  return province?.name_th || null;
}

/**
 * Get province by code
 */
export function getProvince(code: number | null): Province | null {
  if (code === null) return null;
  initializeProvinces();
  return provincesMap?.get(code) || null;
}

/**
 * Get district name by code
 */
export async function getDistrictName(code: number | null): Promise<string | null> {
  if (code === null) return null;
  const districts = await loadDistricts();
  const district = districts.get(code);
  return district?.name_th || null;
}

/**
 * Get district by code
 */
export async function getDistrict(code: number | null): Promise<District | null> {
  if (code === null) return null;
  const districts = await loadDistricts();
  return districts.get(code) || null;
}

/**
 * Get sub-district name by code
 */
export async function getSubDistrictName(code: number | null): Promise<string | null> {
  if (code === null) return null;
  const subDistricts = await loadSubDistricts();
  const subDistrict = subDistricts.get(code);
  return subDistrict?.name_th || null;
}

/**
 * Get sub-district by code
 */
export async function getSubDistrict(code: number | null): Promise<SubDistrict | null> {
  if (code === null) return null;
  const subDistricts = await loadSubDistricts();
  return subDistricts.get(code) || null;
}

/**
 * Resolved location information
 */
export interface ResolvedLocation {
  province_code: number | null;
  province_name: string | null;
  district_code: number | null;
  district_name: string | null;
  subdistrict_code: number | null;
  subdistrict_name: string | null;
  address_detail: string | null;
  display: string;
}

/**
 * Resolve full location from codes
 */
export async function resolveLocation(
  provinceCode: number | null,
  districtCode: number | null,
  subdistrictCode: number | null,
  addressDetail: string | null
): Promise<ResolvedLocation> {
  // Get all location names
  const provinceName = getProvinceName(provinceCode);
  const districtName = await getDistrictName(districtCode);
  const subdistrictName = await getSubDistrictName(subdistrictCode);
  
  // Build display string (short format for cards)
  const displayParts: string[] = [];
  if (districtName) {
    // Remove "เขต" or "อ." prefix for shorter display
    const shortDistrict = districtName.replace(/^(เขต|อ\.|อำเภอ)/, '');
    displayParts.push(shortDistrict);
  }
  if (provinceName) {
    // Use short province name for Bangkok
    const shortProvince = provinceName === 'กรุงเทพมหานคร' ? 'กทม.' : provinceName;
    displayParts.push(shortProvince);
  }
  
  const display = displayParts.join(', ') || '';
  
  return {
    province_code: provinceCode,
    province_name: provinceName,
    district_code: districtCode,
    district_name: districtName,
    subdistrict_code: subdistrictCode,
    subdistrict_name: subdistrictName,
    address_detail: addressDetail,
    display,
  };
}

/**
 * Batch resolve locations (for performance)
 * Pre-loads districts and sub-districts once, then resolves all locations
 */
export async function batchResolveLocations(
  locations: Array<{
    provinceCode: number | null;
    districtCode: number | null;
    subdistrictCode: number | null;
    addressDetail: string | null;
  }>
): Promise<ResolvedLocation[]> {
  // Pre-load all lookup data
  initializeProvinces();
  await loadDistricts();
  await loadSubDistricts();
  
  // Now resolve all locations synchronously (data is cached)
  return locations.map(loc => {
    const provinceName = provincesMap?.get(loc.provinceCode!)?.name_th || null;
    const districtName = districtsMap?.get(loc.districtCode!)?.name_th || null;
    const subdistrictName = subDistrictsMap?.get(loc.subdistrictCode!)?.name_th || null;
    
    // Build display string
    const displayParts: string[] = [];
    if (districtName) {
      const shortDistrict = districtName.replace(/^(เขต|อ\.|อำเภอ)/, '');
      displayParts.push(shortDistrict);
    }
    if (provinceName) {
      const shortProvince = provinceName === 'กรุงเทพมหานคร' ? 'กทม.' : provinceName;
      displayParts.push(shortProvince);
    }
    
    return {
      province_code: loc.provinceCode,
      province_name: provinceName,
      district_code: loc.districtCode,
      district_name: districtName,
      subdistrict_code: loc.subdistrictCode,
      subdistrict_name: subdistrictName,
      address_detail: loc.addressDetail,
      display: displayParts.join(', ') || '',
    };
  });
}

/**
 * Clear cached data (for testing or memory management)
 */
export function clearCache(): void {
  provincesMap = null;
  districtsMap = null;
  subDistrictsMap = null;
}

