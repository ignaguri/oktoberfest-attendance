import { describe, expect, it, vi } from "vitest";

import { sendExpoDataPush } from "../expo-push-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("sendExpoDataPush", () => {
  it("sends a high-priority data-only message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [{ status: "ok", id: "x" }] }));

    const result = await sendExpoDataPush(
      "ExponentPushToken[abc]",
      { type: "live-activity", state: null },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({ ok: true, deviceNotRegistered: false });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(JSON.parse(init.body)).toEqual([
      {
        to: "ExponentPushToken[abc]",
        data: { type: "live-activity", state: null },
        priority: "high",
        _contentAvailable: true,
      },
    ]);
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("adds the access token when one is configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [{ status: "ok" }] }));

    await sendExpoDataPush("t", {}, fetchImpl as unknown as typeof fetch, "secret");

    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
  });

  it("flags DeviceNotRegistered", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }),
    );

    const result = await sendExpoDataPush("t", {}, fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ ok: false, deviceNotRegistered: true, error: "DeviceNotRegistered" });
  });

  it("reports a failed HTTP call as not ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));

    const result = await sendExpoDataPush("t", {}, fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ ok: false, deviceNotRegistered: false, error: "HTTP 500" });
  });
});
