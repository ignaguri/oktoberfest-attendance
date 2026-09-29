import {
  makeOfficialStats,
  makeWrapped,
} from "@prostcounter/shared/wrapped/testing";
import { describe, expect, it, vi } from "vitest";

import { NotFoundError, ValidationError } from "../../middleware/error";
import type {
  IWrappedRepository,
  WrappedShareStore,
} from "../../repositories/interfaces";
import { WrappedShareService } from "../wrapped-share.service";

function setup(
  status: { isUnlocked: boolean; hasAttendance: boolean } | null,
  stats = makeOfficialStats(),
) {
  const wrappedRepo = {
    getStatus: vi
      .fn()
      .mockResolvedValue(
        status && { unlocksAt: "2026-10-05T00:00:00Z", ...status },
      ),
    getWrapped: vi.fn().mockResolvedValue(makeWrapped()),
  } as unknown as IWrappedRepository;
  const statsRepo = { getForWrapped: vi.fn().mockResolvedValue(stats) };
  const store: WrappedShareStore = {
    listLive: vi.fn().mockResolvedValue([]),
    upsertLive: vi.fn().mockResolvedValue("tok"),
    revoke: vi.fn().mockResolvedValue(true),
    getPublic: vi.fn(),
  };
  return {
    service: new WrappedShareService(wrappedRepo, statsRepo, store),
    statsRepo,
    store,
  };
}

const ready = { isUnlocked: true, hasAttendance: true };

describe("WrappedShareService", () => {
  it("throws NotFound for a locked Wrapped", async () => {
    const { service } = setup({ isUnlocked: false, hasAttendance: true });
    await expect(service.getCards("u", "f")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws NotFound when the user did not attend", async () => {
    const { service } = setup({ isUnlocked: true, hasAttendance: false });
    await expect(service.getCards("u", "f")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws NotFound for a card the Wrapped does not offer", async () => {
    const { service } = setup(ready, null as never);
    await expect(service.getCard("u", "f", "city")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("still offers cards when official stats fail to load", async () => {
    const { service, statsRepo } = setup(ready);
    statsRepo.getForWrapped.mockRejectedValue(new Error("boom"));
    const cards = await service.getCards("u", "f");
    expect(cards.map((card) => card.kind)).toEqual([
      "numbers",
      "persona",
      "rhythm",
      "photos",
    ]);
  });

  it("stores the current card when creating a link", async () => {
    const { service, store } = setup(ready);
    await expect(service.createLink("u", "f", "persona")).resolves.toBe("tok");
    expect(store.upsertLive).toHaveBeenCalledWith(
      "u",
      "f",
      "persona",
      expect.objectContaining({ kind: "persona" }),
    );
  });

  it("refuses to link the photos card", async () => {
    const { service } = setup(ready);
    await expect(
      service.createLink("u", "f", "photos" as never),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to link a card the Wrapped does not offer", async () => {
    const { service } = setup(ready, null as never);
    await expect(service.createLink("u", "f", "city")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("throws NotFound when revoking a token that is not live", async () => {
    const { service, store } = setup(ready);
    vi.mocked(store.revoke).mockResolvedValue(false);
    await expect(service.revokeLink("u", "tok")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
