/**
 * Daily Report Service
 * Main orchestrator for generating daily reports
 */

import { TicketAggregationService, StatusAggregation, WorkTypeAggregation } from './ticketAggregationService.ts';
import { GeographicService, GeographicData } from './geographicService.ts';
import { TechnicianAnalyticsService, TechnicianData } from './technicianAnalyticsService.ts';
import { ChartDataService, ChartData } from './chartDataService.ts';

// Thai day names
const THAI_DAY_NAMES: Record<number, string> = {
  0: 'อาทิตย์',
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
  6: 'เสาร์',
};

// Thai month names
const THAI_MONTH_NAMES: Record<number, string> = {
  0: 'มกราคม',
  1: 'กุมภาพันธ์',
  2: 'มีนาคม',
  3: 'เมษายน',
  4: 'พฤษภาคม',
  5: 'มิถุนายน',
  6: 'กรกฎาคม',
  7: 'สิงหาคม',
  8: 'กันยายน',
  9: 'ตุลาคม',
  10: 'พฤศจิกายน',
  11: 'ธันวาคม',
};

// Appointment type names in Thai
const APPOINTMENT_TYPE_NAMES: Record<string, string> = {
  full_day: 'เต็มวัน',
  time_range: 'ช่วงเวลา',
  half_morning: 'ครึ่งเช้า',
  half_afternoon: 'ครึ่งบ่าย',
  call_to_schedule: 'โทรนัด',
  backlog: 'Backlog',
  scheduled: 'นัดแล้ว',
};

export interface ReportMeta {
  report_date: string;
  report_date_display: string;
  comparison_date: string;
  comparison_date_display: string;
  generated_at: string;
}

export interface StatusWithComparison {
  status_id: string;
  status_code: string;
  status_name: string;
  count: number;
  count_prev: number;
}

export interface WorkTypeWithComparison {
  work_type_id: string;
  work_type_code: string;
  work_type_name: string;
  count: number;
  count_prev: number;
}

export interface SummaryData {
  total_tickets: number;
  total_tickets_prev: number;
  tickets_created_today: number;
  tickets_completed_today: number;
  by_status: StatusWithComparison[];
  by_work_type: WorkTypeWithComparison[];
}

export interface AppointmentTypeData {
  type_code: string;
  type_name: string;
  count: number;
  count_prev: number;
}

export interface TimeDistribution {
  morning: number;   // 06:00 - 12:00
  afternoon: number; // 12:00 - 18:00
  evening: number;   // 18:00+
}

export interface AppointmentData {
  total_approved: number;
  total_approved_prev: number;
  total_pending: number;
  by_type: AppointmentTypeData[];
  time_distribution: TimeDistribution;
}

export interface TechnicianDataWithComparison {
  active_count: number;
  active_count_prev: number;
  top_performers: TechnicianData['top_performers'];
  team_count: number;
}

export interface GeographicDataWithComparison {
  by_region: Array<{
    region_id: number;
    region_name: string;
    count: number;
    count_prev: number;
    provinces: Array<{
      province_code: number;
      province_name: string;
      count: number;
    }>;
  }>;
  top_provinces: Array<{
    province_code: number;
    province_name: string;
    count: number;
    count_prev: number;
  }>;
}

export interface Precaution {
  type: 'warning' | 'info' | 'critical';
  message: string;
  metric?: string;
  value?: number;
}

export interface DailyReportResponse {
  meta: ReportMeta;
  summary: SummaryData;
  geographic: GeographicDataWithComparison;
  technicians: TechnicianDataWithComparison;
  appointments: AppointmentData;
  charts: ChartData;
  precautions: Precaution[];
}

export class DailyReportService {
  /**
   * Generate complete daily report
   */
  static async generateReport(date: string): Promise<DailyReportResponse> {
    // Calculate previous week date
    const dateObj = new Date(date);
    const prevDate = new Date(dateObj);
    prevDate.setDate(prevDate.getDate() - 7);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    // Fetch all data in parallel
    const [
      statusData,
      statusDataPrev,
      workTypeData,
      workTypeDataPrev,
      geographicData,
      geographicDataPrev,
      technicianData,
      technicianDataPrev,
      weekTrend,
      ticketsCreated,
      ticketsCompleted,
      tickets,
      ticketsPrev,
    ] = await Promise.all([
      TicketAggregationService.getStatusAggregation(date),
      TicketAggregationService.getStatusAggregation(prevDateStr),
      TicketAggregationService.getWorkTypeAggregation(date),
      TicketAggregationService.getWorkTypeAggregation(prevDateStr),
      GeographicService.getDistribution(date),
      GeographicService.getDistribution(prevDateStr),
      TechnicianAnalyticsService.getPerformance(date),
      TechnicianAnalyticsService.getPerformance(prevDateStr),
      TicketAggregationService.getWeekTrend(date),
      TicketAggregationService.getTicketsCreatedOnDate(date),
      TicketAggregationService.getTicketsCompletedOnDate(date),
      TicketAggregationService.getTicketsByDate(date),
      TicketAggregationService.getTicketsByDate(prevDateStr),
    ]);

    // Build response
    const meta = this.buildMeta(date, prevDateStr);
    const summary = this.buildSummary(
      statusData,
      statusDataPrev,
      workTypeData,
      workTypeDataPrev,
      tickets.length,
      ticketsPrev.length,
      ticketsCreated,
      ticketsCompleted
    );
    const geographic = this.buildGeographicWithComparison(geographicData, geographicDataPrev);
    const technicians = this.buildTechnicianWithComparison(technicianData, technicianDataPrev);
    const appointments = this.buildAppointmentData(tickets, ticketsPrev);
    const charts = ChartDataService.buildAllCharts(
      statusData,
      statusDataPrev,
      workTypeData,
      workTypeDataPrev,
      geographicData.by_region,
      weekTrend
    );
    const precautions = this.buildPrecautions(
      summary,
      appointments,
      geographic
    );

    return {
      meta,
      summary,
      geographic,
      technicians,
      appointments,
      charts,
      precautions,
    };
  }

  /**
   * Build report metadata
   */
  private static buildMeta(date: string, prevDate: string): ReportMeta {
    return {
      report_date: date,
      report_date_display: this.formatThaiDate(date),
      comparison_date: prevDate,
      comparison_date_display: this.formatThaiDate(prevDate),
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Format date to Thai format
   */
  private static formatThaiDate(dateStr: string): string {
    const date = new Date(dateStr);
    const dayOfWeek = THAI_DAY_NAMES[date.getDay()];
    const day = date.getDate();
    const month = THAI_MONTH_NAMES[date.getMonth()];
    const year = date.getFullYear() + 543; // Buddhist year

    return `วัน${dayOfWeek}ที่ ${day} ${month} ${year}`;
  }

  /**
   * Build summary with comparison
   */
  private static buildSummary(
    statusData: StatusAggregation[],
    statusDataPrev: StatusAggregation[],
    workTypeData: WorkTypeAggregation[],
    workTypeDataPrev: WorkTypeAggregation[],
    totalTickets: number,
    totalTicketsPrev: number,
    ticketsCreated: number,
    ticketsCompleted: number
  ): SummaryData {
    // Build status map for previous
    const statusPrevMap = new Map<string, number>();
    for (const s of statusDataPrev) {
      statusPrevMap.set(s.status_id, s.count);
    }

    // Build work type map for previous
    const workTypePrevMap = new Map<string, number>();
    for (const w of workTypeDataPrev) {
      workTypePrevMap.set(w.work_type_id, w.count);
    }

    return {
      total_tickets: totalTickets,
      total_tickets_prev: totalTicketsPrev,
      tickets_created_today: ticketsCreated,
      tickets_completed_today: ticketsCompleted,
      by_status: statusData.map(s => ({
        status_id: s.status_id,
        status_code: s.status_code,
        status_name: s.status_name,
        count: s.count,
        count_prev: statusPrevMap.get(s.status_id) || 0,
      })),
      by_work_type: workTypeData.map(w => ({
        work_type_id: w.work_type_id,
        work_type_code: w.work_type_code,
        work_type_name: w.work_type_name,
        count: w.count,
        count_prev: workTypePrevMap.get(w.work_type_id) || 0,
      })),
    };
  }

  /**
   * Build geographic data with comparison
   */
  private static buildGeographicWithComparison(
    current: GeographicData,
    previous: GeographicData
  ): GeographicDataWithComparison {
    // Build previous region map
    const regionPrevMap = new Map<number, number>();
    for (const r of previous.by_region) {
      regionPrevMap.set(r.region_id, r.count);
    }

    // Build previous province map
    const provincePrevMap = new Map<number, number>();
    for (const p of previous.top_provinces) {
      provincePrevMap.set(p.province_code, p.count);
    }

    return {
      by_region: current.by_region.map(r => ({
        region_id: r.region_id,
        region_name: r.region_name,
        count: r.count,
        count_prev: regionPrevMap.get(r.region_id) || 0,
        provinces: r.provinces,
      })),
      top_provinces: current.top_provinces.map(p => ({
        province_code: p.province_code,
        province_name: p.province_name,
        count: p.count,
        count_prev: provincePrevMap.get(p.province_code) || 0,
      })),
    };
  }

  /**
   * Build technician data with comparison
   */
  private static buildTechnicianWithComparison(
    current: TechnicianData,
    previous: TechnicianData
  ): TechnicianDataWithComparison {
    return {
      active_count: current.active_count,
      active_count_prev: previous.active_count,
      top_performers: current.top_performers,
      team_count: current.team_count,
    };
  }

  /**
   * Build appointment data
   */
  private static buildAppointmentData(
    tickets: Array<{ is_approved: boolean; appointment_type: string | null; appointment_time_start: string | null }>,
    ticketsPrev: Array<{ is_approved: boolean; appointment_type: string | null }>
  ): AppointmentData {
    // Count approved/pending
    const approved = tickets.filter(t => t.is_approved).length;
    const approvedPrev = ticketsPrev.filter(t => t.is_approved).length;
    const pending = tickets.filter(t => !t.is_approved).length;

    // Count by appointment type
    const typeCountMap = new Map<string, number>();
    const typeCountPrevMap = new Map<string, number>();

    for (const t of tickets) {
      if (t.appointment_type) {
        typeCountMap.set(t.appointment_type, (typeCountMap.get(t.appointment_type) || 0) + 1);
      }
    }

    for (const t of ticketsPrev) {
      if (t.appointment_type) {
        typeCountPrevMap.set(t.appointment_type, (typeCountPrevMap.get(t.appointment_type) || 0) + 1);
      }
    }

    // Build by_type array
    const allTypes = new Set([...typeCountMap.keys(), ...typeCountPrevMap.keys()]);
    const byType: AppointmentTypeData[] = [];
    for (const type of allTypes) {
      byType.push({
        type_code: type,
        type_name: APPOINTMENT_TYPE_NAMES[type] || type,
        count: typeCountMap.get(type) || 0,
        count_prev: typeCountPrevMap.get(type) || 0,
      });
    }

    // Calculate time distribution for time_range appointments
    const timeDistribution: TimeDistribution = {
      morning: 0,
      afternoon: 0,
      evening: 0,
    };

    for (const t of tickets) {
      if (t.appointment_time_start) {
        const hour = parseInt(t.appointment_time_start.split(':')[0], 10);
        if (hour >= 6 && hour < 12) {
          timeDistribution.morning++;
        } else if (hour >= 12 && hour < 18) {
          timeDistribution.afternoon++;
        } else {
          timeDistribution.evening++;
        }
      }
    }

    return {
      total_approved: approved,
      total_approved_prev: approvedPrev,
      total_pending: pending,
      by_type: byType.sort((a, b) => b.count - a.count),
      time_distribution: timeDistribution,
    };
  }

  /**
   * Build precautions/alerts
   */
  private static buildPrecautions(
    summary: SummaryData,
    appointments: AppointmentData,
    geographic: GeographicDataWithComparison
  ): Precaution[] {
    const precautions: Precaution[] = [];

    // No data warning
    if (summary.total_tickets === 0) {
      precautions.push({
        type: 'info',
        message: 'ไม่มีข้อมูลงานสำหรับวันที่เลือก',
      });
      return precautions;
    }

    // High pending approval count
    if (appointments.total_pending > 10) {
      precautions.push({
        type: 'warning',
        message: `มีนัดหมายรออนุมัติ ${appointments.total_pending} รายการ`,
        metric: 'pending_approval',
        value: appointments.total_pending,
      });
    }

    // Week over week change
    if (summary.total_tickets_prev > 0) {
      const changePercent = Math.round(
        ((summary.total_tickets - summary.total_tickets_prev) / summary.total_tickets_prev) * 100
      );
      if (Math.abs(changePercent) > 50) {
        const direction = changePercent > 0 ? 'เพิ่มขึ้น' : 'ลดลง';
        precautions.push({
          type: 'info',
          message: `จำนวนงาน${direction} ${Math.abs(changePercent)}% จากสัปดาห์ก่อน`,
          metric: 'week_change',
          value: changePercent,
        });
      }
    }

    // Geographic concentration
    if (summary.total_tickets > 0) {
      for (const region of geographic.by_region) {
        const percentage = Math.round((region.count / summary.total_tickets) * 100);
        if (percentage > 50) {
          precautions.push({
            type: 'info',
            message: `งานกระจุกตัวใน${region.region_name} ${percentage}%`,
            metric: 'region_concentration',
            value: percentage,
          });
          break; // Only show one concentration warning
        }
      }
    }

    // Low completion rate warning
    if (summary.total_tickets > 10 && summary.tickets_completed_today === 0) {
      precautions.push({
        type: 'warning',
        message: 'ยังไม่มีงานที่เสร็จสิ้นในวันนี้',
        metric: 'no_completion',
        value: 0,
      });
    }

    return precautions;
  }
}
