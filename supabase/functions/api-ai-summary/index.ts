/**
 * @fileoverview AI Summary API Edge Function - Text summarization service
 * @module api-ai-summary
 *
 * @description
 * Takes a description and returns a concise summary while preserving key information.
 * Uses OpenAI GPT-4o-mini for cost-efficient summarization.
 *
 * Features:
 * - Configurable max length (default: 200 chars)
 * - Language auto-detection (Thai/English)
 * - Context-aware summarization (ticket, site, company)
 * - Key points extraction
 * - Short text passthrough (no API call if already short)
 *
 * Context Types:
 * - ticket: Emphasizes problem, equipment, location, urgency
 * - site: Emphasizes address, contacts, key info
 * - company: Emphasizes business, size, key info
 * - general: General text summarization
 *
 * @endpoints
 * ## Summary Operations
 * - POST   /   - Summarize text with options
 *
 * @auth All endpoints require JWT authentication
 * @env OPENAI_API_KEY - OpenAI API key for GPT-4o-mini
 */

import { handleCORS } from '../_shared/cors.ts';
import { error, success } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import { ValidationError } from '../_shared/error.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface SummaryRequest {
  description: string;
  maxLength?: number; // Maximum characters for summary (default: 200)
  language?: 'th' | 'en' | 'auto'; // Output language (default: auto-detect)
  context?: string; // Optional context (e.g., "ticket", "site", "company")
}

interface SummaryResponse {
  summary: string;
  originalLength: number;
  summaryLength: number;
  keyPoints?: string[]; // Extracted key points
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return error('Method not allowed', 405);
    }

    // Authenticate request
    await authenticate(req);

    // Validate API key
    if (!OPENAI_API_KEY) {
      console.error('[ai-summary] OPENAI_API_KEY not set');
      return error('AI service not configured', 500);
    }

    // Parse request body
    const body: SummaryRequest = await req.json();
    const {
      description,
      maxLength = 200,
      language = 'auto',
      context = 'general'
    } = body;

    // Validate input
    if (!description || typeof description !== 'string') {
      throw new ValidationError('กรุณาระบุข้อความที่ต้องการสรุป');
    }

    if (description.trim().length === 0) {
      throw new ValidationError('ข้อความไม่สามารถว่างเปล่าได้');
    }

    // If description is already short, return as-is
    if (description.length <= maxLength) {
      return success({
        summary: description.trim(),
        originalLength: description.length,
        summaryLength: description.trim().length,
        keyPoints: [],
      } as SummaryResponse);
    }

    // Build system prompt based on context
    const contextPrompts: Record<string, string> = {
      ticket: 'สรุปรายละเอียดงานบริการ/ตั๋วงาน ให้เน้นข้อมูลสำคัญ: ปัญหา, อุปกรณ์, สถานที่, ความเร่งด่วน',
      site: 'สรุปข้อมูลสถานที่/ลูกค้า ให้เน้น: ที่อยู่, ผู้ติดต่อ, ข้อมูลสำคัญ',
      company: 'สรุปข้อมูลบริษัท ให้เน้น: ธุรกิจ, ขนาด, ข้อมูลสำคัญ',
      general: 'สรุปข้อความให้กระชับ เน้นใจความสำคัญ',
    };

    const contextPrompt = contextPrompts[context] || contextPrompts.general;

    const languageInstruction = language === 'th'
      ? 'ตอบเป็นภาษาไทย'
      : language === 'en'
        ? 'Reply in English'
        : 'ตอบเป็นภาษาเดียวกับข้อความต้นฉบับ';

    const systemPrompt = `คุณคือผู้ช่วยสรุปข้อความ ${contextPrompt}

กฎ:
- ${languageInstruction}
- สรุปให้กระชับ ไม่เกิน ${maxLength} ตัวอักษร
- รักษาข้อมูลสำคัญไว้ครบถ้วน (ชื่อ, ตัวเลข, วันที่, สถานที่)
- ไม่ต้องใส่คำนำหรือคำลงท้าย ให้ผลลัพธ์เป็นข้อความสรุปโดยตรง
- ถ้าข้อความสั้นอยู่แล้ว ให้คืนค่าเดิม

ตอบในรูปแบบ JSON:
{
  "summary": "ข้อความสรุป",
  "keyPoints": ["จุดสำคัญ 1", "จุดสำคัญ 2"]
}`;

    // Call OpenAI API
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use mini for cost efficiency
        max_tokens: 500,
        temperature: 0.3, // Low temperature for consistent output
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: description },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ai-summary] OpenAI API Error:', errorText);
      return error(`AI service error: ${response.status}`, 500);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return error('ไม่สามารถสร้างสรุปได้', 500);
    }

    // Parse AI response
    let aiResult: { summary: string; keyPoints?: string[] };
    try {
      aiResult = JSON.parse(content);
    } catch {
      // If JSON parsing fails, use content as summary directly
      aiResult = { summary: content, keyPoints: [] };
    }

    const result: SummaryResponse = {
      summary: aiResult.summary || content,
      originalLength: description.length,
      summaryLength: (aiResult.summary || content).length,
      keyPoints: aiResult.keyPoints || [],
    };

    console.log(`[ai-summary] Summarized ${result.originalLength} -> ${result.summaryLength} chars`);

    return success(result);

  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
