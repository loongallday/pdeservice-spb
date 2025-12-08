/**
 * Get technician availability handler
 * Returns technicians with their availability status for a given date/time
 */

import { success } from '../_shared/response.ts';
import { requireMinLevel } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/error.ts';
import { EmployeeService } from '../services/employeeService.ts';
import type { Employee } from '../_shared/auth.ts';

export async function getTechnicianAvailability(req: Request, employee: Employee) {
  // Check permissions - Level 1 and above can view technician availability
  await requireMinLevel(employee, 1);

  // Parse query parameters
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || undefined;
  const appointmentType = url.searchParams.get('appointment_type') || undefined;
  let timeStart = url.searchParams.get('time_start') || undefined;
  let timeEnd = url.searchParams.get('time_end') || undefined;

  // If no date, duration, or type is sent, all employees must be unavailable
  if (!date && !appointmentType && !timeStart && !timeEnd) {
    // Get all technicians without date/time filtering
    const technicians = await EmployeeService.getTechniciansWithAvailability();
    // Mark all as unavailable
    const allUnavailable = technicians.map(tech => ({ ...tech, availability: false }));
    return success(allUnavailable);
  }

  // Validate required date parameter (if any time-related params are provided)
  if (!date && (appointmentType || timeStart || timeEnd)) {
    throw new ValidationError('กรุณาระบุวันที่ (date) เมื่อระบุ appointment_type, time_start หรือ time_end');
  }

  // At this point, date must be defined (we've validated it above)
  if (!date) {
    throw new ValidationError('กรุณาระบุวันที่ (date)');
  }

  // Validate date format (YYYY-MM-DD) if date is provided
  if (date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD');
    }

    // Validate date is a valid date
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new ValidationError('วันที่ไม่ถูกต้อง');
    }
  }

  // If appointment_type is provided, derive times from it
  if (appointmentType) {
    const validTypes = ['half_morning', 'half_afternoon', 'full_day', 'time_range', 'call_to_schedule'];
    if (!validTypes.includes(appointmentType)) {
      throw new ValidationError('appointment_type ไม่ถูกต้อง ต้องเป็น: ' + validTypes.join(', '));
    }

    // For time_range, times must be provided
    if (appointmentType === 'time_range') {
      if (!timeStart || !timeEnd) {
        throw new ValidationError('กรุณาระบุ time_start และ time_end สำหรับ appointment_type=time_range');
      }
    } else if (appointmentType === 'call_to_schedule') {
      // call_to_schedule doesn't check availability (to be scheduled later)
      // Return all technicians as available
      const technicians = await EmployeeService.getTechniciansWithAvailability(date);
      // Mark all as available
      const allAvailable = technicians.map(tech => ({ ...tech, availability: true }));
      return success(allAvailable);
    } else {
      // Derive times from appointment_type
      if (appointmentType === 'half_morning') {
        timeStart = '08:00:00';
        timeEnd = '12:00:00';
      } else if (appointmentType === 'half_afternoon') {
        timeStart = '13:00:00';
        timeEnd = '17:30:00';
      } else if (appointmentType === 'full_day') {
        timeStart = '08:00:00';
        timeEnd = '17:30:00';
      }
    }
  } else {
    // If no appointment_type, times must be provided
    if (timeStart || timeEnd) {
      // Both must be provided together
      if (!timeStart || !timeEnd) {
        throw new ValidationError('กรุณาระบุทั้ง time_start และ time_end');
      }
    }
  }

  // Validate time format if provided
  if (timeStart && timeEnd) {
    // Validate time format (HH:MM:SS)
    const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
    if (!timeRegex.test(timeStart)) {
      throw new ValidationError('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง ต้องเป็น HH:MM:SS');
    }
    if (!timeRegex.test(timeEnd)) {
      throw new ValidationError('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง ต้องเป็น HH:MM:SS');
    }

    // Validate time_start < time_end
    const startTime = timeStart.split(':').map(Number);
    const endTime = timeEnd.split(':').map(Number);
    const startSeconds = startTime[0] * 3600 + startTime[1] * 60 + startTime[2];
    const endSeconds = endTime[0] * 3600 + endTime[1] * 60 + endTime[2];
    
    if (startSeconds >= endSeconds) {
      throw new ValidationError('เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด');
    }
  }

  // Get technicians with availability
  const technicians = await EmployeeService.getTechniciansWithAvailability(
    date,
    timeStart,
    timeEnd
  );

  return success(technicians);
}

