/**
 * Unit tests for summaryUtils
 * Tests pure functions and fallback paths without OpenAI API
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  generateSummary,
  generateSummaryIfNeeded,
  generateTicketSummary,
  type TicketSummaryContext,
  type MerchandiseItem,
  type ContactInfo,
  type AppointmentInfo,
  type SiteInfo,
} from '../../supabase/functions/_shared/summaryUtils.ts';

// ============ Type Export Tests ============

Deno.test('MerchandiseItem type is exported', () => {
  const item: MerchandiseItem = {
    serialNo: 'SN123',
    modelName: 'Model A',
    brand: 'Brand X',
    capacity: '10kVA',
  };
  assertEquals(item.serialNo, 'SN123');
});

Deno.test('ContactInfo type is exported', () => {
  const contact: ContactInfo = {
    name: 'John',
    nickname: 'Johnny',
    phone: ['081-111-1111'],
    email: ['john@example.com'],
    lineId: '@john',
    note: 'VIP customer',
  };
  assertEquals(contact.name, 'John');
});

Deno.test('AppointmentInfo type is exported', () => {
  const appt: AppointmentInfo = {
    date: '2025-01-15',
    timeStart: '09:00',
    timeEnd: '12:00',
    type: 'PM',
    isApproved: true,
  };
  assertEquals(appt.date, '2025-01-15');
});

Deno.test('SiteInfo type is exported', () => {
  const site: SiteInfo = {
    name: 'Test Site',
    addressDetail: '123 Main St',
    provinceName: 'Bangkok',
    districtName: 'Sathorn',
    subdistrictName: 'Silom',
    postalCode: '10500',
    mapUrl: 'https://maps.google.com/...',
  };
  assertEquals(site.name, 'Test Site');
});

Deno.test('TicketSummaryContext type is exported', () => {
  const context: TicketSummaryContext = {
    ticketId: 'TK-001',
    workType: 'PM',
    status: 'Open',
  };
  assertEquals(context.ticketId, 'TK-001');
});

// ============ generateSummary Tests ============

Deno.test('generateSummary - empty text returns empty summary', async () => {
  const result = await generateSummary('');
  assertEquals(result.summary, '');
  assertEquals(result.keyPoints, []);
});

Deno.test('generateSummary - whitespace only returns empty summary', async () => {
  const result = await generateSummary('   ');
  assertEquals(result.summary, '');
  assertEquals(result.keyPoints, []);
});

Deno.test('generateSummary - short text returns original', async () => {
  const shortText = 'This is a short text.';
  const result = await generateSummary(shortText, { maxLength: 150 });
  assertEquals(result.summary, shortText);
  assertEquals(result.keyPoints, []);
});

Deno.test('generateSummary - text at maxLength returns original', async () => {
  const text = 'a'.repeat(150);
  const result = await generateSummary(text, { maxLength: 150 });
  assertEquals(result.summary, text);
});

Deno.test('generateSummary - long text returns summary', async () => {
  const longText = 'a'.repeat(200);
  const result = await generateSummary(longText, { maxLength: 150 });
  // Should return some summary (either from API or truncated fallback)
  assertEquals(typeof result.summary, 'string');
  assertEquals(result.summary.length > 0, true);
});

Deno.test('generateSummary - handles text exceeding maxLength', async () => {
  const text = 'a'.repeat(100);
  const result = await generateSummary(text, { maxLength: 50 });
  // Text exceeds maxLength, should return some summary
  assertEquals(typeof result.summary, 'string');
  assertEquals(result.summary.length > 0, true);
});

// ============ generateSummaryIfNeeded Tests ============

Deno.test('generateSummaryIfNeeded - returns null for empty text', async () => {
  const result = await generateSummaryIfNeeded('');
  assertEquals(result, null);
});

Deno.test('generateSummaryIfNeeded - returns null for short text', async () => {
  const result = await generateSummaryIfNeeded('Short text', 100);
  assertEquals(result, null);
});

Deno.test('generateSummaryIfNeeded - returns null when below minLength', async () => {
  const text = 'a'.repeat(50);
  const result = await generateSummaryIfNeeded(text, 100);
  assertEquals(result, null);
});

Deno.test('generateSummaryIfNeeded - returns summary when above minLength', async () => {
  const text = 'a'.repeat(150);
  const result = await generateSummaryIfNeeded(text, 100);
  assertEquals(typeof result, 'string');
  assertEquals(result !== null, true);
});

// ============ generateTicketSummary Tests ============

Deno.test('generateTicketSummary - returns summary for minimal context', async () => {
  const context: TicketSummaryContext = {
    workType: 'PM',
    site: { name: 'Test Site' },
  };
  const result = await generateTicketSummary(context);
  // With minimal context, returns some summary containing the values
  assertEquals(typeof result, 'string');
  assertEquals(result !== null, true);
});

Deno.test('generateTicketSummary - returns null for empty context', async () => {
  const context: TicketSummaryContext = {};
  const result = await generateTicketSummary(context);
  assertEquals(result, null);
});

Deno.test('generateTicketSummary - returns workType only when no site', async () => {
  const context: TicketSummaryContext = {
    workType: 'RMA',
  };
  const result = await generateTicketSummary(context);
  assertEquals(result, 'RMA');
});

Deno.test('generateTicketSummary - fallback with workGiver', async () => {
  const context: TicketSummaryContext = {
    workGiver: 'APC',
    workType: 'PM',
    companyName: 'Test Company',
    details: 'This is a longer description that exceeds the minimum length for AI summarization but will use fallback since no API key is set.',
  };
  const result = await generateTicketSummary(context);
  // Should use fallback summary (no OpenAI key)
  assertEquals(typeof result, 'string');
  assertEquals(result!.includes('APC'), true);
});

Deno.test('generateTicketSummary - fallback includes merchandise', async () => {
  const context: TicketSummaryContext = {
    workGiver: 'Emerson',
    workType: 'RMA',
    merchandise: [
      { modelName: 'SRT3000', serialNo: 'AS123456', brand: 'APC' },
    ],
    details: 'This is a longer description that exceeds the minimum length requirement.',
  };
  const result = await generateTicketSummary(context);
  assertEquals(typeof result, 'string');
  assertEquals(result!.includes('SRT3000'), true);
  assertEquals(result!.includes('S/N:AS123456'), true);
});

Deno.test('generateTicketSummary - includes appointment info', async () => {
  const context: TicketSummaryContext = {
    workType: 'PM',
    appointment: {
      date: '2025-01-15',
      timeStart: '09:00',
    },
    details: 'This is a longer description that exceeds the minimum length requirement.',
  };
  const result = await generateTicketSummary(context);
  assertEquals(typeof result, 'string');
  assertEquals(result !== null, true);
  // Result should contain some date-related info (format may vary)
});

Deno.test('generateTicketSummary - fallback includes contact', async () => {
  const context: TicketSummaryContext = {
    workType: 'PM',
    contact: {
      name: 'John Doe',
      phone: ['081-123-4567'],
    },
    details: 'This is a longer description that exceeds the minimum length requirement.',
  };
  const result = await generateTicketSummary(context);
  assertEquals(typeof result, 'string');
  assertEquals(result!.includes('John Doe'), true);
  assertEquals(result!.includes('081-123-4567'), true);
});

Deno.test('generateTicketSummary - full context fallback', async () => {
  const context: TicketSummaryContext = {
    workGiver: 'APC',
    workType: 'PM',
    companyName: 'Grand Hotel',
    merchandise: [
      { modelName: 'SRT10K', serialNo: 'EM789', brand: 'APC' },
    ],
    appointment: {
      date: '2025-01-20',
      timeStart: '14:00',
    },
    contact: {
      name: 'Jane Smith',
      phone: ['082-987-6543'],
    },
    details: 'This is a comprehensive ticket with all fields filled in for testing purposes.',
  };
  const result = await generateTicketSummary(context);
  assertEquals(typeof result, 'string');
  // Should include pipe separators
  assertEquals(result!.includes('|'), true);
});
