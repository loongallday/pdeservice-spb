/**
 * @fileoverview LINE Webhook Edge Function - LINE platform event handler
 * @module api-line-webhook
 *
 * @description
 * Receives webhook events from LINE Platform and processes them asynchronously.
 * Supports message, postback, follow, and unfollow events.
 *
 * Event Types:
 * - message: Text/image/sticker messages from users
 * - postback: Button clicks with postback data
 * - follow: User follows the official account
 * - unfollow: User unfollows the official account
 *
 * Processing Flow:
 * 1. Verify x-line-signature header with channel secret
 * 2. Parse webhook body as JSON
 * 3. Respond immediately with 200 OK (LINE expects quick response)
 * 4. Process events asynchronously in background
 *
 * @endpoints
 * ## Webhook Receiver
 * - POST   /   - Receive LINE webhook events (no auth, signature verified)
 *
 * @auth LINE signature verification (x-line-signature header)
 * @env LINE_CHANNEL_SECRET - For webhook signature verification
 * @env LINE_CHANNEL_ACCESS_TOKEN - For calling LINE Messaging API
 * @table child_employee_line_accounts - LINE user to employee mapping
 * @table main_staged_files - Staged file uploads from LINE
 */

import { handleCORS } from '../_shared/cors.ts';
import { verifySignature, getChannelSecret } from './utils/signature.ts';
import { handleMessage } from './handlers/messageHandler.ts';
import { handlePostback } from './handlers/postbackHandler.ts';
import { handleFollow, handleUnfollow } from './handlers/followHandler.ts';
import type { LineWebhookBody, LineMessageEvent, LinePostbackEvent, LineFollowEvent } from './types.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify signature
    const signature = req.headers.get('x-line-signature');
    if (!signature) {
      console.error('[Webhook] Missing x-line-signature header');
      return new Response('Missing signature', { status: 401 });
    }

    const channelSecret = getChannelSecret();
    const isValid = await verifySignature(channelSecret, signature, rawBody);

    if (!isValid) {
      console.error('[Webhook] Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // Parse body
    const body = JSON.parse(rawBody) as LineWebhookBody;

    // Log event details including user ID
    for (const event of body.events) {
      console.log(`[Webhook] Event: type=${event.type}, userId=${event.source.userId}`);
    }

    // Process events (don't wait - respond immediately to LINE)
    processEvents(body.events).catch(err => {
      console.error('[Webhook] Error processing events:', err);
    });

    // Respond immediately with 200 OK
    // LINE expects a quick response
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response('Internal error', { status: 500 });
  }
});

/**
 * Process webhook events asynchronously
 */
async function processEvents(events: LineWebhookBody['events']): Promise<void> {
  for (const event of events) {
    try {
      // Skip redelivered events
      if (event.deliveryContext?.isRedelivery) {
        console.log(`[Webhook] Skipping redelivered event: ${event.webhookEventId}`);
        continue;
      }

      switch (event.type) {
        case 'message':
          await handleMessage(event as LineMessageEvent);
          break;

        case 'postback':
          await handlePostback(event as LinePostbackEvent);
          break;

        case 'follow':
          await handleFollow(event as LineFollowEvent);
          break;

        case 'unfollow':
          if (event.source.userId) {
            await handleUnfollow(event.source.userId);
          }
          break;

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`[Webhook] Error handling ${event.type} event:`, error);
    }
  }
}
