/**
 * Model Router / Orchestrator
 * Analyzes user query and routes to appropriate model based on task complexity
 *
 * Models:
 * - gpt-4o-mini: Fast, cheap - simple lookups, greetings, basic queries
 * - gpt-4o: Powerful - complex analysis, multi-step tasks, summaries
 * - o3-mini: Reasoning - planning, calculations, problem-solving (future)
 */

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export type ModelTier = 'mini' | 'standard' | 'reasoning';

export interface ModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

// Model configurations
const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  mini: {
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.3,
  },
  standard: {
    model: 'gpt-4o',
    maxTokens: 8192,
    temperature: 0.5,
  },
  reasoning: {
    model: 'o3-mini', // or o1-mini when available
    maxTokens: 8192,
    temperature: 0.2,
  },
};

// Tone detection patterns
export type ToneType = 'playful' | 'neutral' | 'urgent';

const TONE_PATTERNS = {
  playful: [
    // Thai playful expressions
    /55+|ฮ่า+|555+|หุหุ|เฮ้ย|โอ้โห|ว้าว|ยี้|เย้|จ้า|จ๊ะ|น้า|นะคะ|ครับผม|ค่ะ+|จุ๊บ|^หวัดดี|^ดีจ้า/i,
    // Emoji patterns
    /[😀-😿🎉🎊🤣🥳😎😂🙈🙊🙉🤪😜😝😛👻🤖💪🔥✨⭐️🌟💯🎮🎯🚀]/u,
    // Playful Thai phrases
    /บอกเล่น|ล้อเล่น|หยอก|แซว|เล่น|สนุก|ขำ|ฮา|เกม|ตลก|ซน|น่ารัก|เท่|โคตร|สุดยอด|ดีมาก|เจ๋ง|ปัง|แจ่ม|เริ่ด/i,
    // English playful
    /lol|lmao|haha|hehe|rofl|xd|yay|woo|wow|cool|awesome|nice|fun|joke|play|kidding|teasing/i,
    // Casual greetings with personality
    /^(yo|sup|heya|wassup|ดีจ้า|หวัดดีจ้า|ไงจ้า|ว่าไงจ้า)/i,
    // Questions about AI itself (curious/playful)
    /เป็นใคร|ชื่ออะไร|รู้จัก.?ไหม|ทำอะไรได้|เก่ง.?ไหม|ฉลาด.?ไหม|who are you|what.?s your name/i,
  ],
  urgent: [
    // Thai urgent words
    /ด่วน|เร่ง|ทันที|ตอนนี้|รีบ|ฉุกเฉิน|สำคัญมาก|ปัญหา|แก้ไข|urgent|asap|emergency|critical|now|immediately/i,
  ],
};

// Task classification patterns
const TASK_PATTERNS = {
  simple: [
    /^(สวัสดี|หวัดดี|hello|hi|hey)/i,
    /^(ขอบคุณ|thanks|thank you)/i,
    /^(ใช่|ไม่|ok|yes|no|ได้|ตกลง|ยืนยัน)/i,
    /ค้นหา.{1,20}$/i, // Short search queries
    /หา.{1,15}$/i,
  ],
  complex: [
    /สรุป/i,
    /summary/i,
    /รายงาน/i,
    /report/i,
    /วิเคราะห์/i,
    /analyze/i,
    /ทั้งหมด/i,
    /all/i,
    /รายละเอียด.*ทุก/i,
    /งานวันนี้/i,
    /งานสัปดาห์/i,
    /งานเดือน/i,
  ],
  reasoning: [
    /วางแผน/i,
    /plan/i,
    /เปรียบเทียบ/i,
    /compare/i,
    /คำนวณ/i,
    /calculate/i,
    /ทำไม/i,
    /why/i,
    /อธิบาย.*เหตุผล/i,
  ],
};

/**
 * Classify task complexity based on query patterns
 * Fast heuristic-based classification (no API call)
 */
export function classifyTaskFast(query: string): ModelTier {
  const normalizedQuery = query.trim().toLowerCase();

  // Check for reasoning patterns first (highest priority)
  for (const pattern of TASK_PATTERNS.reasoning) {
    if (pattern.test(normalizedQuery)) {
      return 'reasoning';
    }
  }

  // Check for complex patterns
  for (const pattern of TASK_PATTERNS.complex) {
    if (pattern.test(normalizedQuery)) {
      return 'standard';
    }
  }

  // Check for simple patterns
  for (const pattern of TASK_PATTERNS.simple) {
    if (pattern.test(normalizedQuery)) {
      return 'mini';
    }
  }

  // Default based on query length
  if (normalizedQuery.length < 20) {
    return 'mini';
  } else if (normalizedQuery.length > 100) {
    return 'standard';
  }

  return 'mini'; // Default to mini for cost efficiency
}

/**
 * Detect user's tone from query
 * Returns 'playful' for fun/casual messages, 'urgent' for critical requests, 'neutral' otherwise
 */
export function detectTone(query: string): ToneType {
  const normalizedQuery = query.trim();

  // Check for urgent patterns first (highest priority)
  for (const pattern of TONE_PATTERNS.urgent) {
    if (pattern.test(normalizedQuery)) {
      return 'urgent';
    }
  }

  // Check for playful patterns
  for (const pattern of TONE_PATTERNS.playful) {
    if (pattern.test(normalizedQuery)) {
      return 'playful';
    }
  }

  return 'neutral';
}

/**
 * Classify task using AI (more accurate but slower)
 * Use when fast classification is uncertain
 */
export async function classifyTaskAI(query: string): Promise<ModelTier> {
  if (!OPENAI_API_KEY) {
    return classifyTaskFast(query);
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 20,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `Classify the user's request complexity. Reply with ONLY one word:
- SIMPLE: greetings, yes/no, short lookups, confirmations
- COMPLEX: summaries, reports, multi-item lists, analysis
- REASONING: planning, comparisons, calculations, explanations

Reply with only: SIMPLE, COMPLEX, or REASONING`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
      }),
    });

    if (!response.ok) {
      return classifyTaskFast(query);
    }

    const data = await response.json();
    const classification = data.choices?.[0]?.message?.content?.trim().toUpperCase();

    switch (classification) {
      case 'SIMPLE':
        return 'mini';
      case 'COMPLEX':
        return 'standard';
      case 'REASONING':
        return 'reasoning';
      default:
        return classifyTaskFast(query);
    }
  } catch (error) {
    console.error('[model-router] Classification error:', error);
    return classifyTaskFast(query);
  }
}

/**
 * Get model configuration based on task complexity
 */
export function getModelConfig(tier: ModelTier): ModelConfig {
  // For now, use standard (gpt-4o) for reasoning tasks too
  // until o3-mini is available
  if (tier === 'reasoning') {
    return MODEL_CONFIGS.standard;
  }
  return MODEL_CONFIGS[tier];
}

/**
 * Route query to appropriate model (main entry point)
 * Uses fast classification by default, AI classification for uncertain cases
 */
export function routeQuery(query: string, conversationContext?: string): {
  tier: ModelTier;
  config: ModelConfig;
  reason: string;
} {
  // Check conversation context for complexity hints
  const hasMultipleEntities = conversationContext &&
    (conversationContext.includes('entities') || conversationContext.includes('tickets'));

  // Fast classification
  let tier = classifyTaskFast(query);
  let reason = 'pattern-based';

  // Upgrade to standard if conversation context suggests complexity
  if (tier === 'mini' && hasMultipleEntities) {
    tier = 'standard';
    reason = 'context-upgrade';
  }

  // Force standard for summary-related queries
  if (query.includes('สรุป') || query.includes('งานวันนี้') || query.includes('ทั้งหมด')) {
    tier = 'standard';
    reason = 'summary-task';
  }

  return {
    tier,
    config: getModelConfig(tier),
    reason,
  };
}

/**
 * Log model routing decision for analytics
 */
export function logRouting(
  query: string,
  tier: ModelTier,
  reason: string,
  responseTokens?: number
): void {
  console.log(`[model-router] tier=${tier} reason=${reason} query_len=${query.length} tokens=${responseTokens || 'pending'}`);
}
