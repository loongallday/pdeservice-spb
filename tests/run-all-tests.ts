/**
 * Test runner script to run all unit tests
 * 
 * Usage: deno run --allow-all tests/run-all-tests.ts
 */

const testFiles = [
  'tests/api-appointments/handlers.test.ts',
  'tests/api-initialize/handlers.test.ts',
  'tests/api-employees/handlers.test.ts',
  'tests/api-features/handlers.test.ts',
  'tests/api-companies/handlers.test.ts',
  'tests/api-tickets/handlers.test.ts',
  'tests/api-sites/handlers.test.ts',
  'tests/api-contacts/handlers.test.ts',
  'tests/api-departments/handlers.test.ts',
  'tests/api-roles/handlers.test.ts',
  'tests/api-leave-requests/handlers.test.ts',
  'tests/api-polls/handlers.test.ts',
  'tests/api-reference-data/handlers.test.ts',
  'tests/api-work-results/handlers.test.ts',
  'tests/api-merchandise/handlers.test.ts',
  'tests/api-models/handlers.test.ts',
  'tests/api-pmlog/handlers.test.ts',
  'tests/api-pm-summary/handlers.test.ts',
];

console.log('Running all unit tests...\n');

for (const testFile of testFiles) {
  console.log(`Running: ${testFile}`);
  const command = new Deno.Command(Deno.execPath(), {
    args: ['test', '--allow-all', testFile],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await command.output();
  
  if (code === 0) {
    console.log(`✅ ${testFile} passed\n`);
  } else {
    console.error(`❌ ${testFile} failed\n`);
    console.error(new TextDecoder().decode(stderr));
  }
}

console.log('All tests completed!');

