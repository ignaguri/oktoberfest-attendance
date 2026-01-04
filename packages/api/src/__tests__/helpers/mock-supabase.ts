import { vi } from "vitest";

import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createMockUser } from "./test-server";

/**
 * Create mock query builder that properly chains methods
 * Each method returns 'this' to support chaining like .eq().eq().order()
 *
 * @param finalResult - Optional result to return when the chain is executed (via await, single, maybeSingle, then)
 */
function createMockQueryBuilder(finalResult?: {
  data: any;
  error: any;
  count?: number;
}) {
  const defaultResult = finalResult || { data: null, error: null };

  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(defaultResult),
    maybeSingle: vi.fn().mockResolvedValue(defaultResult),
  };

  // Make builder thenable so it can be awaited directly
  builder.then = vi.fn((resolve) =>
    Promise.resolve(defaultResult).then(resolve),
  );

  return builder;
}

/**
 * Create a chainable mock builder with specific data to return
 * This is useful for tests that need to control the response data
 *
 * @example
 * vi.mocked(mockSupabase.from).mockReturnValueOnce(
 *   createMockChain({ data: mockGroup, error: null })
 * );
 */
export function createMockChain(finalResult: {
  data: any;
  error: any;
  count?: number;
}) {
  return createMockQueryBuilder(finalResult);
}

/**
 * Create mock Supabase client with common query patterns
 */
export function createMockSupabase(): SupabaseClient<Database> {
  return {
    from: vi.fn().mockImplementation(() => createMockQueryBuilder()),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: createMockUser() },
        error: null,
      }),
    },
  } as any;
}

/**
 * Mock successful Supabase response
 */
export function mockSupabaseSuccess<T>(data: T) {
  return { data, error: null };
}

/**
 * Mock Supabase error response
 */
export function mockSupabaseError(message: string, code?: string) {
  return { data: null, error: { message, code } };
}

/**
 * Mock Supabase "not found" error (PGRST116)
 */
export function mockSupabaseNotFound() {
  return {
    data: null,
    error: { message: "No rows returned", code: "PGRST116" },
  };
}
