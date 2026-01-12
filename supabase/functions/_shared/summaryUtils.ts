/**
 * Summary Utility - Internal helper for generating AI summaries
 * Used by ticket service when summarize flag is enabled
 */

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface SummaryOptions {
  maxLength?: number;
  context?: 'ticket' | 'site' | 'company' | 'general';
}

interface SummaryResult {
  summary: string;
  keyPoints: string[];
}

/**
 * Merchandise item for summary context
 */
export interface MerchandiseItem {
  serialNo?: string | null;
  modelName?: string | null;
  brand?: string | null;
  capacity?: string | null;
}

/**
 * Contact information for summary context
 */
export interface ContactInfo {
  name?: string | null;
  nickname?: string | null;
  phone?: string[] | null;
  email?: string[] | null;
  lineId?: string | null;
  note?: string | null;
}

/**
 * Appointment information for summary context
 */
export interface AppointmentInfo {
  date?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  type?: string | null;
  isApproved?: boolean | null;
}

/**
 * Site/Location information for summary context
 */
export interface SiteInfo {
  name?: string | null;
  addressDetail?: string | null;
  provinceName?: string | null;
  districtName?: string | null;
  subdistrictName?: string | null;
  postalCode?: string | null;
  mapUrl?: string | null;
}

/**
 * Ticket context for comprehensive summary - includes ALL ticket fields
 */
export interface TicketSummaryContext {
  // Core ticket info
  ticketId?: string | null;
  workType?: string | null;
  workTypeCode?: string | null;
  status?: string | null;
  statusCode?: string | null;

  // Details
  details?: string | null;
  additional?: string | null;

  // Company
  companyName?: string | null;
  companyTaxId?: string | null;

  // Site/Location
  site?: SiteInfo | null;

  // Contact
  contact?: ContactInfo | null;

  // Appointment
  appointment?: AppointmentInfo | null;

  // Employees/Technicians
  employees?: string[] | null;
  keyEmployee?: string | null;

  // Confirmed technicians
  confirmedEmployees?: string[] | null;

  // Merchandise/Equipment
  merchandise?: MerchandiseItem[] | null;

  // Work giver
  workGiver?: string | null;

  // Assigner
  assignerName?: string | null;

  // Timestamps
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Generate AI summary for given text
 * Returns original text if too short or AI service unavailable
 */
export async function generateSummary(
  text: string,
  options: SummaryOptions = {}
): Promise<SummaryResult> {
  const { maxLength = 150, context = 'ticket' } = options;

  // Return original if text is short or empty
  if (!text || text.trim().length === 0) {
    return { summary: '', keyPoints: [] };
  }

  if (text.length <= maxLength) {
    return { summary: text.trim(), keyPoints: [] };
  }

  // Check if OpenAI is configured
  if (!OPENAI_API_KEY) {
    console.warn('[summaryUtils] OPENAI_API_KEY not set, returning truncated text');
    return {
      summary: text.slice(0, maxLength).trim() + '...',
      keyPoints: [],
    };
  }

  try {
    // Build context-specific prompt
    const contextPrompts: Record<string, string> = {
      ticket: 'สรุปรายละเอียดงานบริการ/ตั๋วงาน ให้เน้นข้อมูลสำคัญ: ปัญหา, อุปกรณ์, สถานที่, ความเร่งด่วน',
      site: 'สรุปข้อมูลสถานที่/ลูกค้า ให้เน้น: ที่อยู่, ผู้ติดต่อ, ข้อมูลสำคัญ',
      company: 'สรุปข้อมูลบริษัท ให้เน้น: ธุรกิจ, ขนาด, ข้อมูลสำคัญ',
      general: 'สรุปข้อความให้กระชับ เน้นใจความสำคัญ',
    };

    const systemPrompt = `คุณคือผู้ช่วยสรุปข้อความ ${contextPrompts[context] || contextPrompts.general}

กฎ:
- ตอบเป็นภาษาเดียวกับข้อความต้นฉบับ
- สรุปให้กระชับ ไม่เกิน ${maxLength} ตัวอักษร
- รักษาข้อมูลสำคัญไว้ครบถ้วน (ชื่อ, ตัวเลข, วันที่, สถานที่, รุ่นอุปกรณ์)
- ไม่ต้องใส่คำนำหรือคำลงท้าย ให้ผลลัพธ์เป็นข้อความสรุปโดยตรง

ตอบในรูปแบบ JSON:
{
  "summary": "ข้อความสรุป",
  "keyPoints": ["จุดสำคัญ 1", "จุดสำคัญ 2"]
}`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('[summaryUtils] OpenAI API error:', response.status);
      return {
        summary: text.slice(0, maxLength).trim() + '...',
        keyPoints: [],
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        summary: text.slice(0, maxLength).trim() + '...',
        keyPoints: [],
      };
    }

    // Parse AI response
    const aiResult = JSON.parse(content);

    console.log(`[summaryUtils] Generated summary: ${text.length} -> ${aiResult.summary?.length || 0} chars`);

    return {
      summary: aiResult.summary || text.slice(0, maxLength).trim() + '...',
      keyPoints: aiResult.keyPoints || [],
    };

  } catch (err) {
    console.error('[summaryUtils] Error generating summary:', err);
    return {
      summary: text.slice(0, maxLength).trim() + '...',
      keyPoints: [],
    };
  }
}

/**
 * Generate summary only if text exceeds minimum length
 * Useful for conditional summarization
 */
export async function generateSummaryIfNeeded(
  text: string,
  minLength: number = 100,
  options: SummaryOptions = {}
): Promise<string | null> {
  if (!text || text.length < minLength) {
    return null; // No summary needed
  }

  const result = await generateSummary(text, options);
  return result.summary;
}

/**
 * Build formatted text from ALL ticket context fields
 * Every single detail is included - nothing is skipped
 */
function buildFullTicketText(context: TicketSummaryContext): string {
  const sections: string[] = [];

  // === WORK TYPE & STATUS ===
  if (context.workType) {
    const workTypeText = context.workTypeCode
      ? `${context.workType} (${context.workTypeCode})`
      : context.workType;
    sections.push(`[ประเภทงาน] ${workTypeText}`);
  }
  if (context.status) {
    const statusText = context.statusCode
      ? `${context.status} (${context.statusCode})`
      : context.status;
    sections.push(`[สถานะ] ${statusText}`);
  }

  // === COMPANY ===
  if (context.companyName) {
    let companyText = context.companyName;
    if (context.companyTaxId) {
      companyText += ` (Tax ID: ${context.companyTaxId})`;
    }
    sections.push(`[บริษัท] ${companyText}`);
  }

  // === SITE/LOCATION ===
  if (context.site) {
    const siteParts: string[] = [];
    if (context.site.name) siteParts.push(`ชื่อ: ${context.site.name}`);
    if (context.site.addressDetail) siteParts.push(`ที่อยู่: ${context.site.addressDetail}`);

    // Build location string
    const locationParts: string[] = [];
    if (context.site.subdistrictName) locationParts.push(context.site.subdistrictName);
    if (context.site.districtName) locationParts.push(context.site.districtName);
    if (context.site.provinceName) locationParts.push(context.site.provinceName);
    if (context.site.postalCode) locationParts.push(context.site.postalCode);

    if (locationParts.length > 0) {
      siteParts.push(`พื้นที่: ${locationParts.join(' ')}`);
    }
    if (context.site.mapUrl) siteParts.push(`Map: ${context.site.mapUrl}`);

    if (siteParts.length > 0) {
      sections.push(`[สถานที่] ${siteParts.join(' | ')}`);
    }
  }

  // === CONTACT ===
  if (context.contact) {
    const contactParts: string[] = [];
    if (context.contact.name) {
      let nameText = context.contact.name;
      if (context.contact.nickname) nameText += ` (${context.contact.nickname})`;
      contactParts.push(`ชื่อ: ${nameText}`);
    }
    if (context.contact.phone && context.contact.phone.length > 0) {
      contactParts.push(`โทร: ${context.contact.phone.join(', ')}`);
    }
    if (context.contact.email && context.contact.email.length > 0) {
      contactParts.push(`Email: ${context.contact.email.join(', ')}`);
    }
    if (context.contact.lineId) {
      contactParts.push(`LINE: ${context.contact.lineId}`);
    }
    if (context.contact.note) {
      contactParts.push(`หมายเหตุผู้ติดต่อ: ${context.contact.note}`);
    }

    if (contactParts.length > 0) {
      sections.push(`[ผู้ติดต่อ] ${contactParts.join(' | ')}`);
    }
  }

  // === APPOINTMENT ===
  if (context.appointment) {
    const apptParts: string[] = [];
    if (context.appointment.date) {
      apptParts.push(`วันที่: ${context.appointment.date}`);
    }
    if (context.appointment.timeStart) {
      let timeText = context.appointment.timeStart;
      if (context.appointment.timeEnd) {
        timeText += ` - ${context.appointment.timeEnd}`;
      }
      apptParts.push(`เวลา: ${timeText}`);
    }
    if (context.appointment.type) {
      apptParts.push(`ประเภท: ${context.appointment.type}`);
    }
    if (context.appointment.isApproved !== null && context.appointment.isApproved !== undefined) {
      apptParts.push(`อนุมัติ: ${context.appointment.isApproved ? 'ใช่' : 'ไม่'}`);
    }

    if (apptParts.length > 0) {
      sections.push(`[นัดหมาย] ${apptParts.join(' | ')}`);
    }
  }

  // === EMPLOYEES/TECHNICIANS ===
  if (context.keyEmployee) {
    sections.push(`[ช่างหลัก] ${context.keyEmployee}`);
  }
  if (context.employees && context.employees.length > 0) {
    const otherEmployees = context.keyEmployee
      ? context.employees.filter(e => e !== context.keyEmployee)
      : context.employees;
    if (otherEmployees.length > 0) {
      sections.push(`[ช่างทั้งหมด] ${otherEmployees.join(', ')}`);
    }
  }
  if (context.confirmedEmployees && context.confirmedEmployees.length > 0) {
    sections.push(`[ช่างยืนยัน] ${context.confirmedEmployees.join(', ')}`);
  }

  // === MERCHANDISE/EQUIPMENT ===
  if (context.merchandise && context.merchandise.length > 0) {
    const merchTexts = context.merchandise.map((m, idx) => {
      const parts: string[] = [];
      if (m.brand) parts.push(m.brand);
      if (m.modelName) parts.push(m.modelName);
      if (m.capacity) parts.push(m.capacity);
      if (m.serialNo) parts.push(`S/N: ${m.serialNo}`);
      return `${idx + 1}. ${parts.join(' ') || 'ไม่ระบุ'}`;
    });
    sections.push(`[อุปกรณ์]\n${merchTexts.join('\n')}`);
  }

  // === WORK GIVER ===
  if (context.workGiver) {
    sections.push(`[ผู้ว่าจ้าง] ${context.workGiver}`);
  }

  // === ASSIGNER ===
  if (context.assignerName) {
    sections.push(`[ผู้มอบหมาย] ${context.assignerName}`);
  }

  // === DETAILS (Main description) ===
  if (context.details) {
    sections.push(`[รายละเอียดงาน]\n${context.details}`);
  }

  // === ADDITIONAL NOTES ===
  if (context.additional) {
    sections.push(`[หมายเหตุเพิ่มเติม]\n${context.additional}`);
  }

  // === TIMESTAMPS ===
  const timestamps: string[] = [];
  if (context.createdAt) timestamps.push(`สร้าง: ${context.createdAt}`);
  if (context.updatedAt) timestamps.push(`แก้ไข: ${context.updatedAt}`);
  if (timestamps.length > 0) {
    sections.push(`[เวลา] ${timestamps.join(' | ')}`);
  }

  return sections.join('\n\n');
}

/**
 * Generate comprehensive ticket summary from full ticket context
 * Includes: ALL ticket fields - site, work type, employees, appointment,
 * merchandise, contact, details, additional, work giver, timestamps, etc.
 *
 * IMPORTANT: This function does NOT skip any detail - everything is passed to AI
 */
export async function generateTicketSummary(
  context: TicketSummaryContext,
  maxLength: number = 150
): Promise<string | null> {
  // Build comprehensive ticket text from ALL fields
  const fullText = buildFullTicketText(context);

  console.log(`[summaryUtils] Building summary from context, fullText length: ${fullText.length}`);
  console.log(`[summaryUtils] Context fields present:`, Object.keys(context).filter(k => {
    const val = context[k as keyof TicketSummaryContext];
    return val !== null && val !== undefined && val !== '';
  }));

  // If text is too short, return a simple concatenation
  if (fullText.length < 20) {
    console.log('[summaryUtils] Text too short, returning simple summary');
    const simpleParts = [context.workType, context.site?.name].filter(Boolean);
    return simpleParts.join(' @ ') || null;
  }

  // Check if OpenAI is configured
  if (!OPENAI_API_KEY) {
    console.warn('[summaryUtils] OPENAI_API_KEY not set, returning fallback summary');
    return buildFallbackSummary(context);
  }

  try {
    const systemPrompt = `สรุปตั๋วงาน UPS ให้กระชับที่สุด ไม่เกิน ${maxLength} ตัวอักษร

กฎ:
- เริ่มด้วยผู้ว่าจ้าง (work giver) เสมอ
- ใส่ Serial Number ของอุปกรณ์
- ไม่ต้องใส่สถานะตั๋ว
- ใช้ชื่อบริษัทเท่านั้น ไม่ต้องใส่ที่อยู่/สถานที่
- ไม่ต้องใส่ข้อมูลพนักงานภายใน (ช่าง/ผู้จ่ายงาน)
- ใส่เฉพาะผู้ติดต่อลูกค้า (ถ้ามี)
- ตัดคำฟุ่มเฟือย
- ใช้ | คั่นข้อมูล
- ห้ามใส่ "" ล้อมข้อความ

ลำดับ: ผู้ว่าจ้าง | ประเภทงาน | อุปกรณ์ รุ่น S/N | ปัญหา | บริษัท | นัด | ติดต่อ

ตัวอย่าง:
APC | PM | SRT3000 S/N:AS123456 | แบตเสื่อม | ธ.กสิกร | 15ม.ค.09:00 | มานี 081xxx
Emerson | RMA | 10kVA S/N:EM789 | ไฟแดงกระพริบ | แกรนด์โฮเทล | 20ม.ค.บ่าย`;

    console.log('[summaryUtils] Calling OpenAI API...');

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullText },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[summaryUtils] OpenAI API error:', response.status, errorText);
      return buildFallbackSummary(context);
    }

    const data = await response.json();
    let summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      console.warn('[summaryUtils] No summary in API response');
      return buildFallbackSummary(context);
    }

    // Remove any surrounding quotes that AI might have added
    summary = summary.replace(/^["']|["']$/g, '').trim();

    console.log(`[summaryUtils] Generated ticket summary: ${fullText.length} -> ${summary.length} chars`);
    return summary;

  } catch (err) {
    console.error('[summaryUtils] Error generating ticket summary:', err);
    return buildFallbackSummary(context);
  }
}

/**
 * Build a fallback summary when AI is unavailable
 */
function buildFallbackSummary(context: TicketSummaryContext): string {
  const parts: string[] = [];

  // Start with work giver
  if (context.workGiver) parts.push(context.workGiver);

  // Work type
  if (context.workType) parts.push(context.workType);

  // Add merchandise info with serial number
  if (context.merchandise && context.merchandise.length > 0) {
    const firstMerch = context.merchandise[0];
    const merchParts: string[] = [];
    if (firstMerch.modelName) merchParts.push(firstMerch.modelName);
    if (firstMerch.serialNo) merchParts.push(`S/N:${firstMerch.serialNo}`);
    if (merchParts.length > 0) parts.push(merchParts.join(' '));
  }

  // Company name only (no site details)
  if (context.companyName) parts.push(context.companyName);

  // Appointment
  if (context.appointment?.date) {
    let apptText = context.appointment.date;
    if (context.appointment.timeStart) apptText += context.appointment.timeStart;
    parts.push(apptText);
  }

  // Customer contact only (no internal employees)
  if (context.contact?.name) {
    let contactText = context.contact.name;
    if (context.contact.phone && context.contact.phone.length > 0) {
      contactText += ' ' + context.contact.phone[0];
    }
    parts.push(contactText);
  }

  return parts.join(' | ') || 'ไม่มีข้อมูล';
}
