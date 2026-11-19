import { beforeEach, describe, expect, it, vi } from "vitest";

import { endOrphanedLocationSession } from "../end-orphaned-session";

const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    ApiError,
    stopSession: vi.fn(),
    clearLocationSessionId: vi.fn(),
  };
});

vi.mock("@/lib/api-client", () => ({
  ApiError: mocks.ApiError,
  apiClient: { location: { stopSession: mocks.stopSession } },
}));
vi.mock("@/lib/auth/secure-storage", () => ({
  clearLocationSessionId: mocks.clearLocationSessionId,
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

describe("endOrphanedLocationSession", () => {
  beforeEach(() => {
    mocks.stopSession.mockReset();
    mocks.clearLocationSessionId.mockReset();
  });

  it("ends the session on the server, then forgets its id", async () => {
    mocks.stopSession.mockResolvedValue({});

    await endOrphanedLocationSession("session-1");

    expect(mocks.stopSession).toHaveBeenCalledWith("session-1");
    expect(mocks.clearLocationSessionId).toHaveBeenCalledOnce();
  });

  it("forgets the id when the server no longer has the session", async () => {
    mocks.stopSession.mockRejectedValue(new mocks.ApiError("NOT_FOUND", "gone", 404));

    await endOrphanedLocationSession("session-1");

    expect(mocks.clearLocationSessionId).toHaveBeenCalledOnce();
  });

  it("keeps the id for the next launch when the call fails", async () => {
    mocks.stopSession.mockRejectedValue(new Error("Network request failed"));

    await endOrphanedLocationSession("session-1");

    expect(mocks.clearLocationSessionId).not.toHaveBeenCalled();
  });
});
