/**
 * Workload Analytics Service
 * Provides workload distribution and balance metrics for technicians
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';
import { TechnicianUtilizationService } from './technicianUtilizationService.ts';

export interface WorkloadMetrics {
  date: string;
  distribution: WorkloadDistribution;
  balance_score: number; // 0-100, 100 = perfectly balanced
  technician_workloads: TechnicianWorkload[];
  by_work_type: WorkTypeWorkload[];
  geographic_distribution: GeographicWorkload[];
}

export interface WorkloadDistribution {
  min_tickets: number;
  max_tickets: number;
  avg_tickets: number;
  median_tickets: number;
  std_deviation: number;
  quartiles: {
    q1: number;
    q2: number;
    q3: number;
  };
}

export interface TechnicianWorkload {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  tickets_count: number;
  is_key_employee_count: number;
  work_types: { code: string; count: number }[];
  provinces: { code: string; name: string; count: number }[];
  workload_status: 'underloaded' | 'normal' | 'overloaded';
}

export interface WorkTypeWorkload {
  work_type_id: string;
  work_type_code: string;
  work_type_name: string;
  ticket_count: number;
  avg_technicians_per_ticket: number;
  technician_ids: string[];
}

export interface GeographicWorkload {
  province_code: string;
  province_name: string;
  ticket_count: number;
  technician_count: number;
  avg_tickets_per_technician: number;
}

export interface PeriodWorkloadSummary {
  period: { start: string; end: string; days: number };
  daily_averages: {
    avg_tickets_per_day: number;
    avg_active_technicians: number;
    avg_tickets_per_technician: number;
  };
  workload_balance: {
    avg_balance_score: number;
    best_day: { date: string; score: number };
    worst_day: { date: string; score: number };
  };
  distribution_trend: DailyDistribution[];
}

export interface DailyDistribution {
  date: string;
  active_technicians: number;
  total_tickets: number;
  avg_tickets_per_technician: number;
  balance_score: number;
}

export class WorkloadAnalyticsService {
  /**
   * Get detailed workload metrics for a specific date
   * Uses appointment_date from main_appointments, not assignment date
   */
  static async getWorkloadForDate(date: string): Promise<WorkloadMetrics> {
    const supabase = createServiceClient();

    // Step 1: Get appointments for this date
    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from('main_appointments')
      .select('id')
      .eq('appointment_date', date);

    if (appointmentsError) {
      console.error('[WorkloadAnalyticsService] Error:', appointmentsError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลนัดหมายได้');
    }

    const appointmentIds = (appointmentsData || []).map(a => a.id);

    if (appointmentIds.length === 0) {
      // No appointments for this date
      return {
        date,
        distribution: {
          min_tickets: 0,
          max_tickets: 0,
          avg_tickets: 0,
          median_tickets: 0,
          std_deviation: 0,
          quartiles: { q1: 0, q2: 0, q3: 0 },
        },
        balance_score: 100,
        technician_workloads: [],
        by_work_type: [],
        geographic_distribution: [],
      };
    }

    // Step 2: Get tickets with these appointments
    const { data: ticketsData, error: ticketsError } = await supabase
      .from('main_tickets')
      .select(`
        id,
        work_type_id,
        work_type:ref_ticket_work_types(id, code, name),
        site:main_sites(province_code)
      `)
      .in('appointment_id', appointmentIds);

    if (ticketsError) {
      console.error('[WorkloadAnalyticsService] Error:', ticketsError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลตั๋วได้');
    }

    const ticketIds = (ticketsData || []).map(t => t.id);

    if (ticketIds.length === 0) {
      return {
        date,
        distribution: {
          min_tickets: 0,
          max_tickets: 0,
          avg_tickets: 0,
          median_tickets: 0,
          std_deviation: 0,
          quartiles: { q1: 0, q2: 0, q3: 0 },
        },
        balance_score: 100,
        technician_workloads: [],
        by_work_type: [],
        geographic_distribution: [],
      };
    }

    // Step 3: Get confirmed employees for these tickets
    const { data: confirmedData, error: confirmedError } = await supabase
      .from('jct_ticket_employees_cf')
      .select(`
        employee_id,
        ticket_id,
        is_key_employee,
        employee:main_employees!jct_ticket_employees_cf_employee_id_fkey(id, name, code)
      `)
      .in('ticket_id', ticketIds);

    if (confirmedError) {
      console.error('[WorkloadAnalyticsService] Error:', confirmedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลภาระงานได้');
    }

    // Create ticket lookup map
    const ticketMap = new Map((ticketsData || []).map(t => [t.id, t]));

    // Get province names
    const provinceCodes = [...new Set((ticketsData || [])
      .map(t => (t.site as any)?.province_code)
      .filter(Boolean)
      .map(Number))];

    const provinceNameMap = new Map<number, string>();
    if (provinceCodes.length > 0) {
      const { data: provinces } = await supabase
        .from('ref_provinces')
        .select('id, name_th')
        .in('id', provinceCodes);

      if (provinces) {
        for (const p of provinces) {
          provinceNameMap.set(p.id, p.name_th);
        }
      }
    }

    // Use confirmedData as assignedData for aggregation
    const assignedData = confirmedData;

    // Build workload per technician
    const technicianWorkloads = new Map<string, {
      name: string;
      code: string;
      tickets: Set<string>;
      keyEmployeeCount: number;
      workTypes: Map<string, number>;
      provinces: Map<string, { name: string; count: number }>;
    }>();

    // Build work type aggregation
    const workTypeData = new Map<string, {
      code: string;
      name: string;
      tickets: Set<string>;
      technicians: Set<string>;
    }>();

    // Build geographic aggregation
    const geoData = new Map<string, {
      name: string;
      tickets: Set<string>;
      technicians: Set<string>;
    }>();

    for (const row of assignedData || []) {
      if (!row.employee_id || !row.employee) continue;

      const emp = row.employee as any;
      const ticket = ticketMap.get(row.ticket_id);
      if (!ticket) continue;

      // Initialize technician data
      if (!technicianWorkloads.has(row.employee_id)) {
        technicianWorkloads.set(row.employee_id, {
          name: emp.name,
          code: emp.code,
          tickets: new Set(),
          keyEmployeeCount: 0,
          workTypes: new Map(),
          provinces: new Map(),
        });
      }

      const techData = technicianWorkloads.get(row.employee_id)!;
      techData.tickets.add(row.ticket_id);
      if (row.is_key_employee) {
        techData.keyEmployeeCount++;
      }

      // Aggregate work types
      const workType = ticket.work_type as any;
      if (workType) {
        const wtCode = workType.code;
        techData.workTypes.set(wtCode, (techData.workTypes.get(wtCode) || 0) + 1);

        if (!workTypeData.has(ticket.work_type_id)) {
          workTypeData.set(ticket.work_type_id, {
            code: workType.code,
            name: workType.name,
            tickets: new Set(),
            technicians: new Set(),
          });
        }
        const wt = workTypeData.get(ticket.work_type_id)!;
        wt.tickets.add(row.ticket_id);
        wt.technicians.add(row.employee_id);
      }

      // Aggregate provinces
      const site = ticket.site as any;
      if (site?.province_code) {
        const provCode = String(site.province_code);
        const provName = provinceNameMap.get(Number(site.province_code)) || '';

        if (!techData.provinces.has(provCode)) {
          techData.provinces.set(provCode, { name: provName, count: 0 });
        }
        techData.provinces.get(provCode)!.count++;

        if (!geoData.has(provCode)) {
          geoData.set(provCode, {
            name: provName,
            tickets: new Set(),
            technicians: new Set(),
          });
        }
        const geo = geoData.get(provCode)!;
        geo.tickets.add(row.ticket_id);
        geo.technicians.add(row.employee_id);
      }
    }

    // Calculate distribution metrics
    const ticketCounts = Array.from(technicianWorkloads.values()).map(t => t.tickets.size);

    const distribution = this.calculateDistribution(ticketCounts);
    const balanceScore = this.calculateBalanceScore(ticketCounts);

    // Build technician workloads array
    const technician_workloads: TechnicianWorkload[] = [];
    for (const [empId, data] of technicianWorkloads) {
      const ticketsCount = data.tickets.size;
      const workloadStatus = this.getWorkloadStatus(ticketsCount, distribution.avg_tickets);

      technician_workloads.push({
        employee_id: empId,
        employee_name: data.name,
        employee_code: data.code,
        tickets_count: ticketsCount,
        is_key_employee_count: data.keyEmployeeCount,
        work_types: Array.from(data.workTypes.entries())
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count),
        provinces: Array.from(data.provinces.entries())
          .map(([code, { name, count }]) => ({ code, name, count }))
          .sort((a, b) => b.count - a.count),
        workload_status: workloadStatus,
      });
    }

    // Sort by tickets count descending
    technician_workloads.sort((a, b) => b.tickets_count - a.tickets_count);

    // Build work type workloads
    const by_work_type: WorkTypeWorkload[] = [];
    for (const [wtId, data] of workTypeData) {
      by_work_type.push({
        work_type_id: wtId,
        work_type_code: data.code,
        work_type_name: data.name,
        ticket_count: data.tickets.size,
        avg_technicians_per_ticket: data.tickets.size > 0
          ? Math.round((data.technicians.size / data.tickets.size) * 100) / 100
          : 0,
        technician_ids: Array.from(data.technicians),
      });
    }
    by_work_type.sort((a, b) => b.ticket_count - a.ticket_count);

    // Build geographic distribution
    const geographic_distribution: GeographicWorkload[] = [];
    for (const [provCode, data] of geoData) {
      const techCount = data.technicians.size;
      geographic_distribution.push({
        province_code: provCode,
        province_name: data.name,
        ticket_count: data.tickets.size,
        technician_count: techCount,
        avg_tickets_per_technician: techCount > 0
          ? Math.round((data.tickets.size / techCount) * 100) / 100
          : 0,
      });
    }
    geographic_distribution.sort((a, b) => b.ticket_count - a.ticket_count);

    return {
      date,
      distribution,
      balance_score: balanceScore,
      technician_workloads,
      by_work_type,
      geographic_distribution,
    };
  }

  /**
   * Get workload distribution over a date range
   * Uses appointment_date from main_appointments, not assignment date
   */
  static async getWorkloadDistribution(
    startDate: string,
    endDate: string
  ): Promise<PeriodWorkloadSummary> {
    const supabase = createServiceClient();

    // Use a single RPC query to get all data efficiently
    const { data: rawData, error } = await supabase.rpc('get_workload_distribution_data', {
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      // Fallback to direct query if RPC doesn't exist
      console.error('[WorkloadAnalyticsService] RPC Error:', error.message);

      // Direct SQL query via supabase
      const { data: directData, error: directError } = await supabase
        .from('jct_ticket_employees_cf')
        .select(`
          employee_id,
          ticket_id,
          ticket:main_tickets!inner(
            id,
            appointment:main_appointments!inner(appointment_date)
          )
        `)
        .gte('ticket.appointment.appointment_date', startDate)
        .lte('ticket.appointment.appointment_date', endDate);

      if (directError) {
        console.error('[WorkloadAnalyticsService] Direct query error:', directError.message);
        // If both fail, return empty result
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return {
          period: { start: startDate, end: endDate, days: daysInPeriod },
          daily_averages: {
            avg_tickets_per_day: 0,
            avg_active_technicians: 0,
            avg_tickets_per_technician: 0,
          },
          workload_balance: {
            avg_balance_score: 0,
            best_day: { date: 'N/A', score: 0 },
            worst_day: { date: 'N/A', score: 0 },
          },
          distribution_trend: [],
        };
      }

      // Process directData
      const dailyData = new Map<string, { technicians: Set<string>; tickets: Set<string>; techTicketCounts: Map<string, number> }>();

      for (const row of directData || []) {
        const ticket = row.ticket as any;
        const appointmentDate = ticket?.appointment?.appointment_date;
        if (!appointmentDate) continue;

        if (!dailyData.has(appointmentDate)) {
          dailyData.set(appointmentDate, { technicians: new Set(), tickets: new Set(), techTicketCounts: new Map() });
        }
        const day = dailyData.get(appointmentDate)!;
        day.technicians.add(row.employee_id);
        day.tickets.add(row.ticket_id);
        day.techTicketCounts.set(row.employee_id, (day.techTicketCounts.get(row.employee_id) || 0) + 1);
      }

      return this.buildDistributionResult(startDate, endDate, dailyData);
    }

    // Process RPC data
    const dailyData = new Map<string, { technicians: Set<string>; tickets: Set<string>; techTicketCounts: Map<string, number> }>();

    for (const row of rawData || []) {
      const appointmentDate = row.appointment_date;
      if (!appointmentDate) continue;

      if (!dailyData.has(appointmentDate)) {
        dailyData.set(appointmentDate, { technicians: new Set(), tickets: new Set(), techTicketCounts: new Map() });
      }
      const day = dailyData.get(appointmentDate)!;
      day.technicians.add(row.employee_id);
      day.tickets.add(row.ticket_id);
      day.techTicketCounts.set(row.employee_id, (day.techTicketCounts.get(row.employee_id) || 0) + 1);
    }

    return this.buildDistributionResult(startDate, endDate, dailyData);
  }

  /**
   * Build distribution result from daily data
   */
  private static buildDistributionResult(
    startDate: string,
    endDate: string,
    dailyData: Map<string, { technicians: Set<string>; tickets: Set<string>; techTicketCounts: Map<string, number> }>
  ): PeriodWorkloadSummary {

    // Calculate distribution trend
    const distributionTrend: DailyDistribution[] = [];
    let totalTickets = 0;
    let totalActiveTechnicians = 0;
    let bestDay = { date: '', score: 0 };
    let worstDay = { date: '', score: 100 };

    for (const [date, data] of dailyData) {
      const activeTechnicians = data.technicians.size;
      const totalDayTickets = data.tickets.size;
      const avgPerTech = activeTechnicians > 0
        ? Math.round((totalDayTickets / activeTechnicians) * 100) / 100
        : 0;

      const techCounts = Array.from(data.techTicketCounts.values());
      const balanceScore = this.calculateBalanceScore(techCounts);

      distributionTrend.push({
        date,
        active_technicians: activeTechnicians,
        total_tickets: totalDayTickets,
        avg_tickets_per_technician: avgPerTech,
        balance_score: balanceScore,
      });

      totalTickets += totalDayTickets;
      totalActiveTechnicians += activeTechnicians;

      if (balanceScore > bestDay.score) {
        bestDay = { date, score: balanceScore };
      }
      if (balanceScore < worstDay.score && activeTechnicians > 0) {
        worstDay = { date, score: balanceScore };
      }
    }

    // Sort by date
    distributionTrend.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate period days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysWithData = dailyData.size;

    return {
      period: { start: startDate, end: endDate, days: daysInPeriod },
      daily_averages: {
        avg_tickets_per_day: daysWithData > 0
          ? Math.round((totalTickets / daysWithData) * 100) / 100
          : 0,
        avg_active_technicians: daysWithData > 0
          ? Math.round((totalActiveTechnicians / daysWithData) * 100) / 100
          : 0,
        avg_tickets_per_technician: totalActiveTechnicians > 0
          ? Math.round((totalTickets / totalActiveTechnicians) * 100) / 100
          : 0,
      },
      workload_balance: {
        avg_balance_score: distributionTrend.length > 0
          ? Math.round((distributionTrend.reduce((s, d) => s + d.balance_score, 0) / distributionTrend.length) * 100) / 100
          : 0,
        best_day: bestDay.date ? bestDay : { date: 'N/A', score: 0 },
        worst_day: worstDay.date ? worstDay : { date: 'N/A', score: 0 },
      },
      distribution_trend: distributionTrend,
    };
  }

  /**
   * Calculate distribution statistics
   */
  private static calculateDistribution(values: number[]): WorkloadDistribution {
    if (values.length === 0) {
      return {
        min_tickets: 0,
        max_tickets: 0,
        avg_tickets: 0,
        median_tickets: 0,
        std_deviation: 0,
        quartiles: { q1: 0, q2: 0, q3: 0 },
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const min = sorted[0];
    const max = sorted[n - 1];
    const avg = values.reduce((s, v) => s + v, 0) / n;
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

    // Standard deviation
    const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Quartiles
    const q1Index = Math.floor(n * 0.25);
    const q2Index = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);

    return {
      min_tickets: min,
      max_tickets: max,
      avg_tickets: Math.round(avg * 100) / 100,
      median_tickets: Math.round(median * 100) / 100,
      std_deviation: Math.round(stdDev * 100) / 100,
      quartiles: {
        q1: sorted[q1Index] || 0,
        q2: sorted[q2Index] || 0,
        q3: sorted[q3Index] || 0,
      },
    };
  }

  /**
   * Calculate balance score (0-100, 100 = perfectly balanced)
   */
  private static calculateBalanceScore(values: number[]): number {
    if (values.length <= 1) return 100;

    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    if (avg === 0) return 100;

    // Calculate coefficient of variation (CV)
    const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg;

    // Convert CV to a 0-100 score (lower CV = higher score)
    // CV of 0 = 100 score, CV of 1 = 0 score
    const score = Math.max(0, Math.min(100, (1 - cv) * 100));
    return Math.round(score * 100) / 100;
  }

  /**
   * Determine workload status based on ticket count and average
   */
  private static getWorkloadStatus(
    ticketCount: number,
    avgTickets: number
  ): 'underloaded' | 'normal' | 'overloaded' {
    if (avgTickets === 0) return 'normal';

    const ratio = ticketCount / avgTickets;
    if (ratio < 0.5) return 'underloaded';
    if (ratio > 1.5) return 'overloaded';
    return 'normal';
  }
}
