/**
 * Excel Generation Service
 * Creates Excel files for reports using ExcelJS library
 */

import ExcelJS from 'npm:exceljs@4.4.0';

// Appointment type display names in Thai
const APPOINTMENT_TYPE_DISPLAY: Record<string, string> = {
  full_day: 'ทั้งวัน',
  time_range: 'ช่วงเวลา',
  half_morning: 'ครึ่งเช้า',
  half_afternoon: 'ครึ่งบ่าย',
  call_to_schedule: 'โทรนัด',
};

// Work type report titles
const WORK_TYPE_TITLES: Record<string, string> = {
  rma: 'ตารางส่งรายชื่อช่างเข้างาน RMA',
  pm: 'ตารางส่งรายชื่อช่างเข้างาน PM',
  sales: 'ตารางส่งรายชื่อช่างเข้างาน Sales',
};

// Work type file name prefixes
const WORK_TYPE_FILE_PREFIX: Record<string, string> = {
  rma: 'RMA',
  pm: 'PM',
  sales: 'Sales',
};

// Colors for styling
const COLORS = {
  titleBg: 'FF8C00',      // Orange background for title
  headerBg: 'FFFF00',     // Yellow background for headers
  borderColor: '000000',  // Black borders
  white: 'FFFFFF',
};

export interface WorkTypeReportRow {
  order: number;
  date: string;
  description: string;
  companyName: string;
  technicianNames: string;
  vehicleRegistration: string;
  time: string;
  remark: string;
}

// Backward compatibility alias
export type RmaReportRow = WorkTypeReportRow;

/**
 * Get the report title for a work type
 */
export function getWorkTypeTitle(workTypeCode: string): string {
  return WORK_TYPE_TITLES[workTypeCode] || `ตารางส่งรายชื่อช่างเข้างาน ${workTypeCode.toUpperCase()}`;
}

/**
 * Get the file name prefix for a work type
 */
export function getWorkTypeFilePrefix(workTypeCode: string): string {
  return WORK_TYPE_FILE_PREFIX[workTypeCode] || workTypeCode.toUpperCase();
}

/**
 * Format date to Thai display format (dd/m/yyyy)
 */
function formatDateThai(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get appointment time display
 */
function getTimeDisplay(
  appointmentType: string | null,
  timeStart: string | null,
  timeEnd: string | null
): string {
  if (!appointmentType) return '';

  if (appointmentType === 'time_range' && timeStart && timeEnd) {
    // Format time range: HH:mm - HH:mm
    const start = timeStart.substring(0, 5);
    const end = timeEnd.substring(0, 5);
    return `${start} - ${end}`;
  }

  return APPOINTMENT_TYPE_DISPLAY[appointmentType] || appointmentType;
}

/**
 * Format technician names with K' prefix
 */
function formatTechnicianNames(employees: Array<{ name: string; nickname?: string }>): string {
  if (!employees || employees.length === 0) return '';

  return employees
    .map(emp => {
      // Use real name
      return `K'${emp.name}`;
    })
    .join(' + ');
}

/**
 * Get border style for cells
 */
function getBorderStyle(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: COLORS.borderColor } },
    left: { style: 'thin', color: { argb: COLORS.borderColor } },
    bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    right: { style: 'thin', color: { argb: COLORS.borderColor } },
  };
}

/**
 * Generate Excel report for any work type
 */
export async function generateWorkTypeExcel(
  data: WorkTypeReportRow[],
  workTypeCode: string
): Promise<Uint8Array> {
  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PDE Service';
  workbook.created = new Date();

  // Get title and sheet name based on work type
  const title = getWorkTypeTitle(workTypeCode);
  const sheetName = `${getWorkTypeFilePrefix(workTypeCode)} Report`;

  // Add worksheet
  const worksheet = workbook.addWorksheet(sheetName);

  // Define columns
  worksheet.columns = [
    { key: 'order', width: 8 },
    { key: 'date', width: 14 },
    { key: 'description', width: 35 },
    { key: 'companyName', width: 45 },
    { key: 'technicianNames', width: 35 },
    { key: 'vehicleRegistration', width: 14 },
    { key: 'time', width: 14 },
    { key: 'remark', width: 18 },
  ];

  // Row 1: Title row (merged)
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: COLORS.white } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.titleBg },
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = getBorderStyle();
  worksheet.getRow(1).height = 25;

  // Row 2: Header row
  const headerLabels = ['ลำดับ', 'วันที่', 'ประเภทงาน', 'ชื่อบริษัท', 'ชื่อเจ้าหน้าที่', 'ทะเบียนรถ', 'เวลา', 'Remark'];
  const headerRow = worksheet.getRow(2);
  headerLabels.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.headerBg },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = getBorderStyle();
  });
  headerRow.height = 22;

  // Data rows
  data.forEach((row, index) => {
    const dataRow = worksheet.getRow(index + 3);

    const values = [
      row.order,
      row.date,
      row.description,
      row.companyName,
      row.technicianNames,
      row.vehicleRegistration,
      row.time,
      row.remark,
    ];

    values.forEach((value, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      cell.value = value;
      cell.border = getBorderStyle();
      cell.alignment = {
        vertical: 'middle',
        wrapText: colIndex === 2 || colIndex === 3 || colIndex === 4, // Wrap text for description, company, technicians
        horizontal: colIndex === 0 ? 'center' : 'left', // Center the order number
      };
    });

    dataRow.height = 20;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/**
 * Generate RMA Excel report (backward compatible)
 */
export async function generateRmaExcel(data: RmaReportRow[], _reportDate: string): Promise<Uint8Array> {
  return generateWorkTypeExcel(data, 'rma');
}

// Ticket data type for transformation
export type TicketDataForReport = {
  details: string | null;
  site?: {
    name?: string;
    company?: { name_th?: string; name_en?: string } | null;
  } | null;
  appointment?: {
    appointment_date?: string;
    appointment_type?: string;
    appointment_time_start?: string;
    appointment_time_end?: string;
  } | null;
  confirmed_technicians?: Array<{
    employee?: { name?: string; nickname?: string } | null;
  }> | null;
  employees?: Array<{
    employee?: { name?: string; nickname?: string } | null;
  }> | null;
  location?: {
    province_name?: string;
  } | null;
};

/**
 * Transform ticket data to report rows (generic)
 */
export function transformToReportRows(
  tickets: TicketDataForReport[]
): WorkTypeReportRow[] {
  return tickets.map((ticket, index) => {
    // Get company name with province
    const companyName = ticket.site?.company?.name_th || ticket.site?.company?.name_en || '';
    const siteName = ticket.site?.name || '';
    const provinceName = ticket.location?.province_name || '';

    // Combine company/site with province
    let fullCompanyName = companyName || siteName;
    if (provinceName) {
      fullCompanyName = `${fullCompanyName} ${provinceName}`;
    }

    // Get technician names - prefer confirmed technicians, fallback to assigned employees
    const technicians = ticket.confirmed_technicians && ticket.confirmed_technicians.length > 0
      ? ticket.confirmed_technicians
          .filter(t => t.employee)
          .map(t => ({ name: t.employee!.name || '', nickname: t.employee!.nickname }))
      : (ticket.employees || [])
          .filter(e => e.employee)
          .map(e => ({ name: e.employee!.name || '', nickname: e.employee!.nickname }));

    // Get appointment info
    const appointment = ticket.appointment;

    return {
      order: index + 1,
      date: formatDateThai(appointment?.appointment_date || null),
      description: ticket.details || '',
      companyName: fullCompanyName,
      technicianNames: formatTechnicianNames(technicians),
      vehicleRegistration: '', // No vehicle data in database
      time: getTimeDisplay(
        appointment?.appointment_type || null,
        appointment?.appointment_time_start || null,
        appointment?.appointment_time_end || null
      ),
      remark: '',
    };
  });
}

/**
 * Transform ticket data to RMA report rows (backward compatible)
 */
export function transformToRmaRows(tickets: TicketDataForReport[]): RmaReportRow[] {
  return transformToReportRows(tickets);
}
