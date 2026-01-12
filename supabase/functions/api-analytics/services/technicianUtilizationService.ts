/**
 * Technician Utilization Service
 * Provides core metrics for technician utilization analytics
 */

import { createServiceClient } from '../../_shared/supabase.ts';
import { DatabaseError } from '../../_shared/error.ts';

// Technician role codes for filtering
const TECHNICIAN_ROLE_CODES = ['technician', 'technician_l1', 'technician_l2'];

export interface TechnicianUtilizationMetrics {
  date: string;
  total_technicians: number;
  active_technicians: number;
  utilization_rate: number; // percentage (0-100)
  total_tickets_assigned: number;
  total_tickets_confirmed: number;
  confirmation_rate: number; // percentage (0-100)
  avg_tickets_per_active_technician: number;
  by_work_type: WorkTypeUtilization[];
  by_appointment_type: AppointmentTypeUtilization[];
}

export interface WorkTypeUtilization {
  work_type_id: string;
  work_type_code: string;
  work_type_name: string;
  ticket_count: number;
  technician_count: number;
}

export interface AppointmentTypeUtilization {
  appointment_type: string;
  ticket_count: number;
  technician_count: number;
}

export interface TechnicianInfo {
  id: string;
  name: string;
  code: string;
  role_code: string;
  role_name_th: string;
}

export interface TechnicianDayStats {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  tickets_assigned: number;
  tickets_confirmed: number;
  is_key_employee_count: number;
  work_types: string[];
}

export class TechnicianUtilizationService {
  /**
   * Get all technicians (employees with technician roles)
   */
  static async getAllTechnicians(): Promise<TechnicianInfo[]> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('v_employees')
      .select('id, name, code, role_code, role_name_th')
      .in('role_code', TECHNICIAN_ROLE_CODES)
      .eq('is_active', true);

    if (error) {
      console.error('[TechnicianUtilizationService] Error fetching technicians:', error.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลช่างเทคนิคได้');
    }

    return data || [];
  }

  /**
   * Get comprehensive utilization metrics for a specific date
   */
  static async getUtilizationForDate(date: string): Promise<TechnicianUtilizationMetrics> {
    const supabase = createServiceClient();

    // Get all technicians count
    const allTechnicians = await this.getAllTechnicians();
    const totalTechnicians = allTechnicians.length;

    // Get assigned technicians for the date
    const { data: assignedData, error: assignedError } = await supabase
      .from('jct_ticket_employees')
      .select(`
        employee_id,
        ticket_id,
        is_key_employee,
        ticket:main_tickets!inner(
          id,
          work_type_id,
          work_type:ref_ticket_work_types(id, code, name_th),
          appointment:main_appointments(appointment_type)
        )
      `)
      .eq('date', date);

    if (assignedError) {
      console.error('[TechnicianUtilizationService] Error fetching assigned:', assignedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลการมอบหมายงานได้');
    }

    // Get confirmed technicians for the date
    const { data: confirmedData, error: confirmedError } = await supabase
      .from('jct_ticket_employees_cf')
      .select('employee_id, ticket_id')
      .eq('date', date);

    if (confirmedError) {
      console.error('[TechnicianUtilizationService] Error fetching confirmed:', confirmedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลการยืนยันได้');
    }

    // Calculate unique active technicians
    const uniqueTechnicianIds = new Set<string>();
    const ticketsByWorkType = new Map<string, { tickets: Set<string>; technicians: Set<string>; workTypeData: any }>();
    const ticketsByAppointmentType = new Map<string, { tickets: Set<string>; technicians: Set<string> }>();

    for (const row of assignedData || []) {
      if (row.employee_id) {
        uniqueTechnicianIds.add(row.employee_id);

        // Aggregate by work type
        const ticket = row.ticket as any;
        if (ticket?.work_type) {
          const workTypeId = ticket.work_type.id;
          if (!ticketsByWorkType.has(workTypeId)) {
            ticketsByWorkType.set(workTypeId, {
              tickets: new Set(),
              technicians: new Set(),
              workTypeData: ticket.work_type,
            });
          }
          const wtData = ticketsByWorkType.get(workTypeId)!;
          wtData.tickets.add(row.ticket_id);
          wtData.technicians.add(row.employee_id);
        }

        // Aggregate by appointment type
        if (ticket?.appointment?.appointment_type) {
          const appointmentType = ticket.appointment.appointment_type;
          if (!ticketsByAppointmentType.has(appointmentType)) {
            ticketsByAppointmentType.set(appointmentType, {
              tickets: new Set(),
              technicians: new Set(),
            });
          }
          const atData = ticketsByAppointmentType.get(appointmentType)!;
          atData.tickets.add(row.ticket_id);
          atData.technicians.add(row.employee_id);
        }
      }
    }

    // Add confirmed-only technicians
    for (const row of confirmedData || []) {
      if (row.employee_id) {
        uniqueTechnicianIds.add(row.employee_id);
      }
    }

    const activeTechnicians = uniqueTechnicianIds.size;
    const totalTicketsAssigned = new Set((assignedData || []).map(r => r.ticket_id)).size;
    const totalTicketsConfirmed = new Set((confirmedData || []).map(r => r.ticket_id)).size;

    // Calculate rates
    const utilizationRate = totalTechnicians > 0
      ? Math.round((activeTechnicians / totalTechnicians) * 100 * 100) / 100
      : 0;

    const confirmationRate = totalTicketsAssigned > 0
      ? Math.round((totalTicketsConfirmed / totalTicketsAssigned) * 100 * 100) / 100
      : 0;

    const avgTicketsPerTechnician = activeTechnicians > 0
      ? Math.round((totalTicketsAssigned / activeTechnicians) * 100) / 100
      : 0;

    // Build work type breakdown
    const byWorkType: WorkTypeUtilization[] = [];
    for (const [workTypeId, data] of ticketsByWorkType) {
      byWorkType.push({
        work_type_id: workTypeId,
        work_type_code: data.workTypeData.code,
        work_type_name: data.workTypeData.name_th,
        ticket_count: data.tickets.size,
        technician_count: data.technicians.size,
      });
    }
    byWorkType.sort((a, b) => b.ticket_count - a.ticket_count);

    // Build appointment type breakdown
    const byAppointmentType: AppointmentTypeUtilization[] = [];
    for (const [appointmentType, data] of ticketsByAppointmentType) {
      byAppointmentType.push({
        appointment_type: appointmentType,
        ticket_count: data.tickets.size,
        technician_count: data.technicians.size,
      });
    }
    byAppointmentType.sort((a, b) => b.ticket_count - a.ticket_count);

    return {
      date,
      total_technicians: totalTechnicians,
      active_technicians: activeTechnicians,
      utilization_rate: utilizationRate,
      total_tickets_assigned: totalTicketsAssigned,
      total_tickets_confirmed: totalTicketsConfirmed,
      confirmation_rate: confirmationRate,
      avg_tickets_per_active_technician: avgTicketsPerTechnician,
      by_work_type: byWorkType,
      by_appointment_type: byAppointmentType,
    };
  }

  /**
   * Get utilization summary over a date range
   */
  static async getUtilizationSummary(
    startDate: string,
    endDate: string
  ): Promise<{
    period: { start: string; end: string; days: number };
    overall: {
      total_technicians: number;
      avg_active_technicians: number;
      avg_utilization_rate: number;
      total_tickets_assigned: number;
      total_tickets_confirmed: number;
      overall_confirmation_rate: number;
    };
    by_technician: TechnicianSummary[];
    top_performers: TechnicianSummary[];
    underutilized: TechnicianSummary[];
  }> {
    const supabase = createServiceClient();
    const allTechnicians = await this.getAllTechnicians();
    const technicianMap = new Map(allTechnicians.map(t => [t.id, t]));

    // Get all assignments in range
    const { data: assignedData, error: assignedError } = await supabase
      .from('jct_ticket_employees')
      .select('employee_id, ticket_id, date, is_key_employee')
      .gte('date', startDate)
      .lte('date', endDate);

    if (assignedError) {
      console.error('[TechnicianUtilizationService] Error:', assignedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    // Get all confirmations in range
    const { data: confirmedData, error: confirmedError } = await supabase
      .from('jct_ticket_employees_cf')
      .select('employee_id, ticket_id, date')
      .gte('date', startDate)
      .lte('date', endDate);

    if (confirmedError) {
      console.error('[TechnicianUtilizationService] Error:', confirmedError.message);
      throw new DatabaseError('ไม่สามารถดึงข้อมูลได้');
    }

    // Aggregate by technician
    const technicianStats = new Map<string, {
      tickets_assigned: Set<string>;
      tickets_confirmed: Set<string>;
      days_active: Set<string>;
      key_employee_count: number;
    }>();

    for (const row of assignedData || []) {
      if (!row.employee_id) continue;

      if (!technicianStats.has(row.employee_id)) {
        technicianStats.set(row.employee_id, {
          tickets_assigned: new Set(),
          tickets_confirmed: new Set(),
          days_active: new Set(),
          key_employee_count: 0,
        });
      }

      const stats = technicianStats.get(row.employee_id)!;
      stats.tickets_assigned.add(`${row.ticket_id}_${row.date}`);
      stats.days_active.add(row.date);
      if (row.is_key_employee) {
        stats.key_employee_count++;
      }
    }

    for (const row of confirmedData || []) {
      if (!row.employee_id) continue;

      if (!technicianStats.has(row.employee_id)) {
        technicianStats.set(row.employee_id, {
          tickets_assigned: new Set(),
          tickets_confirmed: new Set(),
          days_active: new Set(),
          key_employee_count: 0,
        });
      }

      const stats = technicianStats.get(row.employee_id)!;
      stats.tickets_confirmed.add(`${row.ticket_id}_${row.date}`);
      stats.days_active.add(row.date);
    }

    // Calculate days in period
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Build summary per technician
    const byTechnician: TechnicianSummary[] = [];
    let totalAssigned = 0;
    let totalConfirmed = 0;
    let totalActiveDays = 0;

    for (const tech of allTechnicians) {
      const stats = technicianStats.get(tech.id);
      const ticketsAssigned = stats?.tickets_assigned.size || 0;
      const ticketsConfirmed = stats?.tickets_confirmed.size || 0;
      const daysActive = stats?.days_active.size || 0;

      totalAssigned += ticketsAssigned;
      totalConfirmed += ticketsConfirmed;
      totalActiveDays += daysActive;

      const utilizationRate = daysInPeriod > 0
        ? Math.round((daysActive / daysInPeriod) * 100 * 100) / 100
        : 0;

      const avgTicketsPerDay = daysActive > 0
        ? Math.round((ticketsAssigned / daysActive) * 100) / 100
        : 0;

      byTechnician.push({
        employee_id: tech.id,
        employee_name: tech.name,
        employee_code: tech.code,
        role_code: tech.role_code,
        tickets_assigned: ticketsAssigned,
        tickets_confirmed: ticketsConfirmed,
        days_active: daysActive,
        utilization_rate: utilizationRate,
        avg_tickets_per_day: avgTicketsPerDay,
        key_employee_count: stats?.key_employee_count || 0,
      });
    }

    // Sort for top performers (by tickets assigned)
    const sorted = [...byTechnician].sort((a, b) => b.tickets_assigned - a.tickets_assigned);
    const topPerformers = sorted.slice(0, 10);

    // Get underutilized (bottom 10, excluding those with 0 assignments)
    const underutilized = sorted
      .filter(t => t.days_active > 0)
      .slice(-10)
      .reverse();

    // Calculate overall averages
    const avgActiveTechnicians = daysInPeriod > 0
      ? Math.round((totalActiveDays / daysInPeriod) * 100) / 100
      : 0;

    const avgUtilizationRate = allTechnicians.length > 0
      ? Math.round((byTechnician.reduce((sum, t) => sum + t.utilization_rate, 0) / allTechnicians.length) * 100) / 100
      : 0;

    const overallConfirmationRate = totalAssigned > 0
      ? Math.round((totalConfirmed / totalAssigned) * 100 * 100) / 100
      : 0;

    return {
      period: {
        start: startDate,
        end: endDate,
        days: daysInPeriod,
      },
      overall: {
        total_technicians: allTechnicians.length,
        avg_active_technicians: avgActiveTechnicians,
        avg_utilization_rate: avgUtilizationRate,
        total_tickets_assigned: totalAssigned,
        total_tickets_confirmed: totalConfirmed,
        overall_confirmation_rate: overallConfirmationRate,
      },
      by_technician: byTechnician.sort((a, b) => b.tickets_assigned - a.tickets_assigned),
      top_performers: topPerformers,
      underutilized: underutilized,
    };
  }
}

export interface TechnicianSummary {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  role_code: string;
  tickets_assigned: number;
  tickets_confirmed: number;
  days_active: number;
  utilization_rate: number;
  avg_tickets_per_day: number;
  key_employee_count: number;
}
