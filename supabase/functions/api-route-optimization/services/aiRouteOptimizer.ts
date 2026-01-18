/**
 * AI-Powered Route Optimizer
 * Uses OpenAI with tool calling to intelligently optimize routes
 * and suggest appointment time changes to customers
 */

import type { TicketWaypoint, LatLng, TimeSuggestion } from '../types.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_TOOL_ITERATIONS = 5;

interface RouteStop {
  index: number;
  ticketId: string;
  ticketCode: string | null;
  siteName: string;
  lat: number;
  lng: number;
  appointmentTime: string | null;
  workDuration: number;
}

export interface OptimizedRoute {
  order: number[];
  reasoning: string;
  suggestions: TimeSuggestion[];
  totalDistance: number;
  estimatedDuration: number;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// Tools available to AI for route optimization
const ROUTE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculate_distance',
      description: 'Calculate distance and estimated travel time between two locations',
      parameters: {
        type: 'object',
        properties: {
          from_index: { type: 'number', description: 'Index of origin stop (use -1 for garage)' },
          to_index: { type: 'number', description: 'Index of destination stop' },
        },
        required: ['from_index', 'to_index'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_time_feasibility',
      description: 'Check if visiting a stop at a given time is feasible for its appointment window',
      parameters: {
        type: 'object',
        properties: {
          stop_index: { type: 'number', description: 'Index of the stop to check' },
          arrival_time: { type: 'string', description: 'Proposed arrival time (HH:MM)' },
        },
        required: ['stop_index', 'arrival_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulate_route',
      description: 'Simulate a route with given order and return total time and any violations',
      parameters: {
        type: 'object',
        properties: {
          order: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of stop indices in proposed order',
          },
          start_time: { type: 'string', description: 'Route start time (HH:MM)' },
        },
        required: ['order', 'start_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_time_change',
      description: 'Suggest a new appointment time for a customer to improve route efficiency',
      parameters: {
        type: 'object',
        properties: {
          stop_index: { type: 'number', description: 'Index of the stop' },
          suggested_time: { type: 'string', description: 'Suggested new appointment time (HH:MM)' },
          reason: { type: 'string', description: 'Reason for the suggestion in Thai' },
          savings_minutes: { type: 'number', description: 'Estimated time savings in minutes' },
        },
        required: ['stop_index', 'suggested_time', 'reason', 'savings_minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finalize_route',
      description: 'Finalize the optimized route with the best order found',
      parameters: {
        type: 'object',
        properties: {
          order: {
            type: 'array',
            items: { type: 'number' },
            description: 'Final optimized order of stop indices',
          },
          reasoning: { type: 'string', description: 'Explanation of the optimization in Thai' },
        },
        required: ['order', 'reasoning'],
      },
    },
  },
];

/**
 * Haversine distance between two points (km)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse time string to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convert minutes to time string
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Execute a tool call from the AI
 */
function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  stops: RouteStop[],
  origin: LatLng,
  timeSuggestions: TimeSuggestion[]
): { result: unknown; done?: boolean; finalOrder?: number[]; reasoning?: string } {
  const AVG_SPEED = 30; // km/h

  switch (toolName) {
    case 'calculate_distance': {
      const fromIdx = args.from_index as number;
      const toIdx = args.to_index as number;

      const fromLat = fromIdx === -1 ? origin.latitude : stops[fromIdx]?.lat ?? 0;
      const fromLng = fromIdx === -1 ? origin.longitude : stops[fromIdx]?.lng ?? 0;
      const toLat = stops[toIdx]?.lat ?? 0;
      const toLng = stops[toIdx]?.lng ?? 0;

      const distanceKm = haversineDistance(fromLat, fromLng, toLat, toLng);
      const travelMinutes = Math.round((distanceKm / AVG_SPEED) * 60);

      return {
        result: {
          distance_km: Math.round(distanceKm * 10) / 10,
          travel_minutes: travelMinutes,
          from: fromIdx === -1 ? 'garage' : stops[fromIdx]?.siteName,
          to: stops[toIdx]?.siteName,
        },
      };
    }

    case 'check_time_feasibility': {
      const stopIdx = args.stop_index as number;
      const arrivalTime = args.arrival_time as string;
      const stop = stops[stopIdx];

      if (!stop) {
        return { result: { error: 'Invalid stop index' } };
      }

      const arrivalMinutes = timeToMinutes(arrivalTime);
      const appointmentMinutes = stop.appointmentTime ? timeToMinutes(stop.appointmentTime) : null;

      let status: 'on_time' | 'early' | 'late' | 'no_appointment' = 'no_appointment';
      let waitMinutes = 0;
      let lateMinutes = 0;

      if (appointmentMinutes !== null) {
        if (arrivalMinutes < appointmentMinutes) {
          status = 'early';
          waitMinutes = appointmentMinutes - arrivalMinutes;
        } else if (arrivalMinutes <= appointmentMinutes + 15) {
          status = 'on_time';
        } else {
          status = 'late';
          lateMinutes = arrivalMinutes - appointmentMinutes;
        }
      }

      return {
        result: {
          stop: stop.siteName,
          appointment_time: stop.appointmentTime || 'ไม่ระบุ',
          arrival_time: arrivalTime,
          status,
          wait_minutes: waitMinutes,
          late_minutes: lateMinutes,
          feasible: status !== 'late',
        },
      };
    }

    case 'simulate_route': {
      const order = args.order as number[];
      const startTime = args.start_time as string;

      let currentMinutes = timeToMinutes(startTime);
      let totalTravelMinutes = 0;
      let totalWorkMinutes = 0;
      let totalWaitMinutes = 0;
      const violations: string[] = [];

      let prevLat = origin.latitude;
      let prevLng = origin.longitude;

      for (let i = 0; i < order.length; i++) {
        const stop = stops[order[i]];
        if (!stop) continue;

        // Travel to stop
        const distanceKm = haversineDistance(prevLat, prevLng, stop.lat, stop.lng);
        const travelMinutes = Math.round((distanceKm / AVG_SPEED) * 60);
        currentMinutes += travelMinutes;
        totalTravelMinutes += travelMinutes;

        // Check appointment
        if (stop.appointmentTime) {
          const appointmentMinutes = timeToMinutes(stop.appointmentTime);
          if (currentMinutes < appointmentMinutes) {
            totalWaitMinutes += appointmentMinutes - currentMinutes;
            currentMinutes = appointmentMinutes;
          } else if (currentMinutes > appointmentMinutes + 15) {
            violations.push(`${stop.siteName}: สาย ${currentMinutes - appointmentMinutes} นาที`);
          }
        }

        // Work at stop
        currentMinutes += stop.workDuration;
        totalWorkMinutes += stop.workDuration;

        prevLat = stop.lat;
        prevLng = stop.lng;
      }

      return {
        result: {
          total_travel_minutes: totalTravelMinutes,
          total_work_minutes: totalWorkMinutes,
          total_wait_minutes: totalWaitMinutes,
          total_minutes: currentMinutes - timeToMinutes(startTime),
          end_time: minutesToTime(currentMinutes),
          violations,
          feasible: violations.length === 0,
        },
      };
    }

    case 'suggest_time_change': {
      const stopIdx = args.stop_index as number;
      const suggestedTime = args.suggested_time as string;
      const reason = args.reason as string;
      const savingsMinutes = args.savings_minutes as number;
      const stop = stops[stopIdx];

      if (stop && stop.appointmentTime) {
        timeSuggestions.push({
          ticket_id: stop.ticketId,
          ticket_code: stop.ticketCode,
          site_name: stop.siteName,
          current_time: stop.appointmentTime,
          suggested_time: suggestedTime,
          reason,
          savings_minutes: savingsMinutes,
        });
        return { result: { success: true, message: 'Time suggestion recorded' } };
      }
      return { result: { error: 'Invalid stop or no appointment time' } };
    }

    case 'finalize_route': {
      const order = args.order as number[];
      const reasoning = args.reasoning as string;
      return {
        result: { success: true },
        done: true,
        finalOrder: order,
        reasoning,
      };
    }

    default:
      return { result: { error: `Unknown tool: ${toolName}` } };
  }
}

/**
 * AI-powered route optimization
 */
export async function optimizeRouteWithAI(
  tickets: TicketWaypoint[],
  origin: LatLng,
  startTime: string
): Promise<OptimizedRoute> {
  // Check if OpenAI is configured
  if (!OPENAI_API_KEY) {
    console.log('[ai-route] OpenAI not configured, falling back to basic optimization');
    return fallbackOptimization(tickets, origin, startTime);
  }

  // Prepare stops data for AI
  const stops: RouteStop[] = tickets.map((t, i) => ({
    index: i,
    ticketId: t.ticket_id,
    ticketCode: t.ticket_code,
    siteName: t.site_name,
    lat: t.latitude,
    lng: t.longitude,
    appointmentTime: t.appointment?.time_start ? normalizeTime(t.appointment.time_start) : null,
    workDuration: t.work_duration_minutes || 0,
  }));

  // Build prompt for AI
  const stopsDescription = stops.map((s, i) =>
    `${i}. ${s.siteName} | นัด: ${s.appointmentTime || 'ไม่ระบุ'} | งาน: ${s.workDuration} นาที | พิกัด: (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`
  ).join('\n');

  const systemPrompt = `คุณคือ AI ผู้เชี่ยวชาญด้านการวางแผนเส้นทางสำหรับช่างซ่อม UPS คุณต้อง:

1. วิเคราะห์ตำแหน่งและเวลานัดของทุกจุด
2. หาลำดับการเข้างานที่ดีที่สุด โดยคำนึงถึง:
   - ระยะทาง (ลดการเดินทางย้อนกลับ)
   - เวลานัดหมาย (ต้องไม่สาย)
   - เวลาทำงาน
3. ถ้าพบว่าเวลานัดหมายทำให้เส้นทางไม่ดี ให้เสนอเวลาใหม่ที่ควรติดต่อลูกค้าเพื่อขอเลื่อน

ใช้ tools ที่มีให้เพื่อ:
- calculate_distance: คำนวณระยะทางระหว่างจุด
- check_time_feasibility: ตรวจสอบว่าถึงทันนัดหรือไม่
- simulate_route: จำลองเส้นทางทั้งหมด
- suggest_time_change: เสนอเวลานัดใหม่ (ถ้าจำเป็น)
- finalize_route: ยืนยันลำดับสุดท้าย

ให้วิเคราะห์อย่างละเอียดและหาทางที่ดีที่สุด`;

  const userPrompt = `จุดเริ่มต้น (โรงรถ): พิกัด (${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)})
เวลาเริ่มงาน: ${startTime}

รายการจุดที่ต้องไป (${stops.length} จุด):
${stopsDescription}

กรุณาวิเคราะห์และหาลำดับการเข้างานที่ดีที่สุด ถ้าพบว่าเวลานัดบางจุดทำให้ต้องวนรถ ให้เสนอเวลาใหม่ที่ควรติดต่อลูกค้า`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const timeSuggestions: TimeSuggestion[] = [];
  let finalOrder: number[] | null = null;
  let reasoning = '';

  // AI conversation loop
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          tools: ROUTE_TOOLS,
          tool_choice: 'auto',
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        console.error('[ai-route] OpenAI error:', response.status);
        break;
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) break;

      const assistantMessage = choice.message;
      messages.push(assistantMessage);

      // Check for tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[ai-route] Calling tool: ${toolName}`, toolArgs);

          const { result, done, finalOrder: order, reasoning: r } = executeTool(
            toolName,
            toolArgs,
            stops,
            origin,
            timeSuggestions
          );

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });

          if (done && order) {
            finalOrder = order;
            reasoning = r || '';
          }
        }

        if (finalOrder) break;
      } else {
        // No tool calls, AI finished
        break;
      }
    } catch (err) {
      console.error('[ai-route] Error in AI loop:', err);
      break;
    }
  }

  // If AI didn't produce a result, fall back
  if (!finalOrder) {
    console.log('[ai-route] AI did not produce final order, using fallback');
    return fallbackOptimization(tickets, origin, startTime);
  }

  // Calculate total distance for the final route
  let totalDistance = 0;
  let prevLat = origin.latitude;
  let prevLng = origin.longitude;
  for (const idx of finalOrder) {
    const stop = stops[idx];
    if (stop) {
      totalDistance += haversineDistance(prevLat, prevLng, stop.lat, stop.lng);
      prevLat = stop.lat;
      prevLng = stop.lng;
    }
  }

  return {
    order: finalOrder,
    reasoning,
    suggestions: timeSuggestions,
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedDuration: 0, // Will be calculated by caller
  };
}

/**
 * Fallback optimization when AI is not available
 */
function fallbackOptimization(
  tickets: TicketWaypoint[],
  origin: LatLng,
  startTime: string
): OptimizedRoute {
  // Validate origin
  if (!origin || origin.latitude == null || origin.longitude == null) {
    console.error('[ai-route] Invalid origin in fallback');
    return {
      order: tickets.map((_, i) => i),
      reasoning: 'ไม่สามารถคำนวณเส้นทางได้ (พิกัดจุดเริ่มต้นไม่ถูกต้อง)',
      suggestions: [],
      totalDistance: 0,
      estimatedDuration: 0,
    };
  }

  // Filter tickets with valid coordinates
  const validTicketIndices = tickets
    .map((t, i) => ({ ticket: t, index: i }))
    .filter(({ ticket }) => ticket && ticket.latitude != null && ticket.longitude != null)
    .map(({ index }) => index);

  if (validTicketIndices.length === 0) {
    return {
      order: [],
      reasoning: 'ไม่มีงานที่มีพิกัดถูกต้อง',
      suggestions: [],
      totalDistance: 0,
      estimatedDuration: 0,
    };
  }

  // Simple greedy nearest neighbor with time windows
  const remaining = new Set(validTicketIndices);
  const order: number[] = [];

  let currentLat = origin.latitude;
  let currentLng = origin.longitude;
  let currentMinutes = timeToMinutes(startTime);

  while (remaining.size > 0) {
    let bestIdx = -1;
    let bestScore = Infinity;

    for (const i of remaining) {
      const ticket = tickets[i];
      if (!ticket || ticket.latitude == null || ticket.longitude == null) continue;
      const distance = haversineDistance(currentLat, currentLng, ticket.latitude, ticket.longitude);
      const travelMinutes = Math.round((distance / 30) * 60);
      const arrivalMinutes = currentMinutes + travelMinutes;

      // Score: prefer nearby + on-time arrivals
      let score = distance;
      if (ticket.appointment?.time_start) {
        const appointmentMinutes = timeToMinutes(normalizeTime(ticket.appointment.time_start));
        if (arrivalMinutes > appointmentMinutes + 15) {
          score += 100; // Penalty for being late
        }
      }

      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;

    order.push(bestIdx);
    remaining.delete(bestIdx);

    const ticket = tickets[bestIdx];
    if (ticket && ticket.latitude != null && ticket.longitude != null) {
      const distance = haversineDistance(currentLat, currentLng, ticket.latitude, ticket.longitude);
      currentMinutes += Math.round((distance / 30) * 60) + (ticket.work_duration_minutes || 0);
      currentLat = ticket.latitude;
      currentLng = ticket.longitude;
    }
  }

  return {
    order,
    reasoning: 'ใช้วิธี Greedy Nearest Neighbor (AI ไม่พร้อมใช้งาน)',
    suggestions: [],
    totalDistance: 0,
    estimatedDuration: 0,
  };
}

/**
 * Normalize time string to HH:MM
 */
function normalizeTime(time: string): string {
  if (!time) return '00:00';
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return time;
}
