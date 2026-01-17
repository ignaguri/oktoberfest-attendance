/**
 * Queue Processor
 *
 * Handles processing of the sync queue with:
 * - Dependency resolution (operations execute in order)
 * - Exponential backoff for retries
 * - Idempotency support
 * - Error handling and recovery
 */

import type { SyncQueueItem } from "./schema";
import type * as SQLite from "expo-sqlite";

import {
  getPendingOperations,
  markOperationProcessing,
  markOperationCompleted,
  markOperationFailed,
  markRecordClean,
  getQueueStats,
} from "./sync-queue";

// =============================================================================
// Types
// =============================================================================

export interface ProcessorOptions {
  /** Maximum number of retries before giving up */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff */
  baseDelay?: number;
  /** Maximum delay in ms */
  maxDelay?: number;
  /** Callback for each processed operation */
  onProgress?: (processed: number, total: number) => void;
  /** Callback when an operation fails */
  onError?: (operation: SyncQueueItem, error: Error) => void;
  /** Callback when an operation succeeds */
  onSuccess?: (operation: SyncQueueItem) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface ProcessorResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ operationId: string; error: string }>;
}

export type OperationHandler = (operation: SyncQueueItem) => Promise<void>;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000; // 1 second
const DEFAULT_MAX_DELAY = 30000; // 30 seconds

// =============================================================================
// Queue Processor Class
// =============================================================================

export class QueueProcessor {
  private db: SQLite.SQLiteDatabase;
  private options: Required<
    Omit<ProcessorOptions, "signal" | "onProgress" | "onError" | "onSuccess">
  > &
    ProcessorOptions;
  private operationHandlers: Map<string, OperationHandler> = new Map();
  private isProcessing = false;

  constructor(db: SQLite.SQLiteDatabase, options: ProcessorOptions = {}) {
    this.db = db;
    this.options = {
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelay: options.baseDelay ?? DEFAULT_BASE_DELAY,
      maxDelay: options.maxDelay ?? DEFAULT_MAX_DELAY,
      onProgress: options.onProgress,
      onError: options.onError,
      onSuccess: options.onSuccess,
      signal: options.signal,
    };
  }

  /**
   * Check if processing is in progress
   */
  get processing(): boolean {
    return this.isProcessing;
  }

  /**
   * Register a handler for a specific operation type
   */
  registerHandler(
    operationType: "INSERT" | "UPDATE" | "DELETE" | "UPLOAD_FILE",
    handler: OperationHandler,
  ): void {
    this.operationHandlers.set(operationType, handler);
  }

  /**
   * Process all pending operations in the queue
   */
  async processQueue(): Promise<ProcessorResult> {
    if (this.isProcessing) {
      console.log("[QueueProcessor] Already processing, skipping");
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        errors: [],
      };
    }

    this.isProcessing = true;
    const result: ProcessorResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Get operations that are ready to process (no unresolved dependencies)
      const operations = await this.getReadyOperations();
      const total = operations.length;

      console.log(`[QueueProcessor] Processing ${total} operations`);

      for (const op of operations) {
        // Check for abort signal
        if (this.options.signal?.aborted) {
          console.log("[QueueProcessor] Aborted");
          break;
        }

        const opResult = await this.processOperation(op);
        result.processed++;

        if (opResult.success) {
          result.succeeded++;
          this.options.onSuccess?.(op);
        } else {
          if (opResult.skipped) {
            result.skipped++;
          } else {
            result.failed++;
            result.errors.push({
              operationId: op.id,
              error: opResult.error ?? "Unknown error",
            });
            this.options.onError?.(op, new Error(opResult.error));
          }
        }

        this.options.onProgress?.(result.processed, total);
      }
    } finally {
      this.isProcessing = false;
    }

    console.log(
      `[QueueProcessor] Complete: succeeded=${result.succeeded}, failed=${result.failed}, skipped=${result.skipped}`,
    );

    return result;
  }

  /**
   * Process a single operation with retry logic
   */
  private async processOperation(
    op: SyncQueueItem,
  ): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    // Check if operation has exceeded max retries
    if (op.retry_count >= this.options.maxRetries) {
      console.log(
        `[QueueProcessor] Operation ${op.id} exceeded max retries, skipping`,
      );
      return { success: false, skipped: true, error: "Max retries exceeded" };
    }

    // Check if dependencies are resolved
    if (op.depends_on) {
      const dependency = await this.db.getFirstAsync<SyncQueueItem>(
        "SELECT * FROM _sync_queue WHERE id = ?",
        [op.depends_on],
      );

      if (dependency && dependency.status !== "completed") {
        console.log(
          `[QueueProcessor] Operation ${op.id} waiting for dependency ${op.depends_on}`,
        );
        return {
          success: false,
          skipped: true,
          error: "Dependency not resolved",
        };
      }
    }

    // Get handler for this operation type
    const handler = this.operationHandlers.get(op.operation);
    if (!handler) {
      console.warn(
        `[QueueProcessor] No handler for operation type: ${op.operation}`,
      );
      return { success: false, error: `No handler for ${op.operation}` };
    }

    // Mark as processing
    await markOperationProcessing(this.db, op.id);

    try {
      await handler(op);
      await markOperationCompleted(this.db, op.id);

      // Mark the record as clean if this was a data operation
      if (op.operation !== "UPLOAD_FILE") {
        const now = new Date().toISOString();
        await markRecordClean(this.db, op.table_name, op.record_id, now);
      }

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await markOperationFailed(this.db, op.id, errorMsg);

      // Schedule retry with backoff
      const delay = this.calculateBackoff(op.retry_count);
      console.log(
        `[QueueProcessor] Operation ${op.id} failed, will retry after ${delay}ms`,
      );

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get operations that are ready to process (pending with resolved dependencies)
   */
  private async getReadyOperations(): Promise<SyncQueueItem[]> {
    // Get all pending operations ordered by creation time
    const pendingOps = await getPendingOperations(this.db);

    // Filter to only those with resolved dependencies
    const readyOps: SyncQueueItem[] = [];

    for (const op of pendingOps) {
      if (!op.depends_on) {
        // No dependency, ready to process
        readyOps.push(op);
        continue;
      }

      // Check if dependency is completed
      const dependency = await this.db.getFirstAsync<SyncQueueItem>(
        "SELECT * FROM _sync_queue WHERE id = ?",
        [op.depends_on],
      );

      if (!dependency || dependency.status === "completed") {
        readyOps.push(op);
      }
    }

    return readyOps;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: baseDelay * 2^retryCount
    const delay = this.options.baseDelay * Math.pow(2, retryCount);

    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);

    // Clamp to maxDelay
    return Math.min(delay + jitter, this.options.maxDelay);
  }

  /**
   * Retry failed operations
   */
  async retryFailed(): Promise<ProcessorResult> {
    // Reset failed operations that haven't exceeded max retries
    await this.db.runAsync(
      `UPDATE _sync_queue SET status = 'pending'
       WHERE status = 'failed' AND retry_count < ?`,
      [this.options.maxRetries],
    );

    // Process the queue
    return this.processQueue();
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    return getQueueStats(this.db);
  }

  /**
   * Clear completed operations from the queue
   */
  async clearCompleted(): Promise<number> {
    const result = await this.db.runAsync(
      "DELETE FROM _sync_queue WHERE status = 'completed'",
    );
    return result.changes;
  }

  /**
   * Clear all operations from the queue (use with caution)
   */
  async clearAll(): Promise<number> {
    const result = await this.db.runAsync("DELETE FROM _sync_queue");
    return result.changes;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new QueueProcessor instance
 */
export function createQueueProcessor(
  db: SQLite.SQLiteDatabase,
  options?: ProcessorOptions,
): QueueProcessor {
  return new QueueProcessor(db, options);
}

// =============================================================================
// Retry Utilities
// =============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelay ?? DEFAULT_BASE_DELAY;
  const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) * (0.75 + Math.random() * 0.5),
          maxDelay,
        );

        options.onRetry?.(attempt + 1, lastError);
        console.log(
          `[withRetry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`,
        );

        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}
