/**
 * AI Tool Definitions for OpenAI
 * Defines available tools that the AI can use
 */

// OpenAI format
export const AI_TOOLS_OPENAI = [
  {
    type: 'function',
    function: {
      name: 'search_sites',
      description: 'ค้นหาสถานที่/ลูกค้าในระบบ รองรับค้นหาตามชื่อสถานที่ ที่อยู่ หรือชื่อบริษัท',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'คำค้นหา (ชื่อสถานที่, ที่อยู่, หรือชื่อบริษัท)' },
          company_id: { type: 'string', description: 'UUID ของบริษัท (กรองเฉพาะสถานที่ของบริษัทนี้)' },
          limit: { type: 'number', description: 'จำนวนผลลัพธ์ (default: 10, max: 50) ใช้มากขึ้นถ้าผู้ใช้ต้องการดูทั้งหมด' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_companies',
      description: 'ค้นหาบริษัทในระบบ',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'คำค้นหา (ชื่อบริษัท หรือ tax_id)' },
          limit: { type: 'number', description: 'จำนวนผลลัพธ์ (default: 10, max: 50)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_employees',
      description: 'ค้นหาพนักงาน/ช่างในระบบ ตามชื่อ ชื่อเล่น อีเมล หรือกรองตามบทบาทและแผนก',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'คำค้นหา (ชื่อ, ชื่อเล่น, หรืออีเมล)' },
          role_code: { type: 'string', description: 'กรองตาม role code เช่น technician, technician_l1, technician_l2, assigner, admin' },
          role_id: { type: 'string', description: 'กรองตาม role UUID (ใช้แทน role_code ได้)' },
          department_id: { type: 'string', description: 'กรองตาม department UUID' },
          is_active: { type: 'boolean', description: 'กรองตามสถานะ (default: true = เฉพาะพนักงานที่ active)' },
          limit: { type: 'number', description: 'จำนวนผลลัพธ์ (default: 10, max: 50)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reference_data',
      description: 'ดึงข้อมูลอ้างอิง',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['work_types', 'statuses', 'work_givers'], description: 'ประเภทข้อมูล' },
        },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_ticket',
      description: 'สร้างตั๋วงานใหม่',
      parameters: {
        type: 'object',
        properties: {
          work_type_code: { type: 'string', enum: ['pm', 'rma', 'sales', 'survey', 'start_up', 'pickup', 'account', 'ags_battery'] },
          status_code: { type: 'string', enum: ['normal', 'urgent'], default: 'normal' },
          site_id: { type: 'string', description: 'UUID ของสถานที่' },
          site_name: { type: 'string', description: 'ชื่อสถานที่ใหม่' },
          company_tax_id: { type: 'string' },
          company_name: { type: 'string' },
          details: { type: 'string' },
          contact_name: { type: 'string' },
          contact_phone: { type: 'string' },
          appointment_date: { type: 'string', description: 'YYYY-MM-DD' },
          employee_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['work_type_code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ticket_summary',
      description: 'ดึงสรุปจำนวนตั๋วงาน แยกตามประเภทงาน ใช้เมื่อต้องการรู้ภาพรวมก่อนดึงรายละเอียด เหมาะสำหรับสรุปงานรายวัน/รายสัปดาห์',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'วันที่ (YYYY-MM-DD) เช่น วันนี้' },
          start_date: { type: 'string', description: 'วันที่เริ่มต้น (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'วันที่สิ้นสุด (YYYY-MM-DD)' },
          date_type: { type: 'string', enum: ['appointed', 'create', 'update'], description: 'ประเภทวันที่ (default: appointed)' },
          employee_id: { type: 'string', description: 'กรองตาม UUID ของช่าง' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tickets',
      description: 'ค้นหาตั๋วงาน รองรับกรองตามวันที่นัดหมาย วันสร้าง ประเภทงาน สถานะ ช่างที่มอบหมาย และจังหวัด ผลลัพธ์จะมีข้อมูลสถานที่ (จังหวัด/อำเภอ/ตำบล)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'คำค้นหา (รายละเอียดงาน)' },
          work_type_code: { type: 'string', enum: ['pm', 'rma', 'sales', 'survey', 'start_up', 'pickup', 'account', 'ags_battery'], description: 'กรองตามประเภทงาน' },
          status_code: { type: 'string', enum: ['normal', 'urgent'], description: 'กรองตามสถานะ' },
          date: { type: 'string', description: 'กรองตามวันที่เดียว (YYYY-MM-DD) เช่น วันนี้' },
          start_date: { type: 'string', description: 'วันที่เริ่มต้น (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'วันที่สิ้นสุด (YYYY-MM-DD)' },
          date_type: { type: 'string', enum: ['appointed', 'create', 'update'], description: 'ประเภทวันที่ที่จะกรอง (default: appointed = วันนัดหมาย)' },
          employee_id: { type: 'string', description: 'กรองตาม UUID ของช่างที่มอบหมาย' },
          site_id: { type: 'string', description: 'กรองตาม UUID ของสถานที่' },
          province_code: { type: 'number', description: 'กรองตามรหัสจังหวัด (ใช้ search_locations เพื่อหารหัส)' },
          limit: { type: 'number', description: 'จำนวนผลลัพธ์ (default: 10, max: 50)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_employees',
      description: 'ดึงรายชื่อช่างที่ว่าง (ไม่มีงานที่ได้รับมอบหมายและยืนยันแล้ว) ในวันที่กำหนด ใช้เมื่อต้องการหาช่างที่ว่างสำหรับจัดงาน หรือตอบคำถาม "วันนี้ใครว่างบ้าง" "ใครไม่มีงาน"',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'วันที่ต้องการตรวจสอบ (YYYY-MM-DD) เช่น วันนี้ พรุ่งนี้' },
          role_code: { type: 'string', description: 'กรองตาม role code เช่น technician (รวมทุก level), technician_l1, technician_l2' },
          department_id: { type: 'string', description: 'กรองตาม department UUID' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_locations',
      description: 'ค้นหาจังหวัด/อำเภอ/ตำบล ใช้เมื่อต้องการหารหัสจังหวัดสำหรับกรองข้อมูล หรือต้องการดูรายชื่อจังหวัด/อำเภอ/ตำบล',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'คำค้นหา (ชื่อจังหวัด, อำเภอ หรือตำบล) เช่น "กรุงเทพ", "สมุทรปราการ"' },
          type: { type: 'string', enum: ['province', 'district', 'subdistrict'], description: 'ประเภทสถานที่ (default: province)' },
          province_code: { type: 'number', description: 'รหัสจังหวัด (ใช้สำหรับค้นหาอำเภอ/ตำบลภายในจังหวัด)' },
          district_code: { type: 'number', description: 'รหัสอำเภอ (ใช้สำหรับค้นหาตำบลภายในอำเภอ)' },
          limit: { type: 'number', description: 'จำนวนผลลัพธ์ (default: 20, max: 77 สำหรับจังหวัด)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ticket_summary_by_location',
      description: 'ดึงสรุปจำนวนตั๋วงานแยกตามจังหวัด ใช้เมื่อต้องการดูภาพรวมงานตามพื้นที่ เหมาะสำหรับวางแผนจัดสรรช่าง',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'วันที่ (YYYY-MM-DD) เช่น วันนี้' },
          start_date: { type: 'string', description: 'วันที่เริ่มต้น (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'วันที่สิ้นสุด (YYYY-MM-DD)' },
          date_type: { type: 'string', enum: ['appointed', 'create', 'update'], description: 'ประเภทวันที่ (default: appointed)' },
          work_type_code: { type: 'string', enum: ['pm', 'rma', 'sales', 'survey', 'start_up', 'pickup', 'account', 'ags_battery'], description: 'กรองตามประเภทงาน' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_routes',
      description: 'แนะนำการจัดสายงาน (Route Optimization) สำหรับวันที่กำหนด จัดกลุ่มตั๋วงานตามพื้นที่ใกล้เคียง แนะนำลำดับการเข้างาน และจำนวนช่างที่ต้องการต่อสาย ใช้เมื่อต้องการวางแผนจัดสายงานหรือดูคำแนะนำการจัดงาน ผลลัพธ์จะมี formatted_summary ที่แสดงรายละเอียดครบถ้วน ให้แสดง formatted_summary ทั้งหมดแก่ผู้ใช้',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'วันที่ต้องการจัดสาย (YYYY-MM-DD) - ต้องระบุ' },
          max_tickets_per_route: { type: 'number', description: 'จำนวนงานสูงสุดต่อสาย (default: 4 นอก กทม., 6 ใน กทม.)' },
          include_assigned: { type: 'boolean', description: 'รวมงานที่มอบหมายแล้วด้วย (default: true)' },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'ค้นหาข้อมูลจากอินเทอร์เน็ต ใช้เมื่อต้องการหาข้อมูลทั่วไปที่ไม่ได้อยู่ในระบบ เช่น ร้านอาหารใกล้ออฟฟิศ สถานที่ท่องเที่ยว ข่าวสาร ข้อมูลทั่วไป',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'คำค้นหา (ภาษาไทยหรืออังกฤษ)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ticket_details',
      description: 'ดูรายละเอียดตั๋วงาน รวมถึงไฟล์แนบ (รูปภาพ/เอกสาร), ความคิดเห็น/คอมเมนต์, และประวัติการเปลี่ยนแปลง (audit log) ใช้เมื่อต้องการดูรายละเอียดทั้งหมดของตั๋วงาน',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'UUID ของตั๋วงาน (สามารถใช้ ID บางส่วนได้ เช่น a1b2c3d4)' },
          include_attachments: { type: 'boolean', description: 'รวมไฟล์แนบ (รูปภาพ/เอกสาร) (default: true)' },
          include_comments: { type: 'boolean', description: 'รวมความคิดเห็น/คอมเมนต์ (default: true)' },
          include_audit_log: { type: 'boolean', description: 'รวมประวัติการเปลี่ยนแปลง (default: true)' },
          comments_limit: { type: 'number', description: 'จำนวนคอมเมนต์สูงสุด (default: 20)' },
          audit_limit: { type: 'number', description: 'จำนวน audit log สูงสุด (default: 20)' },
        },
        required: ['ticket_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'review_ticket_safety',
      description: 'ตรวจสอบความปลอดภัยของตั๋วงาน ดูข้อกำหนดความปลอดภัยของสถานที่ (รองเท้าเซฟตี้, หมวกนิรภัย, เสื้อสะท้อนแสง, การอบรม) และตรวจสอบว่าช่างที่มอบหมายผ่านการอบรมสถานที่นี้แล้วหรือยัง ใช้เมื่อต้องการตรวจสอบความพร้อมด้านความปลอดภัยก่อนออกงาน',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'UUID ของตั๋วงาน (สามารถใช้ ID บางส่วนได้ เช่น a1b2c3d4)' },
        },
        required: ['ticket_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_apc_ups',
      description: 'แนะนำ UPS APC by Schneider Electric ที่เหมาะสมกับความต้องการของลูกค้า ใช้เมื่อลูกค้าถามเกี่ยวกับ UPS หรือต้องการคำแนะนำในการเลือก UPS โดยค้นหาข้อมูลจากอินเทอร์เน็ตและฐานข้อมูลผลิตภัณฑ์ APC ให้ผลลัพธ์ 5 รุ่นที่เหมาะสมที่สุดพร้อมเหตุผล',
      parameters: {
        type: 'object',
        properties: {
          power_load_va: {
            type: 'number',
            description: 'กำลังไฟที่ต้องการ (VA) เช่น 1000, 2000, 3000 VA - ถ้าลูกค้าบอกเป็นวัตต์ ให้คูณ 1.4 เพื่อแปลงเป็น VA',
          },
          power_load_watts: {
            type: 'number',
            description: 'กำลังไฟที่ต้องการ (Watts) - จะถูกแปลงเป็น VA โดยอัตโนมัติ (x1.4)',
          },
          runtime_minutes: {
            type: 'number',
            description: 'ระยะเวลาสำรองไฟที่ต้องการ (นาที) เช่น 10, 15, 30 นาที',
          },
          use_case: {
            type: 'string',
            enum: ['server', 'desktop', 'network', 'data_center', 'home', 'office', 'industrial'],
            description: 'ประเภทการใช้งาน: server (เซิร์ฟเวอร์), desktop (คอมพิวเตอร์), network (อุปกรณ์เครือข่าย), data_center (ดาต้าเซ็นเตอร์), home (บ้าน), office (สำนักงาน), industrial (อุตสาหกรรม)',
          },
          form_factor: {
            type: 'string',
            enum: ['tower', 'rackmount', 'convertible'],
            description: 'รูปแบบ: tower (ตั้งพื้น), rackmount (ติดตั้งในตู้ Rack), convertible (ปรับเปลี่ยนได้)',
          },
          topology: {
            type: 'string',
            enum: ['line-interactive', 'online-double-conversion', 'standby'],
            description: 'เทคโนโลยี UPS: line-interactive (ทั่วไป ประหยัด), online-double-conversion (ป้องกันสูงสุด สำหรับอุปกรณ์สำคัญ), standby (พื้นฐาน)',
          },
          phase: {
            type: 'string',
            enum: ['single', 'three'],
            description: 'ระบบไฟ: single (1 เฟส 220V), three (3 เฟส 380V)',
          },
          budget_thb: {
            type: 'number',
            description: 'งบประมาณ (บาท) - ถ้ามีการระบุ',
          },
          features: {
            type: 'array',
            items: { type: 'string' },
            description: 'คุณสมบัติที่ต้องการ เช่น ["lcd", "network_card", "hot_swap_battery", "extended_runtime", "usb", "serial"]',
          },
          equipment_details: {
            type: 'string',
            description: 'รายละเอียดอุปกรณ์ที่จะต่อ เช่น "เซิร์ฟเวอร์ 2 ตัว + สวิตช์ 1 ตัว" หรือ "คอมพิวเตอร์ 5 เครื่อง + จอ 5 จอ"',
          },
        },
        required: [],
      },
    },
  },
];

// Claude format (legacy)
export const AI_TOOLS = [
  {
    name: 'search_sites',
    description: 'ค้นหาสถานที่/ลูกค้าในระบบ ใช้เมื่อต้องการหาข้อมูลลูกค้าหรือสถานที่ที่มีอยู่แล้ว',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'คำค้นหา (ชื่อสถานที่, ชื่อบริษัท, หรือที่อยู่)',
        },
        limit: {
          type: 'number',
          description: 'จำนวนผลลัพธ์สูงสุด (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_companies',
    description: 'ค้นหาบริษัทในระบบ ใช้เมื่อต้องการหาข้อมูลบริษัท',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'คำค้นหา (ชื่อบริษัท หรือ เลขประจำตัวผู้เสียภาษี)',
        },
        limit: {
          type: 'number',
          description: 'จำนวนผลลัพธ์สูงสุด (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_employees',
    description: 'ค้นหาพนักงาน/ช่างในระบบ ตามชื่อ ชื่อเล่น อีเมล หรือกรองตามบทบาทและแผนก',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'คำค้นหา (ชื่อ, ชื่อเล่น, หรืออีเมล)',
        },
        role_code: {
          type: 'string',
          description: 'กรองตาม role code เช่น technician, technician_l1, technician_l2, assigner, admin',
        },
        role_id: {
          type: 'string',
          description: 'กรองตาม role UUID (ใช้แทน role_code ได้)',
        },
        department_id: {
          type: 'string',
          description: 'กรองตาม department UUID',
        },
        is_active: {
          type: 'boolean',
          description: 'กรองตามสถานะ (default: true = เฉพาะพนักงานที่ active)',
        },
        limit: {
          type: 'number',
          description: 'จำนวนผลลัพธ์สูงสุด (default: 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_reference_data',
    description: 'ดึงข้อมูลอ้างอิงในระบบ เช่น ประเภทงาน, สถานะ, ผู้ว่าจ้าง',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['work_types', 'statuses', 'work_givers'],
          description: 'ประเภทข้อมูลอ้างอิงที่ต้องการ',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'create_ticket',
    description: 'สร้างตั๋วงานใหม่ ใช้เมื่อผู้ใช้ต้องการสร้างงานใหม่ ต้องมีข้อมูลอย่างน้อย: ประเภทงาน, สถานที่/ลูกค้า',
    input_schema: {
      type: 'object',
      properties: {
        work_type_code: {
          type: 'string',
          enum: ['pm', 'rma', 'sales', 'survey', 'start_up', 'pickup', 'account', 'ags_battery'],
          description: 'รหัสประเภทงาน',
        },
        status_code: {
          type: 'string',
          enum: ['normal', 'urgent'],
          description: 'สถานะความเร่งด่วน (default: normal)',
        },
        site_id: {
          type: 'string',
          description: 'UUID ของสถานที่ (ถ้ามีอยู่แล้วในระบบ)',
        },
        site_name: {
          type: 'string',
          description: 'ชื่อสถานที่ใหม่ (ถ้าต้องการสร้างใหม่)',
        },
        company_tax_id: {
          type: 'string',
          description: 'เลขประจำตัวผู้เสียภาษีของบริษัท',
        },
        company_name: {
          type: 'string',
          description: 'ชื่อบริษัท (ถ้าต้องการสร้างใหม่)',
        },
        details: {
          type: 'string',
          description: 'รายละเอียดงาน',
        },
        contact_name: {
          type: 'string',
          description: 'ชื่อผู้ติดต่อ',
        },
        contact_phone: {
          type: 'string',
          description: 'เบอร์โทรผู้ติดต่อ',
        },
        appointment_date: {
          type: 'string',
          description: 'วันที่นัดหมาย (YYYY-MM-DD)',
        },
        appointment_time_start: {
          type: 'string',
          description: 'เวลาเริ่ม (HH:MM)',
        },
        appointment_time_end: {
          type: 'string',
          description: 'เวลาสิ้นสุด (HH:MM)',
        },
        employee_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'รายการ UUID ของช่างที่มอบหมาย',
        },
      },
      required: ['work_type_code'],
    },
  },
  {
    name: 'get_ticket_summary',
    description: 'ดึงสรุปจำนวนตั๋วงาน แยกตามประเภทงาน ใช้เมื่อต้องการรู้ภาพรวมก่อนดึงรายละเอียด',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'วันที่ (YYYY-MM-DD) เช่น วันนี้',
        },
        start_date: {
          type: 'string',
          description: 'วันที่เริ่มต้น (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'วันที่สิ้นสุด (YYYY-MM-DD)',
        },
        date_type: {
          type: 'string',
          enum: ['appointed', 'create', 'update'],
          description: 'ประเภทวันที่ (default: appointed)',
        },
        employee_id: {
          type: 'string',
          description: 'กรองตาม UUID ของช่าง',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_tickets',
    description: 'ค้นหาตั๋วงานในระบบ รองรับกรองตามวันที่นัดหมาย วันสร้าง ประเภทงาน สถานะ ช่างที่มอบหมาย และจังหวัด ผลลัพธ์จะมีข้อมูลสถานที่ (จังหวัด/อำเภอ/ตำบล)',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'คำค้นหา (รายละเอียดงาน)',
        },
        work_type_code: {
          type: 'string',
          enum: ['pm', 'rma', 'sales', 'survey', 'start_up', 'pickup', 'account', 'ags_battery'],
          description: 'กรองตามประเภทงาน',
        },
        status_code: {
          type: 'string',
          enum: ['normal', 'urgent'],
          description: 'กรองตามสถานะ',
        },
        date: {
          type: 'string',
          description: 'กรองตามวันที่เดียว (YYYY-MM-DD) เช่น วันนี้',
        },
        start_date: {
          type: 'string',
          description: 'วันที่เริ่มต้น (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'วันที่สิ้นสุด (YYYY-MM-DD)',
        },
        date_type: {
          type: 'string',
          enum: ['appointed', 'create', 'update'],
          description: 'ประเภทวันที่ที่จะกรอง (default: appointed = วันนัดหมาย)',
        },
        employee_id: {
          type: 'string',
          description: 'กรองตาม UUID ของช่างที่มอบหมาย',
        },
        site_id: {
          type: 'string',
          description: 'กรองตาม UUID ของสถานที่',
        },
        province_code: {
          type: 'number',
          description: 'กรองตามรหัสจังหวัด (ใช้ search_locations เพื่อหารหัส)',
        },
        limit: {
          type: 'number',
          description: 'จำนวนผลลัพธ์สูงสุด (default: 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_available_employees',
    description: 'ดึงรายชื่อช่างที่ว่าง (ไม่มีงานที่ได้รับมอบหมายและยืนยันแล้ว) ในวันที่กำหนด ใช้เมื่อต้องการหาช่างที่ว่างสำหรับจัดงาน หรือตอบคำถาม "วันนี้ใครว่างบ้าง" "ใครไม่มีงาน"',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'วันที่ต้องการตรวจสอบ (YYYY-MM-DD) เช่น วันนี้ พรุ่งนี้',
        },
        role_code: {
          type: 'string',
          description: 'กรองตาม role code เช่น technician (รวมทุก level), technician_l1, technician_l2',
        },
        department_id: {
          type: 'string',
          description: 'กรองตาม department UUID',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'search_locations',
    description: 'ค้นหาจังหวัด/อำเภอ/ตำบล ใช้เมื่อต้องการหารหัสจังหวัดสำหรับกรองข้อมูล หรือต้องการดูรายชื่อจังหวัด/อำเภอ/ตำบล',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'คำค้นหา (ชื่อจังหวัด, อำเภอ หรือตำบล) เช่น "กรุงเทพ", "สมุทรปราการ"',
        },
        type: {
          type: 'string',
          enum: ['province', 'district', 'subdistrict'],
          description: 'ประเภทสถานที่ (default: province)',
        },
        province_code: {
          type: 'number',
          description: 'รหัสจังหวัด (ใช้สำหรับค้นหาอำเภอ/ตำบลภายในจังหวัด)',
        },
        district_code: {
          type: 'number',
          description: 'รหัสอำเภอ (ใช้สำหรับค้นหาตำบลภายในอำเภอ)',
        },
        limit: {
          type: 'number',
          description: 'จำนวนผลลัพธ์สูงสุด (default: 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_ticket_summary_by_location',
    description: 'ดึงสรุปจำนวนตั๋วงานแยกตามจังหวัด ใช้เมื่อต้องการดูภาพรวมงานตามพื้นที่ เหมาะสำหรับวางแผนจัดสรรช่าง',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'วันที่ (YYYY-MM-DD) เช่น วันนี้',
        },
        start_date: {
          type: 'string',
          description: 'วันที่เริ่มต้น (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'วันที่สิ้นสุด (YYYY-MM-DD)',
        },
        date_type: {
          type: 'string',
          enum: ['appointed', 'create', 'update'],
          description: 'ประเภทวันที่ (default: appointed)',
        },
        work_type_code: {
          type: 'string',
          enum: ['pm', 'rma', 'sales', 'survey', 'start_up', 'pickup', 'account', 'ags_battery'],
          description: 'กรองตามประเภทงาน',
        },
      },
      required: [],
    },
  },
  {
    name: 'suggest_routes',
    description: 'แนะนำการจัดสายงาน (Route Optimization) สำหรับวันที่กำหนด จัดกลุ่มตั๋วงานตามพื้นที่ใกล้เคียง แนะนำลำดับการเข้างาน และจำนวนช่างที่ต้องการต่อสาย ผลลัพธ์จะมี formatted_summary ที่แสดงรายละเอียดครบถ้วน ให้แสดง formatted_summary ทั้งหมดแก่ผู้ใช้',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'วันที่ต้องการจัดสาย (YYYY-MM-DD) - ต้องระบุ',
        },
        max_tickets_per_route: {
          type: 'number',
          description: 'จำนวนงานสูงสุดต่อสาย (default: 4 นอก กทม., 6 ใน กทม.)',
        },
        include_assigned: {
          type: 'boolean',
          description: 'รวมงานที่มอบหมายแล้วด้วย (default: true)',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'web_search',
    description: 'ค้นหาข้อมูลจากอินเทอร์เน็ต ใช้เมื่อต้องการหาข้อมูลทั่วไปที่ไม่ได้อยู่ในระบบ เช่น ร้านอาหารใกล้ออฟฟิศ สถานที่ท่องเที่ยว ข่าวสาร ข้อมูลทั่วไป',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'คำค้นหา (ภาษาไทยหรืออังกฤษ)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_ticket_details',
    description: 'ดูรายละเอียดตั๋วงาน รวมถึงไฟล์แนบ (รูปภาพ/เอกสาร), ความคิดเห็น/คอมเมนต์, และประวัติการเปลี่ยนแปลง (audit log) ใช้เมื่อต้องการดูรายละเอียดทั้งหมดของตั๋วงาน',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: {
          type: 'string',
          description: 'UUID ของตั๋วงาน (สามารถใช้ ID บางส่วนได้ เช่น a1b2c3d4)',
        },
        include_attachments: {
          type: 'boolean',
          description: 'รวมไฟล์แนบ (รูปภาพ/เอกสาร) (default: true)',
        },
        include_comments: {
          type: 'boolean',
          description: 'รวมความคิดเห็น/คอมเมนต์ (default: true)',
        },
        include_audit_log: {
          type: 'boolean',
          description: 'รวมประวัติการเปลี่ยนแปลง (default: true)',
        },
        comments_limit: {
          type: 'number',
          description: 'จำนวนคอมเมนต์สูงสุด (default: 20)',
        },
        audit_limit: {
          type: 'number',
          description: 'จำนวน audit log สูงสุด (default: 20)',
        },
      },
      required: ['ticket_id'],
    },
  },
  {
    name: 'review_ticket_safety',
    description: 'ตรวจสอบความปลอดภัยของตั๋วงาน ดูข้อกำหนดความปลอดภัยของสถานที่ (รองเท้าเซฟตี้, หมวกนิรภัย, เสื้อสะท้อนแสง, การอบรม) และตรวจสอบว่าช่างที่มอบหมายผ่านการอบรมสถานที่นี้แล้วหรือยัง ใช้เมื่อต้องการตรวจสอบความพร้อมด้านความปลอดภัยก่อนออกงาน',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: {
          type: 'string',
          description: 'UUID ของตั๋วงาน (สามารถใช้ ID บางส่วนได้ เช่น a1b2c3d4)',
        },
      },
      required: ['ticket_id'],
    },
  },
  {
    name: 'recommend_apc_ups',
    description: 'แนะนำ UPS APC by Schneider Electric ที่เหมาะสมกับความต้องการของลูกค้า ใช้เมื่อลูกค้าถามเกี่ยวกับ UPS หรือต้องการคำแนะนำในการเลือก UPS โดยค้นหาข้อมูลจากอินเทอร์เน็ตและฐานข้อมูลผลิตภัณฑ์ APC',
    input_schema: {
      type: 'object',
      properties: {
        power_load_va: {
          type: 'number',
          description: 'กำลังไฟที่ต้องการ (VA) เช่น 1000, 2000, 3000 VA',
        },
        power_load_watts: {
          type: 'number',
          description: 'กำลังไฟที่ต้องการ (Watts)',
        },
        runtime_minutes: {
          type: 'number',
          description: 'ระยะเวลาสำรองไฟที่ต้องการ (นาที)',
        },
        use_case: {
          type: 'string',
          enum: ['server', 'desktop', 'network', 'data_center', 'home', 'office', 'industrial'],
          description: 'ประเภทการใช้งาน',
        },
        form_factor: {
          type: 'string',
          enum: ['tower', 'rackmount', 'convertible'],
          description: 'รูปแบบ: tower, rackmount, convertible',
        },
        topology: {
          type: 'string',
          enum: ['line-interactive', 'online-double-conversion', 'standby'],
          description: 'เทคโนโลยี UPS',
        },
        phase: {
          type: 'string',
          enum: ['single', 'three'],
          description: 'ระบบไฟ: single (1 เฟส), three (3 เฟส)',
        },
        budget_thb: {
          type: 'number',
          description: 'งบประมาณ (บาท)',
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'คุณสมบัติที่ต้องการ',
        },
        equipment_details: {
          type: 'string',
          description: 'รายละเอียดอุปกรณ์ที่จะต่อ',
        },
      },
      required: [],
    },
  },
];

export type ToolName =
  | 'search_sites'
  | 'search_companies'
  | 'search_employees'
  | 'get_reference_data'
  | 'create_ticket'
  | 'get_ticket_summary'
  | 'search_tickets'
  | 'get_available_employees'
  | 'search_locations'
  | 'get_ticket_summary_by_location'
  | 'suggest_routes'
  | 'web_search'
  | 'get_ticket_details'
  | 'review_ticket_safety'
  | 'recommend_apc_ups';
