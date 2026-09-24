import { describe, expect, it, vi } from "vitest";

import {
  buildFeedbackEmail,
  createResendFeedbackNotifier,
  FEEDBACK_EMAIL_FROM,
  FEEDBACK_EMAIL_TIMEOUT_MS,
  type FeedbackEmailPayload,
  shouldEmailFeedback,
} from "../feedback-email";

const ENV = { RESEND_API_KEY: "re_test", FEEDBACK_NOTIFY_EMAIL: "inbox@example.com" };

function payload(overrides: Partial<FeedbackEmailPayload> = {}): FeedbackEmailPayload {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "bug",
    rating: null,
    message: "The tent list is empty after I switch festival",
    festivalName: "Oktoberfest 2026",
    day: null,
    username: "sepp",
    userEmail: "sepp@example.com",
    platform: "ios",
    appVersion: "1.9.0",
    locale: "de",
    createdAt: "2026-09-24T08:00:00.000Z",
    ...overrides,
  };
}

describe("shouldEmailFeedback", () => {
  it("emails every bug and idea, and day ratings only with text", () => {
    expect(shouldEmailFeedback("bug", "x")).toBe(true);
    expect(shouldEmailFeedback("idea", "x")).toBe(true);
    expect(shouldEmailFeedback("day", null)).toBe(false);
    expect(shouldEmailFeedback("day", "  ")).toBe(false);
    expect(shouldEmailFeedback("day", "The map was slow")).toBe(true);
  });
});

describe("buildFeedbackEmail", () => {
  it("puts the kind and a preview in the subject", () => {
    expect(buildFeedbackEmail(payload()).subject).toBe(
      "[Bug] The tent list is empty after I switch festival",
    );
    expect(buildFeedbackEmail(payload({ kind: "idea", message: "Dark mode" })).subject).toBe(
      "[Idea] Dark mode",
    );
  });

  it("shows the face, festival and day for day ratings", () => {
    const email = buildFeedbackEmail(
      payload({ kind: "day", rating: 4, day: "2026-09-23", message: "Loved it" }),
    );
    expect(email.subject).toBe("[Day 🙂] Oktoberfest 2026, 2026-09-23");
    expect(email.text).toContain("Rating: 🙂 (4/5)");
    expect(email.text).toContain("Day: 2026-09-23");
  });

  it("carries the context lines", () => {
    const text = buildFeedbackEmail(payload()).text;
    expect(text).toContain("User: sepp <sepp@example.com>");
    expect(text).toContain("Platform: ios");
    expect(text).toContain("App version: 1.9.0");
    expect(text).toContain("Feedback id: 11111111-1111-4111-8111-111111111111");
  });
});

describe("createResendFeedbackNotifier", () => {
  it("posts to Resend with reply-to set to the user", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await createResendFeedbackNotifier(ENV, fetchImpl).notify(payload());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toMatchObject({
      from: FEEDBACK_EMAIL_FROM,
      to: ["inbox@example.com"],
      reply_to: "sepp@example.com",
    });
  });

  it("sends nothing for a rating-only day", async () => {
    const fetchImpl = vi.fn();
    await createResendFeedbackNotifier(ENV, fetchImpl).notify(
      payload({ kind: "day", rating: 5, message: null, day: "2026-09-23" }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips quietly when the env vars are missing", async () => {
    const fetchImpl = vi.fn();
    await expect(createResendFeedbackNotifier({}, fetchImpl).notify(payload())).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not throw when Resend rejects the email", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad", { status: 422 }));
    await expect(createResendFeedbackNotifier(ENV, fetchImpl).notify(payload())).resolves.toBeUndefined();
  });

  it("does not throw when the request itself fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(createResendFeedbackNotifier(ENV, fetchImpl).notify(payload())).resolves.toBeUndefined();
  });

  // submit awaits this, so a hung Resend would hang the request and invite a
  // retry that stores and emails the same bug twice.
  it("gives up on a request that never answers", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      );
      const sent = createResendFeedbackNotifier(ENV, fetchImpl as typeof fetch).notify(payload());

      await vi.advanceTimersByTimeAsync(FEEDBACK_EMAIL_TIMEOUT_MS);

      await expect(sent).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
