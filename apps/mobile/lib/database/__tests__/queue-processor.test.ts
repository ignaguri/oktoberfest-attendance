/**
 * Queue Processor Tests
 *
 * Tests for the QueueProcessor class.
 * Run with: pnpm test --filter=@prostcounter/mobile
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import type { SyncQueueItem } from "../schema";

import {
  QueueProcessor,
  createQueueProcessor,
  sleep,
  withRetry,
} from "../queue-processor";

// Mock the sync-queue module
vi.mock("../sync-queue", () => ({
  getPendingOperations: vi.fn().mockResolvedValue([]),
  markOperationProcessing: vi.fn().mockResolvedValue(undefined),
  markOperationCompleted: vi.fn().mockResolvedValue(undefined),
  markOperationFailed: vi.fn().mockResolvedValue(undefined),
  markRecordClean: vi.fn().mockResolvedValue(undefined),
  getQueueStats: vi.fn().mockResolvedValue({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  }),
}));

// Create mock database
function createMockDb() {
  return {
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
    runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
  };
}

// Create mock sync queue item
function createMockOperation(
  overrides: Partial<SyncQueueItem> = {},
): SyncQueueItem {
  return {
    id: "op-1",
    operation: "INSERT",
    table_name: "attendances",
    record_id: "rec-1",
    payload: JSON.stringify({ beer_count: 5 }),
    idempotency_key: null,
    depends_on: null,
    status: "pending",
    retry_count: 0,
    last_error: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("QueueProcessor", () => {
  let processor: QueueProcessor;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    processor = createQueueProcessor(
      mockDb as unknown as Parameters<typeof createQueueProcessor>[0],
    );
  });

  describe("constructor", () => {
    it("should create a QueueProcessor instance", () => {
      expect(processor).toBeInstanceOf(QueueProcessor);
      expect(processor.processing).toBe(false);
    });

    it("should accept custom options", () => {
      const customProcessor = createQueueProcessor(
        mockDb as unknown as Parameters<typeof createQueueProcessor>[0],
        {
          maxRetries: 5,
          baseDelay: 2000,
          maxDelay: 60000,
        },
      );

      expect(customProcessor).toBeInstanceOf(QueueProcessor);
    });
  });

  describe("registerHandler", () => {
    it("should register operation handlers", () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      processor.registerHandler("INSERT", handler);

      // Handler is registered (no error thrown)
      expect(processor).toBeDefined();
    });
  });

  describe("processQueue", () => {
    it("should return empty result when no operations", async () => {
      const result = await processor.processQueue();

      expect(result.processed).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should skip already processing queue", async () => {
      // Start first process
      const firstProcess = processor.processQueue();

      // Try to start second process
      const secondResult = await processor.processQueue();

      expect(secondResult.processed).toBe(0);

      await firstProcess;
    });

    it("should process operations with registered handlers", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({ id: "op-1", operation: "INSERT" }),
      ]);

      const handler = vi.fn().mockResolvedValue(undefined);
      processor.registerHandler("INSERT", handler);

      const result = await processor.processQueue();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(handler).toHaveBeenCalled();
    });

    it("should handle operation failures", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({ id: "op-1", operation: "INSERT" }),
      ]);

      const handler = vi.fn().mockRejectedValue(new Error("Network error"));
      processor.registerHandler("INSERT", handler);

      const result = await processor.processQueue();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toEqual({
        operationId: "op-1",
        error: "Network error",
      });
    });

    it("should skip operations exceeding max retries", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({
          id: "op-1",
          operation: "INSERT",
          retry_count: 5,
        }),
      ]);

      const handler = vi.fn();
      processor.registerHandler("INSERT", handler);

      const result = await processor.processQueue();

      expect(result.skipped).toBe(1);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should call progress callback", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({ id: "op-1" }),
        createMockOperation({ id: "op-2" }),
      ]);

      const onProgress = vi.fn();
      const progressProcessor = createQueueProcessor(
        mockDb as unknown as Parameters<typeof createQueueProcessor>[0],
        { onProgress },
      );

      const handler = vi.fn().mockResolvedValue(undefined);
      progressProcessor.registerHandler("INSERT", handler);

      await progressProcessor.processQueue();

      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it("should call error callback on failure", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({ id: "op-1" }),
      ]);

      const onError = vi.fn();
      const errorProcessor = createQueueProcessor(
        mockDb as unknown as Parameters<typeof createQueueProcessor>[0],
        { onError },
      );

      const handler = vi.fn().mockRejectedValue(new Error("Test error"));
      errorProcessor.registerHandler("INSERT", handler);

      await errorProcessor.processQueue();

      expect(onError).toHaveBeenCalled();
      const [op, error] = onError.mock.calls[0];
      expect(op.id).toBe("op-1");
      expect(error.message).toBe("Test error");
    });

    it("should call success callback on success", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({ id: "op-1" }),
      ]);

      const onSuccess = vi.fn();
      const successProcessor = createQueueProcessor(
        mockDb as unknown as Parameters<typeof createQueueProcessor>[0],
        { onSuccess },
      );

      const handler = vi.fn().mockResolvedValue(undefined);
      successProcessor.registerHandler("INSERT", handler);

      await successProcessor.processQueue();

      expect(onSuccess).toHaveBeenCalled();
      expect(onSuccess.mock.calls[0][0].id).toBe("op-1");
    });

    it("should respect abort signal", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({ id: "op-1" }),
        createMockOperation({ id: "op-2" }),
        createMockOperation({ id: "op-3" }),
      ]);

      const controller = new AbortController();
      const abortProcessor = createQueueProcessor(
        mockDb as unknown as Parameters<typeof createQueueProcessor>[0],
        { signal: controller.signal },
      );

      // Abort immediately
      controller.abort();

      const handler = vi.fn().mockResolvedValue(undefined);
      abortProcessor.registerHandler("INSERT", handler);

      const result = await abortProcessor.processQueue();

      // Should stop processing after abort
      expect(result.processed).toBeLessThan(3);
    });
  });

  describe("dependency resolution", () => {
    it("should not process operations with unresolved dependencies", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({
          id: "op-2",
          depends_on: "op-1", // Depends on op-1 which is not completed
        }),
      ]);

      // Mock dependency check - dependency exists and is not completed
      mockDb.getFirstAsync.mockResolvedValue({
        id: "op-1",
        status: "pending",
      });

      const handler = vi.fn().mockResolvedValue(undefined);
      processor.registerHandler("INSERT", handler);

      const result = await processor.processQueue();

      // Operations with unresolved dependencies are filtered out before processing
      // So they're not counted in the processed results at all
      expect(result.processed).toBe(0);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should process operations with resolved dependencies", async () => {
      const { getPendingOperations } = await import("../sync-queue");
      (getPendingOperations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        createMockOperation({
          id: "op-2",
          depends_on: "op-1",
        }),
      ]);

      // Mock dependency check - dependency is completed
      mockDb.getFirstAsync.mockResolvedValue({
        id: "op-1",
        status: "completed",
      });

      const handler = vi.fn().mockResolvedValue(undefined);
      processor.registerHandler("INSERT", handler);

      const result = await processor.processQueue();

      expect(result.succeeded).toBe(1);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("getStats", () => {
    it("should return queue statistics", async () => {
      const stats = await processor.getStats();

      expect(stats).toHaveProperty("pending");
      expect(stats).toHaveProperty("processing");
      expect(stats).toHaveProperty("completed");
      expect(stats).toHaveProperty("failed");
    });
  });

  describe("clearCompleted", () => {
    it("should clear completed operations", async () => {
      const count = await processor.clearCompleted();

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        "DELETE FROM _sync_queue WHERE status = 'completed'",
      );
      expect(count).toBe(1); // Mocked changes
    });
  });

  describe("clearAll", () => {
    it("should clear all operations", async () => {
      const count = await processor.clearAll();

      expect(mockDb.runAsync).toHaveBeenCalledWith("DELETE FROM _sync_queue");
      expect(count).toBe(1);
    });
  });
});

describe("sleep", () => {
  it("should delay for specified duration", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some timing variance
    expect(elapsed).toBeLessThan(100);
  });
});

describe("withRetry", () => {
  it("should succeed on first try", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Fail 1"))
      .mockRejectedValueOnce(new Error("Fail 2"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 10,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Always fails"));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelay: 10,
      }),
    ).rejects.toThrow("Always fails");

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("should call onRetry callback", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Fail"))
      .mockResolvedValue("success");

    const onRetry = vi.fn();

    await withRetry(fn, {
      maxRetries: 2,
      baseDelay: 10,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it("should respect maxDelay", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Fail"))
      .mockResolvedValue("success");

    const start = Date.now();
    await withRetry(fn, {
      maxRetries: 1,
      baseDelay: 10,
      maxDelay: 20,
    });
    const elapsed = Date.now() - start;

    // Should not exceed maxDelay significantly
    expect(elapsed).toBeLessThan(100);
  });
});

describe("createQueueProcessor", () => {
  it("should create a QueueProcessor with factory function", () => {
    const mockDb = createMockDb();
    const processor = createQueueProcessor(
      mockDb as unknown as Parameters<typeof createQueueProcessor>[0],
    );

    expect(processor).toBeInstanceOf(QueueProcessor);
  });
});
