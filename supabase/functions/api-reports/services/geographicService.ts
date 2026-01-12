/**
 * Geographic Service
 * Provides region and province aggregation for reports
 */

import { TicketAggregationService } from './ticketAggregationService.ts';

// Region names mapping (geography_id -> name)
const REGION_NAMES: Record<number, string> = {
  1: 'ภาคเหนือ',
  2: 'ภาคกลาง',
  3: 'ภาคตะวันออกเฉียงเหนือ',
  4: 'ภาคตะวันตก',
  5: 'ภาคตะวันออก',
  6: 'ภาคใต้',
};

// Province data (embedded from locationResolver.ts)
interface Province {
  id: number;
  name_th: string;
  geography_id: number;
}

const PROVINCES_DATA: Province[] = [
  { id: 1, name_th: 'กรุงเทพมหานคร', geography_id: 2 },
  { id: 2, name_th: 'สมุทรปราการ', geography_id: 2 },
  { id: 3, name_th: 'นนทบุรี', geography_id: 2 },
  { id: 4, name_th: 'ปทุมธานี', geography_id: 2 },
  { id: 5, name_th: 'พระนครศรีอยุธยา', geography_id: 2 },
  { id: 6, name_th: 'อ่างทอง', geography_id: 2 },
  { id: 7, name_th: 'ลพบุรี', geography_id: 2 },
  { id: 8, name_th: 'สิงห์บุรี', geography_id: 2 },
  { id: 9, name_th: 'ชัยนาท', geography_id: 2 },
  { id: 10, name_th: 'สระบุรี', geography_id: 2 },
  { id: 11, name_th: 'ชลบุรี', geography_id: 5 },
  { id: 12, name_th: 'ระยอง', geography_id: 5 },
  { id: 13, name_th: 'จันทบุรี', geography_id: 5 },
  { id: 14, name_th: 'ตราด', geography_id: 5 },
  { id: 15, name_th: 'ฉะเชิงเทรา', geography_id: 5 },
  { id: 16, name_th: 'ปราจีนบุรี', geography_id: 5 },
  { id: 17, name_th: 'นครนายก', geography_id: 2 },
  { id: 18, name_th: 'สระแก้ว', geography_id: 5 },
  { id: 19, name_th: 'นครราชสีมา', geography_id: 3 },
  { id: 20, name_th: 'บุรีรัมย์', geography_id: 3 },
  { id: 21, name_th: 'สุรินทร์', geography_id: 3 },
  { id: 22, name_th: 'ศรีสะเกษ', geography_id: 3 },
  { id: 23, name_th: 'อุบลราชธานี', geography_id: 3 },
  { id: 24, name_th: 'ยโสธร', geography_id: 3 },
  { id: 25, name_th: 'ชัยภูมิ', geography_id: 3 },
  { id: 26, name_th: 'อำนาจเจริญ', geography_id: 3 },
  { id: 27, name_th: 'หนองบัวลำภู', geography_id: 3 },
  { id: 28, name_th: 'ขอนแก่น', geography_id: 3 },
  { id: 29, name_th: 'อุดรธานี', geography_id: 3 },
  { id: 30, name_th: 'เลย', geography_id: 3 },
  { id: 31, name_th: 'หนองคาย', geography_id: 3 },
  { id: 32, name_th: 'มหาสารคาม', geography_id: 3 },
  { id: 33, name_th: 'ร้อยเอ็ด', geography_id: 3 },
  { id: 34, name_th: 'กาฬสินธุ์', geography_id: 3 },
  { id: 35, name_th: 'สกลนคร', geography_id: 3 },
  { id: 36, name_th: 'นครพนม', geography_id: 3 },
  { id: 37, name_th: 'มุกดาหาร', geography_id: 3 },
  { id: 38, name_th: 'เชียงใหม่', geography_id: 1 },
  { id: 39, name_th: 'ลำพูน', geography_id: 1 },
  { id: 40, name_th: 'ลำปาง', geography_id: 1 },
  { id: 41, name_th: 'อุตรดิตถ์', geography_id: 1 },
  { id: 42, name_th: 'แพร่', geography_id: 1 },
  { id: 43, name_th: 'น่าน', geography_id: 1 },
  { id: 44, name_th: 'พะเยา', geography_id: 1 },
  { id: 45, name_th: 'เชียงราย', geography_id: 1 },
  { id: 46, name_th: 'แม่ฮ่องสอน', geography_id: 1 },
  { id: 47, name_th: 'นครสวรรค์', geography_id: 2 },
  { id: 48, name_th: 'อุทัยธานี', geography_id: 2 },
  { id: 49, name_th: 'กำแพงเพชร', geography_id: 2 },
  { id: 50, name_th: 'ตาก', geography_id: 4 },
  { id: 51, name_th: 'สุโขทัย', geography_id: 2 },
  { id: 52, name_th: 'พิษณุโลก', geography_id: 2 },
  { id: 53, name_th: 'พิจิตร', geography_id: 2 },
  { id: 54, name_th: 'เพชรบูรณ์', geography_id: 2 },
  { id: 55, name_th: 'ราชบุรี', geography_id: 4 },
  { id: 56, name_th: 'กาญจนบุรี', geography_id: 4 },
  { id: 57, name_th: 'สุพรรณบุรี', geography_id: 2 },
  { id: 58, name_th: 'นครปฐม', geography_id: 2 },
  { id: 59, name_th: 'สมุทรสาคร', geography_id: 2 },
  { id: 60, name_th: 'สมุทรสงคราม', geography_id: 2 },
  { id: 61, name_th: 'เพชรบุรี', geography_id: 4 },
  { id: 62, name_th: 'ประจวบคีรีขันธ์', geography_id: 4 },
  { id: 63, name_th: 'นครศรีธรรมราช', geography_id: 6 },
  { id: 64, name_th: 'กระบี่', geography_id: 6 },
  { id: 65, name_th: 'พังงา', geography_id: 6 },
  { id: 66, name_th: 'ภูเก็ต', geography_id: 6 },
  { id: 67, name_th: 'สุราษฎร์ธานี', geography_id: 6 },
  { id: 68, name_th: 'ระนอง', geography_id: 6 },
  { id: 69, name_th: 'ชุมพร', geography_id: 6 },
  { id: 70, name_th: 'สงขลา', geography_id: 6 },
  { id: 71, name_th: 'สตูล', geography_id: 6 },
  { id: 72, name_th: 'ตรัง', geography_id: 6 },
  { id: 73, name_th: 'พัทลุง', geography_id: 6 },
  { id: 74, name_th: 'ปัตตานี', geography_id: 6 },
  { id: 75, name_th: 'ยะลา', geography_id: 6 },
  { id: 76, name_th: 'นราธิวาส', geography_id: 6 },
  { id: 77, name_th: 'บึงกาฬ', geography_id: 3 },
];

// Create lookup maps
const provinceMap = new Map<number, Province>();
for (const p of PROVINCES_DATA) {
  provinceMap.set(p.id, p);
}

export interface ProvinceAggregation {
  province_code: number;
  province_name: string;
  count: number;
}

export interface RegionAggregation {
  region_id: number;
  region_name: string;
  count: number;
  provinces: ProvinceAggregation[];
}

export interface GeographicData {
  by_region: RegionAggregation[];
  top_provinces: ProvinceAggregation[];
}

export class GeographicService {
  /**
   * Get geographic distribution for tickets on a date
   */
  static async getDistribution(date: string): Promise<GeographicData> {
    // Get tickets for the date
    const tickets = await TicketAggregationService.getTicketsByDate(date);

    // Count by province
    const provinceCountMap = new Map<number, number>();
    for (const ticket of tickets) {
      if (ticket.province_code) {
        provinceCountMap.set(
          ticket.province_code,
          (provinceCountMap.get(ticket.province_code) || 0) + 1
        );
      }
    }

    // Build region aggregation
    const regionMap = new Map<number, RegionAggregation>();

    // Initialize all regions
    for (const [regionId, regionName] of Object.entries(REGION_NAMES)) {
      regionMap.set(Number(regionId), {
        region_id: Number(regionId),
        region_name: regionName,
        count: 0,
        provinces: [],
      });
    }

    // Aggregate provinces into regions
    for (const [provinceCode, count] of provinceCountMap) {
      const province = provinceMap.get(provinceCode);
      if (province) {
        const region = regionMap.get(province.geography_id);
        if (region) {
          region.count += count;
          region.provinces.push({
            province_code: provinceCode,
            province_name: province.name_th,
            count,
          });
        }
      }
    }

    // Sort provinces within each region by count descending
    for (const region of regionMap.values()) {
      region.provinces.sort((a, b) => b.count - a.count);
    }

    // Convert to array and sort by count descending
    const byRegion = Array.from(regionMap.values())
      .sort((a, b) => b.count - a.count);

    // Get top 10 provinces
    const allProvinces: ProvinceAggregation[] = [];
    for (const [provinceCode, count] of provinceCountMap) {
      const province = provinceMap.get(provinceCode);
      if (province) {
        allProvinces.push({
          province_code: provinceCode,
          province_name: province.name_th,
          count,
        });
      }
    }
    const topProvinces = allProvinces
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      by_region: byRegion,
      top_provinces: topProvinces,
    };
  }

  /**
   * Get province count for a specific province on a date
   */
  static async getProvinceCount(date: string, provinceCode: number): Promise<number> {
    const tickets = await TicketAggregationService.getTicketsByDate(date);
    return tickets.filter(t => t.province_code === provinceCode).length;
  }

  /**
   * Get province name by code
   */
  static getProvinceName(provinceCode: number): string | null {
    return provinceMap.get(provinceCode)?.name_th || null;
  }

  /**
   * Get region name by ID
   */
  static getRegionName(regionId: number): string {
    return REGION_NAMES[regionId] || 'ไม่ระบุภาค';
  }
}
