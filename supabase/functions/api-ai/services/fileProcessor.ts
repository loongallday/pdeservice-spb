/**
 * File Processor Service
 * Handles file uploads and content extraction for AI context
 * Supports: Images (PNG, JPG, GIF, WebP), PDF, Excel (XLSX, XLS, CSV)
 */

// Supported MIME types
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const PDF_TYPES = ['application/pdf'];
const EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
];

export interface ProcessedFile {
  type: 'image' | 'document' | 'spreadsheet';
  mimeType: string;
  filename: string;
  // For images: base64 data URL for OpenAI Vision
  imageUrl?: string;
  // For documents/spreadsheets: extracted text content
  textContent?: string;
  // Metadata
  metadata?: {
    pages?: number;
    rows?: number;
    columns?: number;
    sheets?: string[];
  };
}

export interface FileAttachment {
  data: string; // Base64 encoded file data
  mimeType: string;
  filename: string;
}

/**
 * Process uploaded files and extract content
 */
export async function processFiles(files: FileAttachment[]): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];

  for (const file of files) {
    try {
      const processed = await processFile(file);
      if (processed) {
        results.push(processed);
      }
    } catch (err) {
      console.error(`[file-processor] Error processing ${file.filename}:`, err);
    }
  }

  return results;
}

/**
 * Process a single file
 */
async function processFile(file: FileAttachment): Promise<ProcessedFile | null> {
  const { data, mimeType, filename } = file;

  // Image files - prepare for OpenAI Vision
  if (IMAGE_TYPES.includes(mimeType)) {
    return {
      type: 'image',
      mimeType,
      filename,
      imageUrl: `data:${mimeType};base64,${data}`,
    };
  }

  // PDF files - extract text
  if (PDF_TYPES.includes(mimeType)) {
    const textContent = await extractPdfText(data);
    return {
      type: 'document',
      mimeType,
      filename,
      textContent,
    };
  }

  // Excel/CSV files - extract as table
  if (EXCEL_TYPES.includes(mimeType)) {
    const result = await extractSpreadsheetContent(data, mimeType, filename);
    return {
      type: 'spreadsheet',
      mimeType,
      filename,
      textContent: result.content,
      metadata: result.metadata,
    };
  }

  // Unsupported file type
  console.warn(`[file-processor] Unsupported file type: ${mimeType}`);
  return null;
}

/**
 * Extract text from PDF using multiple methods
 * Falls back gracefully if extraction fails
 */
async function extractPdfText(base64Data: string): Promise<string> {
  try {
    // Decode base64 to binary
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = decoder.decode(binaryData);

    const textMatches: string[] = [];

    // Method 1: Extract from FlateDecode streams (most common in modern PDFs)
    // This handles uncompressed text streams
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/gi;
    let match;

    while ((match = streamRegex.exec(rawText)) !== null) {
      const streamContent = match[1];

      // Look for text operators: Tj (show string), TJ (show array), ' (next line string)
      // Pattern for simple strings: (text) Tj
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(streamContent)) !== null) {
        const text = decodeTextString(tjMatch[1]);
        if (text && text.length > 1) textMatches.push(text);
      }

      // Pattern for TJ arrays: [(text1) -10 (text2)] TJ
      const tjArrayRegex = /\[([^\]]+)\]\s*TJ/gi;
      while ((tjMatch = tjArrayRegex.exec(streamContent)) !== null) {
        const arrayContent = tjMatch[1];
        const textParts = arrayContent.match(/\(([^)]*)\)/g);
        if (textParts) {
          const text = textParts
            .map(p => decodeTextString(p.slice(1, -1)))
            .join('');
          if (text && text.length > 1) textMatches.push(text);
        }
      }
    }

    // Method 2: Look for Unicode text (BT...ET blocks)
    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/gi;
    while ((match = btEtRegex.exec(rawText)) !== null) {
      const btContent = match[1];
      // Extract hex-encoded Unicode: <FEFF...> Tj
      const hexRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
      let hexMatch;
      while ((hexMatch = hexRegex.exec(btContent)) !== null) {
        const hex = hexMatch[1];
        const text = decodeHexString(hex);
        if (text && text.length > 1) textMatches.push(text);
      }
    }

    // Method 3: Extract literal strings that look like text
    const literalRegex = /\(([^\x00-\x1f()\\]{3,})\)/g;
    while ((match = literalRegex.exec(rawText)) !== null) {
      const text = match[1];
      // Only include if it looks like readable text
      if (text && /[a-zA-Z\u0E00-\u0E7F]{2,}/.test(text)) {
        textMatches.push(text);
      }
    }

    // Deduplicate and clean
    const uniqueTexts = [...new Set(textMatches)]
      .map(t => t.trim())
      .filter(t => t.length > 2);

    if (uniqueTexts.length > 0) {
      const result = uniqueTexts.join(' ').trim();
      console.log(`[file-processor] PDF extracted ${result.length} chars from ${uniqueTexts.length} segments`);
      return result.slice(0, 15000);
    }

    // Fallback: extract any readable sequences
    const readableChunks: string[] = [];
    const readableRegex = /[\w\u0E00-\u0E7F\s.,!?:;\-()]{10,}/g;
    while ((match = readableRegex.exec(rawText)) !== null) {
      if (!/^\s+$/.test(match[0])) {
        readableChunks.push(match[0].trim());
      }
    }

    if (readableChunks.length > 0) {
      return readableChunks.slice(0, 100).join(' ').slice(0, 10000);
    }

    return 'ไม่สามารถอ่านเนื้อหา PDF ได้ - ไฟล์อาจถูกเข้ารหัสหรือเป็นรูปภาพ กรุณาส่งเป็นไฟล์รูปภาพ (screenshot) แทน';
  } catch (err) {
    console.error('[file-processor] PDF extraction error:', err);
    return 'เกิดข้อผิดพลาดในการอ่าน PDF - กรุณาลองส่งเป็นไฟล์รูปภาพแทน';
  }
}

/**
 * Decode PDF text string (handle escape sequences)
 */
function decodeTextString(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Decode hex string (UTF-16BE format common in PDFs)
 */
function decodeHexString(hex: string): string {
  // Handle UTF-16BE (starts with FEFF)
  if (hex.startsWith('FEFF') || hex.startsWith('feff')) {
    hex = hex.slice(4);
    let result = '';
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (code) result += String.fromCharCode(code);
    }
    return result;
  }

  // Simple hex to ASCII
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code >= 32 && code < 127) result += String.fromCharCode(code);
  }
  return result;
}

/**
 * Extract content from spreadsheet (Excel/CSV)
 */
async function extractSpreadsheetContent(
  base64Data: string,
  mimeType: string,
  filename: string
): Promise<{ content: string; metadata: { rows: number; columns: number; sheets?: string[] } }> {
  try {
    // Decode base64
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // CSV files - simple parsing
    if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
      const decoder = new TextDecoder('utf-8');
      const csvText = decoder.decode(binaryData);
      const lines = csvText.split('\n').filter(line => line.trim());

      // Parse CSV
      const rows = lines.map(line => parseCSVLine(line));
      const content = formatAsTable(rows);

      return {
        content: content.slice(0, 10000),
        metadata: {
          rows: rows.length,
          columns: rows[0]?.length || 0,
        },
      };
    }

    // Excel files (XLSX) - extract from XML
    if (mimeType.includes('spreadsheet') || filename.endsWith('.xlsx')) {
      // XLSX is a ZIP file containing XML
      // For simplicity, we'll try to extract shared strings and sheet data
      const content = await extractXlsxContent(binaryData);
      return content;
    }

    // Old Excel format (XLS) - limited support
    if (filename.endsWith('.xls')) {
      return {
        content: 'ไฟล์ XLS รุ่นเก่า กรุณาแปลงเป็น XLSX หรือ CSV',
        metadata: { rows: 0, columns: 0 },
      };
    }

    return {
      content: 'ไม่รองรับรูปแบบไฟล์นี้',
      metadata: { rows: 0, columns: 0 },
    };
  } catch (err) {
    console.error('[file-processor] Spreadsheet extraction error:', err);
    return {
      content: 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel',
      metadata: { rows: 0, columns: 0 },
    };
  }
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Format rows as a readable table
 */
function formatAsTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  // Limit columns and rows for context
  const maxCols = 10;
  const maxRows = 50;

  const limitedRows = rows.slice(0, maxRows).map(row => row.slice(0, maxCols));

  // Create markdown-like table
  const lines: string[] = [];

  // Header
  if (limitedRows.length > 0) {
    lines.push('| ' + limitedRows[0].join(' | ') + ' |');
    lines.push('| ' + limitedRows[0].map(() => '---').join(' | ') + ' |');
  }

  // Data rows
  for (let i = 1; i < limitedRows.length; i++) {
    lines.push('| ' + limitedRows[i].join(' | ') + ' |');
  }

  if (rows.length > maxRows) {
    lines.push(`\n... และอีก ${rows.length - maxRows} แถว`);
  }

  return lines.join('\n');
}

/**
 * Extract content from XLSX file
 * XLSX is a ZIP archive containing XML files
 */
async function extractXlsxContent(
  binaryData: Uint8Array
): Promise<{ content: string; metadata: { rows: number; columns: number; sheets: string[] } }> {
  try {
    // Import fflate for ZIP decompression
    const fflate = await import('https://esm.sh/fflate@0.8.2');

    // Decompress the XLSX (ZIP) file
    const unzipped = fflate.unzipSync(binaryData);

    // Extract shared strings (xl/sharedStrings.xml)
    const sharedStrings: string[] = [];
    const sharedStringsFile = unzipped['xl/sharedStrings.xml'];
    if (sharedStringsFile) {
      const decoder = new TextDecoder('utf-8');
      const ssXml = decoder.decode(sharedStringsFile);
      // Extract text from <t> tags
      const tRegex = /<t[^>]*>([^<]*)<\/t>/g;
      let match;
      while ((match = tRegex.exec(ssXml)) !== null) {
        if (match[1]) sharedStrings.push(decodeXmlEntities(match[1]));
      }
    }

    // Extract sheet names from workbook.xml
    const sheets: string[] = [];
    const workbookFile = unzipped['xl/workbook.xml'];
    if (workbookFile) {
      const decoder = new TextDecoder('utf-8');
      const wbXml = decoder.decode(workbookFile);
      const sheetRegex = /<sheet[^>]*name="([^"]+)"/g;
      let match;
      while ((match = sheetRegex.exec(wbXml)) !== null) {
        sheets.push(decodeXmlEntities(match[1]));
      }
    }

    // Extract data from first sheet (xl/worksheets/sheet1.xml)
    const rows: string[][] = [];
    const sheet1File = unzipped['xl/worksheets/sheet1.xml'];
    if (sheet1File) {
      const decoder = new TextDecoder('utf-8');
      const sheetXml = decoder.decode(sheet1File);

      // Parse rows: <row>...<c>...<v>value</v></c>...</row>
      const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
        const rowContent = rowMatch[1];
        const rowData: string[] = [];

        // Parse cells in this row
        const cellRegex = /<c[^>]*(?:t="([^"]*)")?[^>]*>(?:[\s\S]*?<v>([^<]*)<\/v>)?[\s\S]*?<\/c>/g;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          const cellType = cellMatch[1];
          const cellValue = cellMatch[2] || '';

          // If type is 's', it's a shared string reference
          if (cellType === 's') {
            const ssIndex = parseInt(cellValue);
            rowData.push(sharedStrings[ssIndex] || cellValue);
          } else {
            rowData.push(cellValue);
          }
        }

        if (rowData.length > 0) {
          rows.push(rowData);
        }
      }
    }

    // Format output
    if (rows.length > 0) {
      const content = formatAsTable(rows);
      console.log(`[file-processor] XLSX extracted ${rows.length} rows, ${rows[0]?.length || 0} columns`);
      return {
        content: (sheets.length > 0 ? `ชีท: ${sheets.join(', ')}\n\n` : '') + content,
        metadata: {
          rows: rows.length,
          columns: rows[0]?.length || 0,
          sheets,
        },
      };
    }

    // Fallback: just return shared strings if no structured data
    if (sharedStrings.length > 0) {
      console.log(`[file-processor] XLSX extracted ${sharedStrings.length} strings (no structure)`);
      return {
        content: (sheets.length > 0 ? `ชีท: ${sheets.join(', ')}\n\n` : '') +
          'ข้อมูลในไฟล์:\n' + sharedStrings.slice(0, 300).join('\n'),
        metadata: {
          rows: sharedStrings.length,
          columns: 1,
          sheets,
        },
      };
    }

    return {
      content: 'ไม่พบข้อมูลในไฟล์ Excel',
      metadata: { rows: 0, columns: 0, sheets },
    };
  } catch (err) {
    console.error('[file-processor] XLSX extraction error:', err);

    // Fallback: try simple regex on raw data (won't work for compressed)
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawContent = decoder.decode(binaryData);

    const sharedStrings: string[] = [];
    const ssRegex = /<t[^>]*>([^<]+)<\/t>/g;
    let match;
    while ((match = ssRegex.exec(rawContent)) !== null) {
      sharedStrings.push(match[1]);
    }

    if (sharedStrings.length > 0) {
      return {
        content: 'ข้อมูลในไฟล์:\n' + sharedStrings.slice(0, 200).join('\n'),
        metadata: { rows: sharedStrings.length, columns: 1, sheets: [] },
      };
    }

    return {
      content: 'ไม่สามารถอ่านไฟล์ Excel - กรุณาบันทึกเป็น CSV และลองใหม่',
      metadata: { rows: 0, columns: 0, sheets: [] },
    };
  }
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Build message content array for OpenAI with file attachments
 * NOTE: OpenAI requires text content FIRST, then images
 */
export function buildMessageContent(
  textQuery: string,
  processedFiles: ProcessedFile[]
): Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> {
  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [];

  // Build text content with document/spreadsheet extractions
  let fullText = textQuery;

  for (const file of processedFiles) {
    if (file.type === 'document' && file.textContent) {
      fullText += `\n\n📄 ไฟล์ PDF "${file.filename}":\n${file.textContent}`;
    }
    if (file.type === 'spreadsheet' && file.textContent) {
      const meta = file.metadata;
      fullText += `\n\n📊 ไฟล์ Excel "${file.filename}" (${meta?.rows || 0} แถว, ${meta?.columns || 0} คอลัมน์):\n${file.textContent}`;
    }
  }

  // Text MUST come first for OpenAI API
  content.push({ type: 'text', text: fullText });

  // Add images after text (for vision)
  for (const file of processedFiles) {
    if (file.type === 'image' && file.imageUrl) {
      content.push({
        type: 'image_url',
        image_url: {
          url: file.imageUrl,
          detail: 'auto', // Let OpenAI decide resolution
        },
      });
    }
  }

  return content;
}

/**
 * Get supported file types description
 */
export function getSupportedFileTypes(): string {
  return 'รูปภาพ (PNG, JPG, GIF, WebP), PDF, Excel (XLSX, CSV)';
}
