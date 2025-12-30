# API Integration Tests

This directory contains integration tests for the ProstCounter API that use the local Supabase database.

## Prerequisites

1. **Local Supabase running**: Make sure Supabase is started
   ```bash
   pnpm sup:start
   ```

2. **Environment variables**: Tests require these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` (default: `http://127.0.0.1:54321`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (get from `supabase status`)
   - `SUPABASE_SERVICE_ROLE_KEY` (get from `supabase status`)

## Running Tests

### Quick Start (Local Development)
For local Supabase with default keys:

```bash
pnpm test  # Runs all tests including integration tests
```

### Integration Tests Only
```bash
pnpm test group.route.integration.test.ts
```

### With Custom Environment
```bash
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
SUPABASE_SERVICE_ROLE_KEY="your-service-key" \
pnpm test
```

## Test Structure

### Unit Tests (`*.test.ts`)
- Use mocked Supabase client
- Fast execution
- Test HTTP layer, validation, auth middleware
- Located in `src/routes/__tests__/*.test.ts`

### Integration Tests (`*.integration.test.ts`)
- Use real local Supabase database
- Test complete flow including RLS, triggers, constraints
- Automatically clean up test data
- Located in `src/routes/__tests__/*.integration.test.ts`

## Test Helpers

### `helpers/test-server.ts`
- `createTestApp()` - Create mock Hono app
- `createMockUser()` - Create mock authenticated user
- `createAuthRequest()` - Create request with auth headers

### `helpers/mock-supabase.ts`
- `createMockSupabase()` - Comprehensive Supabase client mock
- `mockSupabaseSuccess()` - Mock successful responses
- `mockSupabaseError()` - Mock error responses

### `helpers/test-supabase.ts`
- `createTestSupabaseAdmin()` - Admin client (bypasses RLS)
- `createTestSupabaseAnon()` - Anon client (respects RLS)
- `createTestSupabaseWithAuth()` - Authenticated user client

## Writing Integration Tests

```typescript
import { createTestSupabaseAdmin, createTestSupabaseWithAuth } from "../../__tests__/helpers/test-supabase";

describe("My Integration Test", () => {
  let supabaseAdmin: SupabaseClient<Database>;
  let testUser: { id: string; token: string };

  beforeAll(async () => {
    supabaseAdmin = createTestSupabaseAdmin();

    // Create test user
    const { data } = await supabaseAdmin.auth.admin.createUser({
      email: `test-${Date.now()}@test.com`,
      password: "password",
    });
    testUser = { id: data.user.id, token: data.session.access_token };
  });

  afterAll(async () => {
    // Clean up test data
    await supabaseAdmin.auth.admin.deleteUser(testUser.id);
  });

  it("should test something", async () => {
    const userClient = createTestSupabaseWithAuth(testUser.token);
    // Test with real database...
  });
});
```

## Troubleshooting

### "Missing required environment variables"
- Make sure Supabase is running: `pnpm sup:start`
- Set environment variables before running tests
- For local development, the default keys in `.env.example` should work

### Tests fail with RLS errors
- Make sure you're using `supabaseAdmin` (service role) for test setup/teardown
- Use `createTestSupabaseWithAuth()` for operations that should respect RLS

### Database state issues
- Tests should clean up all data in `afterAll` hooks
- Delete in reverse foreign key order: children → parents
- Use `supabaseAdmin` for cleanup to bypass RLS
