/**
 * E2E Test Setup
 * Creates auth users and links them to test employees
 * Uses direct SQL to bypass JWT issues with admin API
 */

const SUPABASE_URL = 'http://localhost:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Test employees with their expected auth emails
const TEST_USERS = [
  { employeeId: '00000000-0000-0000-0000-000000000001', email: 'admin@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000002', email: 'admin2@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000003', email: 'assigner@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000004', email: 'tech1@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000005', email: 'tech2@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000006', email: 'tech3@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000007', email: 'sales1@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000008', email: 'pm1@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000009', email: 'rma1@pdeservice.com' },
  { employeeId: '00000000-0000-0000-0000-000000000010', email: 'stock@pdeservice.com' },
];

/**
 * Setup test auth users by directly inserting into auth.users and auth.identities
 */
async function setupTestUsers(): Promise<void> {
  console.log('Setting up test auth users via SQL...');

  // Use psql to create users directly
  const password = 'test123456';
  const encryptedPassword = '$2a$10$PXqKpYVaZ9Qz5H5Z5Z5Z5.5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z'; // bcrypt hash for 'test123456'

  for (const user of TEST_USERS) {
    const authUserId = crypto.randomUUID();

    try {
      // Create auth user via REST API with service role
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          email: user.email,
          password: password,
          email_confirm: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const createdUserId = data.id;

        // Link auth user to employee
        const linkResponse = await fetch(`${SUPABASE_URL}/rest/v1/main_employees?id=eq.${user.employeeId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            auth_user_id: createdUserId,
          }),
        });

        if (linkResponse.ok) {
          console.log(`  Created and linked user: ${user.email}`);
        } else {
          console.log(`  Created user but failed to link: ${user.email}`);
        }
      } else {
        const error = await response.text();
        if (error.includes('already been registered') || error.includes('duplicate')) {
          // User exists, try to get their ID and link
          const existingResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(user.email)}`, {
            headers: {
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'apikey': SERVICE_ROLE_KEY,
            },
          });

          if (existingResponse.ok) {
            const existingData = await existingResponse.json();
            if (existingData.users && existingData.users.length > 0) {
              const existingUserId = existingData.users[0].id;

              // Link to employee
              await fetch(`${SUPABASE_URL}/rest/v1/main_employees?id=eq.${user.employeeId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  'apikey': SERVICE_ROLE_KEY,
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({
                  auth_user_id: existingUserId,
                }),
              });

              console.log(`  Linked existing user: ${user.email}`);
            }
          }
        } else {
          console.log(`  Failed to create user ${user.email}: ${error}`);
        }
      }
    } catch (err) {
      console.error(`  Error setting up ${user.email}:`, err);
    }
  }

  console.log('Test users setup complete');
}

// Run setup if called directly
if (import.meta.main) {
  await setupTestUsers();
}

export { setupTestUsers };
