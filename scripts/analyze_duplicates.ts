/**
 * Script to analyze and optionally remove duplicate tickets
 * Run with: deno run --allow-env --allow-net analyze_duplicates.ts
 * 
 * Set environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SITE_ID = '1e06d0f1-1b41-4942-918c-cec245a48326';
const TARGET_DATE = '2024-12-04';

interface Ticket {
  id: string;
  details: string | null;
  work_type_id: string;
  assigner_id: string;
  status_id: string;
  created_at: string;
  site_id: string;
  contact_id: string | null;
  appointment_id: string | null;
  work_result_id: string | null;
}

interface DuplicateGroup {
  fingerprint: string;
  tickets: Ticket[];
  keepTicketId: string;
  deleteTicketIds: string[];
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Create a fingerprint for a ticket to identify duplicates
 */
function createTicketFingerprint(ticket: Ticket): string {
  return [
    ticket.site_id,
    ticket.work_type_id,
    ticket.assigner_id,
    ticket.status_id,
    ticket.details || '',
  ].join('|');
}

/**
 * Fetch all tickets for the target site and date
 */
async function fetchTickets(): Promise<Ticket[]> {
  console.log(`\n🔍 Fetching tickets for site ${SITE_ID} on ${TARGET_DATE}...\n`);

  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('site_id', SITE_ID)
    .gte('created_at', `${TARGET_DATE}T00:00:00Z`)
    .lt('created_at', `${TARGET_DATE}T23:59:59Z`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching tickets:', error);
    Deno.exit(1);
  }

  console.log(`✅ Found ${data?.length || 0} total tickets\n`);
  return data || [];
}

/**
 * Group tickets by fingerprint to find duplicates
 */
function findDuplicateGroups(tickets: Ticket[]): DuplicateGroup[] {
  const groups = new Map<string, Ticket[]>();

  // Group tickets by fingerprint
  for (const ticket of tickets) {
    const fingerprint = createTicketFingerprint(ticket);
    if (!groups.has(fingerprint)) {
      groups.set(fingerprint, []);
    }
    groups.get(fingerprint)!.push(ticket);
  }

  // Filter to only groups with duplicates (2+ tickets)
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [fingerprint, groupTickets] of groups) {
    if (groupTickets.length > 1) {
      // Keep the oldest ticket (first created)
      const sorted = groupTickets.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      duplicateGroups.push({
        fingerprint,
        tickets: sorted,
        keepTicketId: sorted[0].id,
        deleteTicketIds: sorted.slice(1).map(t => t.id),
      });
    }
  }

  return duplicateGroups;
}

/**
 * Display duplicate groups in a readable format
 */
function displayDuplicateGroups(groups: DuplicateGroup[]): void {
  if (groups.length === 0) {
    console.log('✅ No duplicate tickets found!\n');
    return;
  }

  console.log(`⚠️  Found ${groups.length} duplicate groups:\n`);

  let totalDuplicates = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const duplicateCount = group.tickets.length - 1;
    totalDuplicates += duplicateCount;

    console.log(`\n📋 Group ${i + 1}: ${group.tickets.length} identical tickets (${duplicateCount} duplicates)`);
    console.log(`   Details: "${group.tickets[0].details || '(empty)'}"`);
    console.log(`   Work Type ID: ${group.tickets[0].work_type_id}`);
    console.log(`   Status ID: ${group.tickets[0].status_id}`);
    console.log('\n   Tickets:');

    for (const ticket of group.tickets) {
      const isKeep = ticket.id === group.keepTicketId;
      const status = isKeep ? '✅ KEEP' : '❌ DELETE';
      const created = new Date(ticket.created_at).toLocaleString();

      console.log(`   ${status}  ${ticket.id}  (created: ${created})`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   - Total duplicate groups: ${groups.length}`);
  console.log(`   - Total tickets in groups: ${groups.reduce((sum, g) => sum + g.tickets.length, 0)}`);
  console.log(`   - Tickets to KEEP: ${groups.length}`);
  console.log(`   - Tickets to DELETE: ${totalDuplicates}`);
  console.log();
}

/**
 * Delete duplicate tickets (with confirmation)
 */
async function deleteDuplicates(groups: DuplicateGroup[], autoConfirm = false): Promise<void> {
  if (groups.length === 0) {
    console.log('No duplicates to delete.\n');
    return;
  }

  const totalToDelete = groups.reduce((sum, g) => sum + g.deleteTicketIds.length, 0);

  if (!autoConfirm) {
    console.log(`\n⚠️  WARNING: This will DELETE ${totalToDelete} duplicate tickets!`);
    console.log('   The oldest ticket in each group will be kept.');
    console.log('\n   To proceed, run with --delete flag:');
    console.log('   deno run --allow-env --allow-net analyze_duplicates.ts --delete\n');
    return;
  }

  console.log(`\n🗑️  Deleting ${totalToDelete} duplicate tickets...\n`);

  let deletedCount = 0;
  let errorCount = 0;

  for (const group of groups) {
    for (const ticketId of group.deleteTicketIds) {
      try {
        // Delete related records first
        await supabase.from('ticket_employees').delete().eq('ticket_id', ticketId);
        await supabase.from('ticket_merchandise').delete().eq('ticket_id', ticketId);
        
        // Delete the ticket
        const { error } = await supabase.from('tickets').delete().eq('id', ticketId);

        if (error) {
          console.error(`   ❌ Error deleting ticket ${ticketId}:`, error.message);
          errorCount++;
        } else {
          console.log(`   ✅ Deleted ticket ${ticketId}`);
          deletedCount++;
        }
      } catch (err) {
        console.error(`   ❌ Exception deleting ticket ${ticketId}:`, err);
        errorCount++;
      }
    }
  }

  console.log(`\n✅ Deletion complete:`);
  console.log(`   - Successfully deleted: ${deletedCount}`);
  console.log(`   - Errors: ${errorCount}`);
  console.log();
}

/**
 * Main function
 */
async function main() {
  const args = Deno.args;
  const shouldDelete = args.includes('--delete');

  console.log('\n🎫 Duplicate Ticket Analyzer');
  console.log('================================\n');
  console.log(`Target Site ID: ${SITE_ID}`);
  console.log(`Target Date: ${TARGET_DATE}`);
  console.log(`Mode: ${shouldDelete ? 'DELETE' : 'ANALYZE ONLY'}`);

  // Fetch tickets
  const tickets = await fetchTickets();

  if (tickets.length === 0) {
    console.log('No tickets found for the specified criteria.\n');
    return;
  }

  // Find duplicates
  const duplicateGroups = findDuplicateGroups(tickets);

  // Display results
  displayDuplicateGroups(duplicateGroups);

  // Delete if requested
  if (shouldDelete) {
    await deleteDuplicates(duplicateGroups, true);
  } else {
    await deleteDuplicates(duplicateGroups, false);
  }
}

// Run
main().catch(console.error);

