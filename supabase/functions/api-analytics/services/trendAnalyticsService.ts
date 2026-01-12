/**
 * Trend Analytics Service
 * Provides time series analysis for technician utilization trends
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';
import { TechnicianUtilizationService } from './technicianUtilizationService.ts';

export interface TrendData {
  period: { start: string; end: string; interval: 'daily' | 'weekly' };
  data_points: TrendDataPoint[];
  summary: TrendSummary;
  comparisons: TrendComparison;
}

export interface TrendDataPoint {
  date: string; // or week start date for weekly
  label: string; // formatted date or week label
  active_technicians: number;
  total_tickets_assigned: number;
  total_tickets_confirmed: number;
  utilization_rate: number;
  confirmation_rate: number;
  avg_tickets_per_technician: number;
}

export interface TrendSummary {
  total_technicians: number;
  avg_active_technicians: number;
  peak_active_technicians: { value: number; date: string };
  lowest_active_technicians: { value: number; date: string };
  avg_utilization_rate: number;
  avg_confirmation_rate: number;
  total_tickets_period: number;
}

export interface TrendComparison {
  utilization_change: number; // percentage change from start to end
  tickets_change: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
}

export interface TechnicianDetailedTrend {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  role_code: string;
  period: { start: string; end: string };
  summary: {
    total_tickets_assigned: number;
    total_tickets_confirmed: number;
    days_active: number;
    avg_tickets_per_day: number;
    most_common_work_type: { code: string; count: number } | null;
    most_common_province: { code: string; name: string; count: number } | null;
  };
  daily_breakdown: DailyTechnicianData[];
  work_type_breakdown: { code: string; name: string; count: number }[];
  geographic_breakdown: { province_code: string; province_name: string; count: number }[];
}

export interface DailyTechnicianData {
  date: string;
  tickets_assigned: number;
  tickets_confirmed: number;
  is_key_employee_count: number;
  work_types: string[];
}

export class TrendAnalyticsService {
  /**
   * Get utilization trends over a date range
   */
  static async getTrends(
    startDate: string,
    endDate: string,
    interval: 'daily' | 'weekly' = 'daily'
  ): Promise<TrendData> {
    const supabase = createServiceClient();
    const allTechnicians = await TechnicianUtilizationService.getAllTechnicians();
    const totalTechnicians = allTechnicians.length;

    // Get all assignments in range
    const { data: assignedData, error: assignedError } = await supabase
      .from('jct_ticket_employees')
      .select('employee_id, ticket_id, date')
      .gte('date', startDate)
      .lte('date', endDate);

    if (assignedError) {
      console.error('[TrendAnalyticsService] Error:', assignedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    // Get all confirmations in range
    const { data: confirmedData, error: confirmedError } = await supabase
      .from('jct_ticket_employees_cf')
      .select('employee_id, ticket_id, date')
      .gte('date', startDate)
      .lte('date', endDate);

    if (confirmedError) {
      console.error('[TrendAnalyticsService] Error:', confirmedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    // Aggregate by date (or week)
    const dataByPeriod = new Map<string, {
      technicians: Set<string>;
      tickets: Set<string>;
      confirmedTickets: Set<string>;
    }>();

    const getPeriodKey = (dateStr: string): string => {
      if (interval === 'weekly') {
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
        const weekStart = new Date(date.setDate(diff));
        return weekStart.toISOString().split('T')[0];
      }
      return dateStr;
    };

    for (const row of assignedData || []) {
      const periodKey = getPeriodKey(row.date);
      if (!dataByPeriod.has(periodKey)) {
        dataByPeriod.set(periodKey, {
          technicians: new Set(),
          tickets: new Set(),
          confirmedTickets: new Set(),
        });
      }
      const period = dataByPeriod.get(periodKey)!;
      period.technicians.add(row.employee_id);
      period.tickets.add(row.ticket_id);
    }

    for (const row of confirmedData || []) {
      const periodKey = getPeriodKey(row.date);
      if (!dataByPeriod.has(periodKey)) {
        dataByPeriod.set(periodKey, {
          technicians: new Set(),
          tickets: new Set(),
          confirmedTickets: new Set(),
        });
      }
      const period = dataByPeriod.get(periodKey)!;
      period.technicians.add(row.employee_id);
      period.confirmedTickets.add(row.ticket_id);
    }

    // Generate all period keys in range
    const allPeriodKeys: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const key = getPeriodKey(current.toISOString().split('T')[0]);
      if (!allPeriodKeys.includes(key)) {
        allPeriodKeys.push(key);
      }
      if (interval === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    // Build data points
    const dataPoints: TrendDataPoint[] = [];
    let totalActive = 0;
    let totalUtilization = 0;
    let totalConfirmation = 0;
    let totalTickets = 0;
    let peakActive = { value: 0, date: '' };
    let lowestActive = { value: Infinity, date: '' };

    for (const periodKey of allPeriodKeys) {
      const data = dataByPeriod.get(periodKey);
      const activeTechnicians = data?.technicians.size || 0;
      const ticketsAssigned = data?.tickets.size || 0;
      const ticketsConfirmed = data?.confirmedTickets.size || 0;

      const utilizationRate = totalTechnicians > 0
        ? Math.round((activeTechnicians / totalTechnicians) * 100 * 100) / 100
        : 0;

      const confirmationRate = ticketsAssigned > 0
        ? Math.round((ticketsConfirmed / ticketsAssigned) * 100 * 100) / 100
        : 0;

      const avgPerTech = activeTechnicians > 0
        ? Math.round((ticketsAssigned / activeTechnicians) * 100) / 100
        : 0;

      // Format label
      let label: string;
      if (interval === 'weekly') {
        const weekEnd = new Date(periodKey);
        weekEnd.setDate(weekEnd.getDate() + 6);
        label = `${this.formatThaiDate(periodKey)} - ${this.formatThaiDate(weekEnd.toISOString().split('T')[0])}`;
      } else {
        label = this.formatThaiDate(periodKey);
      }

      dataPoints.push({
        date: periodKey,
        label,
        active_technicians: activeTechnicians,
        total_tickets_assigned: ticketsAssigned,
        total_tickets_confirmed: ticketsConfirmed,
        utilization_rate: utilizationRate,
        confirmation_rate: confirmationRate,
        avg_tickets_per_technician: avgPerTech,
      });

      // Track for summary
      totalActive += activeTechnicians;
      totalUtilization += utilizationRate;
      totalConfirmation += confirmationRate;
      totalTickets += ticketsAssigned;

      if (activeTechnicians > peakActive.value) {
        peakActive = { value: activeTechnicians, date: periodKey };
      }
      if (activeTechnicians < lowestActive.value && activeTechnicians > 0) {
        lowestActive = { value: activeTechnicians, date: periodKey };
      }
    }

    // Sort by date
    dataPoints.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate trend direction
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

    const avgFirst = firstHalf.length > 0
      ? firstHalf.reduce((s, d) => s + d.utilization_rate, 0) / firstHalf.length
      : 0;
    const avgSecond = secondHalf.length > 0
      ? secondHalf.reduce((s, d) => s + d.utilization_rate, 0) / secondHalf.length
      : 0;

    let trendDirection: 'increasing' | 'decreasing' | 'stable';
    const changePct = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
    if (changePct > 5) {
      trendDirection = 'increasing';
    } else if (changePct < -5) {
      trendDirection = 'decreasing';
    } else {
      trendDirection = 'stable';
    }

    // Calculate period comparisons
    const firstPoint = dataPoints[0];
    const lastPoint = dataPoints[dataPoints.length - 1];

    const utilizationChange = firstPoint && lastPoint && firstPoint.utilization_rate > 0
      ? Math.round(((lastPoint.utilization_rate - firstPoint.utilization_rate) / firstPoint.utilization_rate) * 100 * 100) / 100
      : 0;

    const ticketsChange = firstPoint && lastPoint && firstPoint.total_tickets_assigned > 0
      ? Math.round(((lastPoint.total_tickets_assigned - firstPoint.total_tickets_assigned) / firstPoint.total_tickets_assigned) * 100 * 100) / 100
      : 0;

    return {
      period: { start: startDate, end: endDate, interval },
      data_points: dataPoints,
      summary: {
        total_technicians: totalTechnicians,
        avg_active_technicians: dataPoints.length > 0
          ? Math.round((totalActive / dataPoints.length) * 100) / 100
          : 0,
        peak_active_technicians: peakActive.date ? peakActive : { value: 0, date: 'N/A' },
        lowest_active_technicians: lowestActive.value !== Infinity ? lowestActive : { value: 0, date: 'N/A' },
        avg_utilization_rate: dataPoints.length > 0
          ? Math.round((totalUtilization / dataPoints.length) * 100) / 100
          : 0,
        avg_confirmation_rate: dataPoints.length > 0
          ? Math.round((totalConfirmation / dataPoints.length) * 100) / 100
          : 0,
        total_tickets_period: totalTickets,
      },
      comparisons: {
        utilization_change: utilizationChange,
        tickets_change: ticketsChange,
        trend_direction: trendDirection,
      },
    };
  }

  /**
   * Get detailed trend data for a specific technician
   */
  static async getTechnicianDetail(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<TechnicianDetailedTrend | null> {
    const supabase = createServiceClient();

    // Get technician info
    const { data: techData, error: techError } = await supabase
      .from('v_employees')
      .select('id, name, code, role_code')
      .eq('id', employeeId)
      .single();

    if (techError || !techData) {
      return null;
    }

    // Use RPC to get all ticket data efficiently
    const { data: ticketData, error: ticketError } = await supabase.rpc('get_technician_detail_data', {
      p_employee_id: employeeId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (ticketError) {
      console.error('[TrendAnalyticsService] RPC Error:', ticketError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    if (!ticketData || ticketData.length === 0) {
      // No data in range, return empty result
      return {
        employee_id: techData.id,
        employee_name: techData.name,
        employee_code: techData.code,
        role_code: techData.role_code,
        period: { start: startDate, end: endDate },
        summary: {
          total_tickets_assigned: 0,
          total_tickets_confirmed: 0,
          days_active: 0,
          avg_tickets_per_day: 0,
          most_common_work_type: null,
          most_common_province: null,
        },
        daily_breakdown: [],
        work_type_breakdown: [],
        geographic_breakdown: [],
      };
    }

    // Aggregate data by appointment date
    const dailyMap = new Map<string, {
      assigned: Set<string>;
      confirmed: Set<string>;
      keyEmployeeCount: number;
      workTypes: Set<string>;
    }>();

    const workTypeCount = new Map<string, { name: string; count: number }>();
    const provinceCount = new Map<string, { name: string; count: number }>();

    for (const row of ticketData) {
      const appointmentDate = row.appointment_date;
      if (!appointmentDate) continue;

      if (!dailyMap.has(appointmentDate)) {
        dailyMap.set(appointmentDate, {
          assigned: new Set(),
          confirmed: new Set(),
          keyEmployeeCount: 0,
          workTypes: new Set(),
        });
      }
      const day = dailyMap.get(appointmentDate)!;
      day.assigned.add(row.ticket_id);
      day.confirmed.add(row.ticket_id);

      if (row.work_type_code) {
        day.workTypes.add(row.work_type_code);

        const wtCode = row.work_type_code;
        if (!workTypeCount.has(wtCode)) {
          workTypeCount.set(wtCode, { name: row.work_type_name || '', count: 0 });
        }
        workTypeCount.get(wtCode)!.count++;
      }

      if (row.province_code) {
        const provCode = String(row.province_code);
        if (!provinceCount.has(provCode)) {
          provinceCount.set(provCode, { name: '', count: 0 }); // Will resolve names later
        }
        provinceCount.get(provCode)!.count++;
      }
    }

    // Build daily breakdown
    const dailyBreakdown: DailyTechnicianData[] = [];
    let totalAssigned = 0;
    let totalConfirmed = 0;

    for (const [date, data] of dailyMap) {
      dailyBreakdown.push({
        date,
        tickets_assigned: data.assigned.size,
        tickets_confirmed: data.confirmed.size,
        is_key_employee_count: data.keyEmployeeCount,
        work_types: Array.from(data.workTypes),
      });
      totalAssigned += data.assigned.size;
      totalConfirmed += data.confirmed.size;
    }

    dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));

    // Find most common
    let mostCommonWorkType: { code: string; count: number } | null = null;
    for (const [code, data] of workTypeCount) {
      if (!mostCommonWorkType || data.count > mostCommonWorkType.count) {
        mostCommonWorkType = { code, count: data.count };
      }
    }

    // Resolve province names
    if (provinceCount.size > 0) {
      const provinceCodes = Array.from(provinceCount.keys()).map(Number);
      const { data: provinces } = await supabase
        .from('ref_provinces')
        .select('id, name_th')
        .in('id', provinceCodes);

      if (provinces) {
        for (const prov of provinces) {
          const codeStr = String(prov.id);
          if (provinceCount.has(codeStr)) {
            provinceCount.get(codeStr)!.name = prov.name_th;
          }
        }
      }
    }

    let mostCommonProvince: { code: string; name: string; count: number } | null = null;
    for (const [code, data] of provinceCount) {
      if (!mostCommonProvince || data.count > mostCommonProvince.count) {
        mostCommonProvince = { code, name: data.name, count: data.count };
      }
    }

    // Work type breakdown
    const workTypeBreakdown = Array.from(workTypeCount.entries())
      .map(([code, data]) => ({ code, name: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count);

    // Geographic breakdown
    const geographicBreakdown = Array.from(provinceCount.entries())
      .map(([code, data]) => ({ province_code: code, province_name: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count);

    const daysActive = dailyMap.size;

    return {
      employee_id: techData.id,
      employee_name: techData.name,
      employee_code: techData.code,
      role_code: techData.role_code,
      period: { start: startDate, end: endDate },
      summary: {
        total_tickets_assigned: totalAssigned,
        total_tickets_confirmed: totalConfirmed,
        days_active: daysActive,
        avg_tickets_per_day: daysActive > 0 ? Math.round((totalAssigned / daysActive) * 100) / 100 : 0,
        most_common_work_type: mostCommonWorkType,
        most_common_province: mostCommonProvince,
      },
      daily_breakdown: dailyBreakdown,
      work_type_breakdown: workTypeBreakdown,
      geographic_breakdown: geographicBreakdown,
    };
  }

  /**
   * Format date in Thai style
   */
  private static formatThaiDate(dateStr: string): string {
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = months[date.getMonth()];
    return `${day} ${month}`;
  }
}
