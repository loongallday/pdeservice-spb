/**
 * Chart Data Service
 * Formats data for frontend charts
 */

import type { StatusAggregation, WorkTypeAggregation, DayTrend } from './ticketAggregationService.ts';
import type { RegionAggregation } from './geographicService.ts';

// Status colors
const STATUS_COLORS: Record<string, string> = {
  pending: '#FFA500',      // Orange
  in_progress: '#3B82F6',  // Blue
  completed: '#22C55E',    // Green
  cancelled: '#EF4444',    // Red
  on_hold: '#9CA3AF',      // Gray
  default: '#6B7280',      // Default gray
};

// Work type colors
const WORK_TYPE_COLORS: Record<string, string> = {
  pm: '#8B5CF6',           // Purple
  rma: '#EC4899',          // Pink
  sales: '#14B8A6',        // Teal
  account: '#F59E0B',      // Amber
  ags_battery: '#6366F1',  // Indigo
  survey: '#10B981',       // Emerald
  pickup: '#F97316',       // Orange
  start_up: '#06B6D4',     // Cyan
  default: '#6B7280',      // Default gray
};

// Region colors
const REGION_COLORS: Record<number, string> = {
  1: '#10B981',  // Northern - Green
  2: '#3B82F6',  // Central - Blue
  3: '#F59E0B',  // Northeastern - Amber
  4: '#EC4899',  // Western - Pink
  5: '#8B5CF6',  // Eastern - Purple
  6: '#06B6D4',  // Southern - Cyan
};

// Thai day abbreviations
const THAI_DAY_ABBREV: Record<number, string> = {
  0: 'อา',
  1: 'จ',
  2: 'อ',
  3: 'พ',
  4: 'พฤ',
  5: 'ศ',
  6: 'ส',
};

export interface PieChartItem {
  label: string;
  value: number;
  color: string;
}

export interface BarChartItem {
  label: string;
  current: number;
  previous: number;
}

export interface DonutChartItem {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface TrendChartItem {
  date: string;
  date_display: string;
  count: number;
}

export interface ChartData {
  status_pie: PieChartItem[];
  work_type_bar: BarChartItem[];
  region_donut: DonutChartItem[];
  week_trend: TrendChartItem[];
}

export class ChartDataService {
  /**
   * Build all chart data
   */
  static buildAllCharts(
    statusData: StatusAggregation[],
    statusDataPrev: StatusAggregation[],
    workTypeData: WorkTypeAggregation[],
    workTypeDataPrev: WorkTypeAggregation[],
    regionData: RegionAggregation[],
    weekTrend: DayTrend[]
  ): ChartData {
    return {
      status_pie: this.buildStatusPieChart(statusData),
      work_type_bar: this.buildWorkTypeBarChart(workTypeData, workTypeDataPrev),
      region_donut: this.buildRegionDonutChart(regionData),
      week_trend: this.buildWeekTrendChart(weekTrend),
    };
  }

  /**
   * Build status pie chart data
   */
  static buildStatusPieChart(statusData: StatusAggregation[]): PieChartItem[] {
    return statusData
      .filter(s => s.count > 0)
      .map(s => ({
        label: s.status_name,
        value: s.count,
        color: STATUS_COLORS[s.status_code] || STATUS_COLORS.default,
      }));
  }

  /**
   * Build work type bar chart data (with comparison)
   */
  static buildWorkTypeBarChart(
    current: WorkTypeAggregation[],
    previous: WorkTypeAggregation[]
  ): BarChartItem[] {
    // Create lookup for previous data
    const prevMap = new Map<string, number>();
    for (const p of previous) {
      prevMap.set(p.work_type_id, p.count);
    }

    return current.map(w => ({
      label: w.work_type_name,
      current: w.count,
      previous: prevMap.get(w.work_type_id) || 0,
    }));
  }

  /**
   * Build region donut chart data
   */
  static buildRegionDonutChart(regionData: RegionAggregation[]): DonutChartItem[] {
    const total = regionData.reduce((sum, r) => sum + r.count, 0);

    return regionData
      .filter(r => r.count > 0)
      .map(r => ({
        label: r.region_name,
        value: r.count,
        percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
        color: REGION_COLORS[r.region_id] || '#6B7280',
      }));
  }

  /**
   * Build week trend line chart data
   */
  static buildWeekTrendChart(weekTrend: DayTrend[]): TrendChartItem[] {
    return weekTrend.map(d => {
      const dateObj = new Date(d.date);
      const dayOfWeek = dateObj.getDay();
      return {
        date: d.date,
        date_display: THAI_DAY_ABBREV[dayOfWeek] || '',
        count: d.count,
      };
    });
  }

  /**
   * Get color for status code
   */
  static getStatusColor(code: string): string {
    return STATUS_COLORS[code] || STATUS_COLORS.default;
  }

  /**
   * Get color for work type code
   */
  static getWorkTypeColor(code: string): string {
    return WORK_TYPE_COLORS[code] || WORK_TYPE_COLORS.default;
  }

  /**
   * Get color for region ID
   */
  static getRegionColor(regionId: number): string {
    return REGION_COLORS[regionId] || '#6B7280';
  }
}
