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
  const date = url.searchParams.get('date');
  const timeStart = url.searchParams.get('time_start') || undefined;
  const timeEnd = url.searchParams.get('time_end') || undefined;

  // Validate required date parameter
  if (!date) {
    throw new ValidationError('กรุณาระบุวันที่ (date)');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new ValidationError('รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD');
  }

  // Validate date is a valid date
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new ValidationError('วันที่ไม่ถูกต้อง');
  }

  // Validate time format if provided
  if (timeStart || timeEnd) {
    // Both must be provided together
    if (!timeStart || !timeEnd) {
      throw new ValidationError('กรุณาระบุทั้ง time_start และ time_end');
    }

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

