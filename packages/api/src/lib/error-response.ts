import { z } from "@hono/zod-openapi";

/**
 * The body every failed request comes back with.
 *
 * Shaped after the global handler in `middleware/error.ts`, which nests the
 * whole thing under `error`. The routes used to document a flat
 * `{ error, message }`, which no response has ever had, so a client reading
 * the spec could not find the code it needs to translate the failure.
 *
 * `errors` only appears on a ValidationError, which carries the offending
 * fields alongside the code.
 */
export const ApiErrorSchema = z
  .object({
    error: z.object({
      message: z.string(),
      code: z.string(),
      statusCode: z.number(),
      errors: z.unknown().optional(),
    }),
  })
  .openapi("ApiError");
