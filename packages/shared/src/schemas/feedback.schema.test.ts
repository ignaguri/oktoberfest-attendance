import { describe, expect, it } from "vitest";

import {
  createFeedbackFormSchema,
  FEEDBACK_FACES,
  ListAdminFeedbackQuerySchema,
  SubmitFeedbackBodySchema,
} from "./feedback.schema";

const FESTIVAL_ID = "22222222-2222-4222-8222-222222222222";

describe("SubmitFeedbackBodySchema", () => {
  it("accepts a day rating without text", () => {
    const result = SubmitFeedbackBodySchema.safeParse({
      kind: "day",
      rating: 5,
      festivalId: FESTIVAL_ID,
      day: "2026-09-23",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a day rating outside 1-5", () => {
    const result = SubmitFeedbackBodySchema.safeParse({
      kind: "day",
      rating: 6,
      festivalId: FESTIVAL_ID,
      day: "2026-09-23",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a bug report with only whitespace", () => {
    const result = SubmitFeedbackBodySchema.safeParse({ kind: "bug", message: "   " });
    expect(result.success).toBe(false);
  });

  it("trims bug report text", () => {
    const result = SubmitFeedbackBodySchema.parse({ kind: "bug", message: "  it crashed  " });
    expect(result).toEqual({ kind: "bug", message: "it crashed" });
  });

  it("rejects text over 2000 characters", () => {
    const result = SubmitFeedbackBodySchema.safeParse({ kind: "idea", message: "a".repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe("ListAdminFeedbackQuerySchema", () => {
  it("defaults the limit to 100 and coerces strings", () => {
    expect(ListAdminFeedbackQuerySchema.parse({})).toEqual({ limit: 100 });
    expect(ListAdminFeedbackQuerySchema.parse({ kind: "bug", limit: "20" })).toEqual({
      kind: "bug",
      limit: 20,
    });
  });
});

describe("createFeedbackFormSchema", () => {
  it("requires a face for day feedback but not text", () => {
    const schema = createFeedbackFormSchema("day");
    expect(schema.safeParse({ message: "" }).success).toBe(false);
    expect(schema.safeParse({ rating: 3, message: "" }).success).toBe(true);
  });

  it("requires text for bug and idea feedback", () => {
    const schema = createFeedbackFormSchema("idea");
    const result = schema.safeParse({ message: " " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("feedback.validation.required");
    }
  });
});

describe("FEEDBACK_FACES", () => {
  it("covers ratings 1 to 5 in order", () => {
    expect(FEEDBACK_FACES.map((face) => face.rating)).toEqual([1, 2, 3, 4, 5]);
  });
});
