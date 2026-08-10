/**
 * Push handler wire contract.
 *
 * Each handler is a mapping from a queued payload to an API call, and the payload
 * is stored as JSON so nothing type-checks the two ends against each other: a
 * renamed key (visited_at vs visitedAt) or a dropped argument compiles fine and
 * fails on a device, after the queue has already accepted the operation. These
 * tests pin the mapping.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { pushInsert } from "../sync/push-handlers";

const logTentVisit = vi.fn().mockResolvedValue({
  tentVisitId: "tv-1",
  attendanceId: "att-1",
  visitedAt: "2026-09-23T20:00:00.000Z",
});
const updatePersonal = vi.fn().mockResolvedValue({
  attendanceId: "att-1",
  tentsAdded: [],
  tentsRemoved: [],
});
const logConsumption = vi.fn().mockResolvedValue({});

vi.mock("../../api-client", () => ({
  apiClient: {
    attendance: {
      get logTentVisit() {
        return logTentVisit;
      },
      get updatePersonal() {
        return updatePersonal;
      },
    },
    consumption: {
      get log() {
        return logConsumption;
      },
    },
  },
}));

const warn = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    get warn() {
      return warn;
    },
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("pushInsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs a tent visit under the local row's id", async () => {
    await pushInsert("tent_visits", "local-tv-id", {
      festival_id: "festival-1",
      tent_id: "tent-1",
      visited_at: "2026-09-23T20:00:00.000Z",
    });

    // Passing the local id is what keeps the server row and the local row the
    // same row: without it the server mints its own and the next pull sees an
    // orphan beside a stranger.
    expect(logTentVisit).toHaveBeenCalledWith({
      festivalId: "festival-1",
      tentId: "tent-1",
      visitedAt: "2026-09-23T20:00:00.000Z",
      tentVisitId: "local-tv-id",
    });
  });

  it("still routes attendances to updatePersonal", async () => {
    await pushInsert("attendances", "local-att-id", {
      festival_id: "festival-1",
      date: "2026-09-23",
      tents: ["tent-1"],
    });

    expect(updatePersonal).toHaveBeenCalledWith({
      festivalId: "festival-1",
      date: "2026-09-23",
      amount: 0,
      tents: ["tent-1"],
    });
    expect(logTentVisit).not.toHaveBeenCalled();
  });

  it("warns instead of throwing for a table with no handler", async () => {
    await pushInsert("beer_pictures", "local-id", {});

    expect(warn).toHaveBeenCalledWith("[SyncManager] No insert handler for table: beer_pictures");
    expect(logTentVisit).not.toHaveBeenCalled();
    expect(updatePersonal).not.toHaveBeenCalled();
  });
});
