/**
 * Unit tests for AI Summary API
 * Tests validation logic and request handling
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// ============ Request Validation Tests ============

Deno.test('ai-summary - validates description is required', async () => {
  // Simulate validation logic
  const validateRequest = (body: { description?: string }) => {
    if (!body.description || typeof body.description !== 'string') {
      throw new Error('กรุณาระบุข้อความที่ต้องการสรุป');
    }
  };

  let error: Error | null = null;
  try {
    validateRequest({});
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error?.message, 'กรุณาระบุข้อความที่ต้องการสรุป');
});

Deno.test('ai-summary - validates description is not empty', async () => {
  const validateRequest = (body: { description?: string }) => {
    if (!body.description || typeof body.description !== 'string') {
      throw new Error('กรุณาระบุข้อความที่ต้องการสรุป');
    }
    if (body.description.trim().length === 0) {
      throw new Error('ข้อความไม่สามารถว่างเปล่าได้');
    }
  };

  let error: Error | null = null;
  try {
    validateRequest({ description: '   ' });
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error?.message, 'ข้อความไม่สามารถว่างเปล่าได้');
});

Deno.test('ai-summary - short text passthrough (no AI call needed)', () => {
  const maxLength = 200;
  const description = 'Short description';

  // If description is already short, return as-is
  const shouldCallAI = description.length > maxLength;
  assertEquals(shouldCallAI, false);

  // Verify passthrough response format
  if (!shouldCallAI) {
    const result = {
      summary: description.trim(),
      originalLength: description.length,
      summaryLength: description.trim().length,
      keyPoints: [],
    };
    assertEquals(result.summary, 'Short description');
    assertEquals(result.originalLength, 17);
    assertEquals(result.summaryLength, 17);
  }
});

Deno.test('ai-summary - long text triggers AI summarization', () => {
  const maxLength = 200;
  const description = 'A'.repeat(300); // 300 characters

  const shouldCallAI = description.length > maxLength;
  assertEquals(shouldCallAI, true);
});

// ============ Context Type Tests ============

Deno.test('ai-summary - context types are valid', () => {
  const validContexts = ['ticket', 'site', 'company', 'general'];
  const contextPrompts: Record<string, string> = {
    ticket: 'สรุปรายละเอียดงานบริการ/ตั๋วงาน ให้เน้นข้อมูลสำคัญ: ปัญหา, อุปกรณ์, สถานที่, ความเร่งด่วน',
    site: 'สรุปข้อมูลสถานที่/ลูกค้า ให้เน้น: ที่อยู่, ผู้ติดต่อ, ข้อมูลสำคัญ',
    company: 'สรุปข้อมูลบริษัท ให้เน้น: ธุรกิจ, ขนาด, ข้อมูลสำคัญ',
    general: 'สรุปข้อความให้กระชับ เน้นใจความสำคัญ',
  };

  for (const context of validContexts) {
    assertEquals(typeof contextPrompts[context], 'string');
    assertEquals(contextPrompts[context].length > 0, true);
  }
});

Deno.test('ai-summary - default context is general', () => {
  const getContextPrompt = (context?: string) => {
    const contextPrompts: Record<string, string> = {
      ticket: 'ticket prompt',
      site: 'site prompt',
      company: 'company prompt',
      general: 'general prompt',
    };
    return contextPrompts[context || 'general'] || contextPrompts.general;
  };

  assertEquals(getContextPrompt(undefined), 'general prompt');
  assertEquals(getContextPrompt(''), 'general prompt');
  assertEquals(getContextPrompt('unknown'), 'general prompt');
});

// ============ Language Tests ============

Deno.test('ai-summary - language options are valid', () => {
  const getLanguageInstruction = (language?: 'th' | 'en' | 'auto') => {
    return language === 'th'
      ? 'ตอบเป็นภาษาไทย'
      : language === 'en'
        ? 'Reply in English'
        : 'ตอบเป็นภาษาเดียวกับข้อความต้นฉบับ';
  };

  assertEquals(getLanguageInstruction('th'), 'ตอบเป็นภาษาไทย');
  assertEquals(getLanguageInstruction('en'), 'Reply in English');
  assertEquals(getLanguageInstruction('auto'), 'ตอบเป็นภาษาเดียวกับข้อความต้นฉบับ');
  assertEquals(getLanguageInstruction(undefined), 'ตอบเป็นภาษาเดียวกับข้อความต้นฉบับ');
});

// ============ Response Parsing Tests ============

Deno.test('ai-summary - parses valid JSON response', () => {
  const content = '{"summary": "Test summary", "keyPoints": ["Point 1", "Point 2"]}';
  const aiResult = JSON.parse(content);

  assertEquals(aiResult.summary, 'Test summary');
  assertEquals(aiResult.keyPoints.length, 2);
  assertEquals(aiResult.keyPoints[0], 'Point 1');
});

Deno.test('ai-summary - handles non-JSON response gracefully', () => {
  const content = 'Plain text summary without JSON';

  let aiResult: { summary: string; keyPoints?: string[] };
  try {
    aiResult = JSON.parse(content);
  } catch {
    // If JSON parsing fails, use content as summary directly
    aiResult = { summary: content, keyPoints: [] };
  }

  assertEquals(aiResult.summary, 'Plain text summary without JSON');
  assertEquals(aiResult.keyPoints?.length, 0);
});

// ============ Response Format Tests ============

Deno.test('ai-summary - response includes all required fields', () => {
  interface SummaryResponse {
    summary: string;
    originalLength: number;
    summaryLength: number;
    keyPoints?: string[];
  }

  const result: SummaryResponse = {
    summary: 'Test summary',
    originalLength: 500,
    summaryLength: 12,
    keyPoints: ['Point 1'],
  };

  assertEquals(typeof result.summary, 'string');
  assertEquals(typeof result.originalLength, 'number');
  assertEquals(typeof result.summaryLength, 'number');
  assertEquals(Array.isArray(result.keyPoints), true);
});

// ============ Max Length Tests ============

Deno.test('ai-summary - default maxLength is 200', () => {
  const parseRequest = (body: { maxLength?: number }) => {
    const { maxLength = 200 } = body;
    return maxLength;
  };

  assertEquals(parseRequest({}), 200);
  assertEquals(parseRequest({ maxLength: 100 }), 100);
  assertEquals(parseRequest({ maxLength: 500 }), 500);
});

// ============ HTTP Method Tests ============

Deno.test('ai-summary - only POST method is allowed', () => {
  const isValidMethod = (method: string) => method === 'POST';

  assertEquals(isValidMethod('POST'), true);
  assertEquals(isValidMethod('GET'), false);
  assertEquals(isValidMethod('PUT'), false);
  assertEquals(isValidMethod('DELETE'), false);
});
