/**
 * LINE Webhook Signature Verification
 * Uses HMAC-SHA256 with channel secret to verify webhook authenticity
 */

import { encodeBase64 } from 'https://deno.land/std@0.208.0/encoding/base64.ts';

/**
 * Verify LINE webhook signature
 * @param channelSecret - LINE channel secret
 * @param signature - x-line-signature header value
 * @param body - Raw request body as string
 * @returns true if signature is valid
 */
export async function verifySignature(
  channelSecret: string,
  signature: string,
  body: string
): Promise<boolean> {
  try {
    // Create HMAC-SHA256 key from channel secret
    const encoder = new TextEncoder();
    const keyData = encoder.encode(channelSecret);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the body
    const bodyData = encoder.encode(body);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyData);

    // Convert to base64
    const computedSignature = encodeBase64(signatureBuffer);

    // Compare signatures (timing-safe comparison)
    return timingSafeEqual(signature, computedSignature);
  } catch (error) {
    console.error('[Signature] Verification error:', error);
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Get channel secret from environment
 */
export function getChannelSecret(): string {
  const secret = Deno.env.get('LINE_CHANNEL_SECRET');
  if (!secret) {
    throw new Error('LINE_CHANNEL_SECRET not configured');
  }
  return secret;
}
